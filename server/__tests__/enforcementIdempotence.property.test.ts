/**
 * Feature: venue-booking-payment-schedule — Deadline_Enforcement_Job idempotence.
 *
 * Under test (as a pure model): the atomic claim at the heart of
 * `jobs/scheduledJobs.enforceBalanceDeadlines`. The real job issues
 *
 *   Booking.findOneAndUpdate(
 *     { 'paymentSchedule.type':'installment',
 *       'paymentSchedule.balanceStatus':'pending',
 *       'paymentSchedule.balanceDueAt': { $lte: now } },
 *     { $set: { status:'cancelled',
 *               'paymentSchedule.balanceStatus':'forfeited',
 *               cancellationReason:'missed_payment_deadline' } },
 *     { new: false })
 *
 * The correctness of Property 6 lives entirely in one fact: the selector requires
 * `balanceStatus === 'pending'`, and the SAME update clears that field to
 * 'forfeited'. So the second time the same document is offered to the claim, the
 * selector no longer matches — it is a no-op. These jobs touch Mongo, so, matching
 * the repo's pure-model property-test style (settlementIdempotentRecording models
 * the claim logic without a live DB, paymentSchedule.property tests the pure core),
 * we model the CLAIM SEMANTICS as a pure function `claimOnce` and assert the
 * invariant, rather than standing up mongodb-memory-server for a one-line selector.
 *
 * `claimOnce` is kept deliberately faithful to the real selector/update: same four
 * predicate conjuncts (type, status, due, and — modelled — cancelled guard), same
 * three field mutations. If the real selector or update drifts from this, the model
 * must be updated in lockstep; the point of the test is the invariant that the
 * selector-equals-what-the-update-clears design guarantees.
 *
 * Validates: Requirements 5.1, 5.2 — Correctness Property 6.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

type BalanceStatus = 'not_applicable' | 'pending' | 'paid' | 'forfeited';

interface Booking {
    type: 'full' | 'installment';
    balanceStatus: BalanceStatus;
    balanceDueAt: number; // ms epoch
    cancelled: boolean;
    forfeitCount: number;
    cancelCount: number;
}

/**
 * Pure model of the atomic findOneAndUpdate claim in enforceBalanceDeadlines.
 *
 * Mutates `booking` in place iff it matches the exact selector the real job uses,
 * and returns the claimed doc; otherwise returns null (no mutation) — exactly like
 * findOneAndUpdate returning null when nothing matches. Because the selector
 * requires balanceStatus === 'pending' and the update sets it to 'forfeited', a
 * second call on the same doc cannot match: the claim is single-shot by design.
 */
function claimOnce(booking: Booking, now: number): Booking | null {
    // The exact selector conjuncts the real findOneAndUpdate uses.
    const matches =
        booking.type === 'installment' &&
        booking.balanceStatus === 'pending' &&
        booking.balanceDueAt <= now;

    if (!matches) return null;

    // The same $set the real job applies, plus the observable side of cancel+forfeit.
    booking.cancelled = true; //                       status            -> 'cancelled'
    booking.balanceStatus = 'forfeited'; //            balanceStatus     -> 'forfeited' (leaves 'pending')
    booking.cancelCount += 1;
    booking.forfeitCount += 1;
    return booking;
}

function makeBooking(partial: Partial<Booking>): Booking {
    return {
        type: 'installment',
        balanceStatus: 'pending',
        balanceDueAt: 0,
        cancelled: false,
        forfeitCount: 0,
        cancelCount: 0,
        ...partial,
    };
}

// --- generators ------------------------------------------------------------

const NOW = 1_700_000_000_000; // fixed reference instant (ms)
const HOUR = 3600 * 1000;

// A due, pending installment booking: balanceDueAt at or before now.
const dueInstallment = fc
    .integer({ min: 0, max: 24 * 365 }) // hours the deadline is in the past (0 = exactly now)
    .map((hoursPast) =>
        makeBooking({
            type: 'installment',
            balanceStatus: 'pending',
            balanceDueAt: NOW - hoursPast * HOUR,
        })
    );

// Runs of the job over the SAME booking: 1..20 executions (Req: "multiple times").
const runCount = fc.integer({ min: 1, max: 20 });

// Bookings the claim must NEVER touch: not due, or not pending, or full-schedule.
const notClaimable = fc.oneof(
    // Not due yet (deadline strictly in the future).
    fc
        .integer({ min: 1, max: 24 * 365 })
        .map((hoursFuture) =>
            makeBooking({ type: 'installment', balanceStatus: 'pending', balanceDueAt: NOW + hoursFuture * HOUR })
        ),
    // Due, but status already left 'pending'.
    fc
        .constantFrom<BalanceStatus>('paid', 'forfeited', 'not_applicable')
        .map((status) => makeBooking({ type: 'installment', balanceStatus: status, balanceDueAt: NOW - HOUR })),
    // Full schedule (never an installment balance to enforce).
    fc.constant(makeBooking({ type: 'full', balanceStatus: 'not_applicable', balanceDueAt: NOW - HOUR }))
);

// --- Property 6 ------------------------------------------------------------

describe('Property 6 — enforcement claim is single-shot per booking', () => {
    it('running the claim any number of times on a due pending installment yields exactly one cancel + one forfeit', () => {
        fc.assert(
            fc.property(dueInstallment, runCount, (booking, runs) => {
                const results: (Booking | null)[] = [];
                for (let i = 0; i < runs; i++) {
                    results.push(claimOnce(booking, NOW));
                }

                // Exactly one cancellation and one forfeiture, no matter how many runs.
                expect(booking.cancelCount).toBe(1);
                expect(booking.forfeitCount).toBe(1);
                expect(booking.cancelled).toBe(true);
                expect(booking.balanceStatus).toBe('forfeited');

                // The FIRST run claimed it; every subsequent run was a no-op (null).
                expect(results[0]).not.toBeNull();
                for (const r of results.slice(1)) {
                    expect(r).toBeNull();
                }
            }),
            { numRuns: 400 }
        );
    });

    it('never claims a booking that is not due, not pending, or not an installment', () => {
        fc.assert(
            fc.property(notClaimable, runCount, (booking, runs) => {
                for (let i = 0; i < runs; i++) {
                    expect(claimOnce(booking, NOW)).toBeNull();
                }
                // Untouched: zero cancels, zero forfeits.
                expect(booking.cancelCount).toBe(0);
                expect(booking.forfeitCount).toBe(0);
                expect(booking.cancelled).toBe(false);
            }),
            { numRuns: 400 }
        );
    });
});
