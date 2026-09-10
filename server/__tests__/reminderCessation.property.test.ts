/**
 * Feature: venue-booking-payment-schedule — Payment_Reminder_Job cessation.
 *
 * Under test (as a pure model): the query selector at the heart of
 * `jobs/scheduledJobs.sendBalanceReminders`. The real job selects with
 *
 *   Booking.find({
 *     'paymentSchedule.type': 'installment',
 *     'paymentSchedule.balanceStatus': 'pending',
 *     'paymentSchedule.balanceDueAt': { $gt: now },       // skip past-deadline
 *     'paymentSchedule.lastReminderOn': { $ne: today }    // once per calendar day
 *   })
 *
 * Property 5 is a claim about that selector: once balanceStatus leaves 'pending'
 * (to the terminal 'paid' or 'forfeited', or the never-applicable
 * 'not_applicable'), the selector matches zero — so further runs send nothing. And
 * the `lastReminderOn !== today` conjunct means once today's reminder has fired
 * (lastReminderOn set to today), the booking is excluded for the rest of the day:
 * at most one per calendar day (Req 7.1).
 *
 * These jobs touch Mongo, so — matching the repo's pure-model property-test style
 * (settlementIdempotentRecording models the claim logic; paymentSchedule.property
 * tests the pure core) — we model the selector as a pure predicate
 * `qualifiesForReminder` and assert the invariant, rather than standing up a live
 * DB for a four-conjunct find(). The predicate is kept faithful to the real query;
 * if the query drifts, the model must move with it.
 *
 * Validates: Requirements 7.1, 7.4 — Correctness Property 5.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

type BalanceStatus = 'not_applicable' | 'pending' | 'paid' | 'forfeited';

interface Booking {
    type: 'full' | 'installment';
    balanceStatus: BalanceStatus;
    balanceDueAt: number; // ms epoch
    lastReminderOn: string | null; // 'YYYY-MM-DD'
}

/**
 * Pure model of the sendBalanceReminders find() selector. Faithful to all four
 * conjuncts of the real query: installment type, pending status, deadline still in
 * the future (> now), and not-yet-reminded-today.
 */
function qualifiesForReminder(booking: Booking, now: number, today: string): boolean {
    return (
        booking.type === 'installment' &&
        booking.balanceStatus === 'pending' &&
        booking.balanceDueAt > now &&
        booking.lastReminderOn !== today
    );
}

// --- generators ------------------------------------------------------------

const NOW = 1_700_000_000_000;
const HOUR = 3600 * 1000;
const TODAY = '2023-11-14';

// Statuses that are NOT 'pending' — the terminal/never-applicable ones.
const nonPendingStatus = fc.constantFrom<BalanceStatus>('paid', 'forfeited', 'not_applicable');

const anyType = fc.constantFrom<'full' | 'installment'>('full', 'installment');
// balanceDueAt anywhere from far past to far future, so "other fields" genuinely vary.
const anyDueAt = fc.integer({ min: -24 * 365, max: 24 * 365 }).map((h) => NOW + h * HOUR);
const anyLastReminder = fc.option(fc.constantFrom(TODAY, '2023-11-13', '2020-01-01'), { nil: null });

// A booking whose status is anything BUT 'pending', with every other field free.
const nonPendingBooking: fc.Arbitrary<Booking> = fc.record({
    type: anyType,
    balanceStatus: nonPendingStatus,
    balanceDueAt: anyDueAt,
    lastReminderOn: anyLastReminder,
});

// A booking that DOES currently qualify: installment, pending, future deadline,
// not yet reminded today. Used to prove the once-per-day cessation.
const qualifyingBooking: fc.Arbitrary<Booking> = fc
    .integer({ min: 1, max: 24 * 365 }) // hours until deadline (strictly future)
    .chain((hoursFuture) =>
        fc.constantFrom<string | null>(null, '2023-11-13', '2020-01-01').map((last) => ({
            type: 'installment' as const,
            balanceStatus: 'pending' as const,
            balanceDueAt: NOW + hoursFuture * HOUR,
            lastReminderOn: last, // anything but today
        }))
    );

// --- Property 5: cessation once status leaves 'pending' --------------------

describe("Property 5 — reminders cease once balanceStatus leaves 'pending'", () => {
    it('never qualifies a booking whose status is not pending, regardless of other fields', () => {
        fc.assert(
            fc.property(nonPendingBooking, (booking) => {
                expect(qualifiesForReminder(booking, NOW, TODAY)).toBe(false);
            }),
            { numRuns: 500 }
        );
    });
});

// --- Property 5 (cont.): at-most-once-per-day ------------------------------

describe('Property 5 — a reminder sent today suppresses further reminders that day', () => {
    it('after lastReminderOn is set to today, the booking no longer qualifies today', () => {
        fc.assert(
            fc.property(qualifyingBooking, (booking) => {
                // Before today's reminder: it qualifies.
                expect(qualifiesForReminder(booking, NOW, TODAY)).toBe(true);

                // The job sends the reminder and stamps lastReminderOn = today.
                const after = { ...booking, lastReminderOn: TODAY };

                // Any further run today finds it excluded — at most one per calendar day.
                expect(qualifiesForReminder(after, NOW, TODAY)).toBe(false);
            }),
            { numRuns: 400 }
        );
    });
});
