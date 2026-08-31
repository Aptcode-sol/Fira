/**
 * Task 3.9 — request validation on the settlement recording path.
 *
 * `settlementService.validateEntry(input, now)` is pure: no Mongo, no listing
 * lookup, and the clock is a parameter rather than a `Date.now()` call. So the
 * whole rejection surface — including the future-date boundary — is exercisable
 * without a database and without freezing time.
 *
 * The property has two halves. The first, "rejected with an error naming the
 * offending field", is asserted directly: every generated request breaks exactly
 * one field of an otherwise-valid submission, and the decision must name that
 * field. The second, "no Settlement_Entry is created and the ledger is
 * byte-identical", is structurally guaranteed at this layer — `validateEntry`
 * is a decision that touches no store, so there is nothing it could have
 * written. What IS checkable here, and is checked, is that it does not mutate
 * the request it was handed: a validator that normalised `input` in place would
 * make the caller's later `Settlement.create` write something other than what
 * was submitted. The DB-level half of the statement (no entry appears, the
 * stored ledger is unchanged) belongs to task 5.2's layer, where `recordEntry`
 * calls this validator before any write.
 *
 * Generators cover every rejection the requirements call out — whitespace-only
 * reference and idempotency key, fractional/negative/zero/absent amounts,
 * unparseable and future `settledAt` — and also generate fully valid requests,
 * so the test proves the validator accepts rather than rejecting everything.
 * The `settledAt === now` boundary is included on the valid side: a transfer
 * recorded the instant it happened is not "in the future" (Requirement 4.9).
 *
 * Feature: per-listing-settlement-tracking, Property 7: An invalid request changes nothing
 * Validates: Requirements 4.7, 4.8, 4.9, 6.3
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const settlementService = require('../services/settlementService');

/** A generated submission plus the field the validator must name, or null when valid. */
type Case = { input: Record<string, any>; now: Date; expectedField: string | null; label: string };

// A fixed-ish "now" so the future boundary is a generated value, not the clock.
const NOW_MS = fc.integer({ min: 1_600_000_000_000, max: 1_900_000_000_000 });

/** Whitespace that carries nothing once trimmed — as absent as a missing value. */
const BLANK = fc
    .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 5 })
    .map((chars) => chars.join(''));

/** A string that survives trimming. */
const FILLED = fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0);

const VALID_AMOUNT = fc.integer({ min: 1, max: 5_000_000 });

/** Absent in every way a JSON body can be absent. */
const ABSENT = fc.constantFrom(undefined, null);

/**
 * A well-formed request at `nowMs`. Every invalid case below is this base with
 * exactly one field broken, which is what makes the reported field name
 * predictable: `validateEntry` reports the FIRST offending field, so breaking
 * one field of an otherwise-valid request must name that field.
 */
const BASE = fc
    .tuple(NOW_MS, FILLED, FILLED, VALID_AMOUNT, fc.boolean(), fc.integer({ min: 0, max: 10_000_000_000 }))
    .map(([nowMs, reference, key, amount, asIso, age]) => {
        const settledAtMs = nowMs - age;
        const input: Record<string, any> = {
            settledAmount: amount,
            settlementReference: reference,
            // Both shapes a JSON body can carry a date in.
            settledAt: asIso ? new Date(settledAtMs).toISOString() : new Date(settledAtMs),
            idempotencyKey: key,
            method: 'manual',
            adminNotes: 'transferred via NEFT',
        };
        return { nowMs, input };
    });

/** Break one field, and say which one the validator must name. */
const CASES: fc.Arbitrary<Case> = fc.oneof(
    // --- accepted: the validator must not reject everything -----------------
    BASE.map(({ nowMs, input }) => ({ input, now: new Date(nowMs), expectedField: null, label: 'valid request' })),

    // settledAt exactly at `now` — recorded the instant it happened (Req 4.9 boundary).
    BASE.map(({ nowMs, input }) => ({
        input: { ...input, settledAt: new Date(nowMs) },
        now: new Date(nowMs),
        expectedField: null,
        label: 'settledAt exactly now',
    })),

    // `method` and `adminNotes` are optional — absence is not a rejection (Req 4.5).
    BASE.map(({ nowMs, input }) => {
        const { method, adminNotes, ...rest } = input;
        return { input: rest, now: new Date(nowMs), expectedField: null, label: 'valid request without optional fields' };
    }),

    // --- settledAmount (Requirement 4.7) ------------------------------------
    fc
        .tuple(
            BASE,
            fc.oneof(
                ABSENT,
                fc.constantFrom(0, -0, Number.NaN, Number.POSITIVE_INFINITY, '5000', true),
                fc.integer({ min: -5_000_000, max: 0 }),
                // fractional: paise are not a whole rupee of transfer
                fc.double({ min: 0.01, max: 1_000_000, noNaN: true }).filter((n) => !Number.isInteger(n)),
            ),
        )
        .map(([{ nowMs, input }, settledAmount]) => ({
            input: { ...input, settledAmount },
            now: new Date(nowMs),
            expectedField: 'settledAmount',
            label: `settledAmount = ${String(settledAmount)}`,
        })),

    // --- settlementReference (Requirement 4.8) ------------------------------
    fc
        .tuple(BASE, fc.oneof(ABSENT, fc.constant(''), BLANK, fc.constantFrom(123, true, {}, ['UTR'])))
        .map(([{ nowMs, input }, settlementReference]) => ({
            input: { ...input, settlementReference },
            now: new Date(nowMs),
            expectedField: 'settlementReference',
            label: `settlementReference = ${JSON.stringify(settlementReference) ?? 'undefined'}`,
        })),

    // --- settledAt: absent or unparseable (Requirement 4.9) -----------------
    fc
        .tuple(
            BASE,
            fc.oneof(
                ABSENT,
                fc.constant(''),
                fc.constantFrom('nonsense', 'not-a-date', '2024-13-45', Number.NaN, {}),
                fc.constant(new Date('nonsense')),
            ),
        )
        .map(([{ nowMs, input }, settledAt]) => ({
            input: { ...input, settledAt },
            now: new Date(nowMs),
            expectedField: 'settledAt',
            label: `settledAt unparseable = ${String(settledAt)}`,
        })),

    // --- settledAt: in the future (Requirement 4.9) -------------------------
    fc
        .tuple(BASE, fc.integer({ min: 1, max: 5_000_000_000 }), fc.boolean())
        .map(([{ nowMs, input }, ahead, asIso]) => ({
            input: {
                ...input,
                settledAt: asIso ? new Date(nowMs + ahead).toISOString() : new Date(nowMs + ahead),
            },
            now: new Date(nowMs),
            expectedField: 'settledAt',
            label: `settledAt ${ahead}ms in the future`,
        })),

    // --- idempotencyKey (Requirement 6.3) -----------------------------------
    fc
        .tuple(BASE, fc.oneof(ABSENT, fc.constant(''), BLANK, fc.constantFrom(42, false, {})))
        .map(([{ nowMs, input }, idempotencyKey]) => ({
            input: { ...input, idempotencyKey },
            now: new Date(nowMs),
            expectedField: 'idempotencyKey',
            label: `idempotencyKey = ${String(idempotencyKey)}`,
        })),
);

/**
 * A structural snapshot of the submitted request. `JSON.stringify` alone drops
 * `undefined`-valued keys, so the key list is captured alongside it — a
 * validator that deleted or normalised a key in place would change one or the
 * other.
 */
function snapshot(input: Record<string, any>) {
    return JSON.stringify({
        keys: Object.keys(input),
        values: Object.keys(input).map((k) => {
            const v = input[k];
            if (v === undefined) return '__undefined__';
            if (v instanceof Date) return `__date__${v.getTime()}`;
            if (typeof v === 'number' && !Number.isFinite(v)) return `__number__${String(v)}`;
            return v;
        }),
    });
}

describe('validateEntry — Property 7: an invalid request changes nothing', () => {
    it('names the offending field on every malformed request, accepts well-formed ones, and never mutates the submission', () => {
        fc.assert(
            fc.property(CASES, ({ input, now, expectedField }) => {
                const before = snapshot(input);

                const decision = settlementService.validateEntry(input, now);

                if (expectedField === null) {
                    expect(decision).toEqual({ valid: true });
                } else {
                    expect(decision.valid).toBe(false);
                    expect(decision.status).toBe(400);
                    // The rejection names the one field that was broken...
                    expect(decision.field).toBe(expectedField);
                    // ...and carries a message the panel can put on the form.
                    expect(typeof decision.error).toBe('string');
                    expect(decision.error.length).toBeGreaterThan(0);
                }

                // Nothing was written, because there is nothing here to write to:
                // the decision leaves the caller's request byte-identical, so the
                // submission a later Settlement.create would store is unchanged.
                expect(snapshot(input)).toBe(before);
            }),
            { numRuns: 50 },
        );
    });

    it('rejects an absent request body and the exact called-out boundaries', () => {
        const now = new Date('2025-06-01T12:00:00.000Z');
        const valid = {
            settledAmount: 5000,
            settlementReference: 'UTR123456',
            settledAt: new Date('2025-05-30T09:00:00.000Z'),
            idempotencyKey: 'key-1',
        };

        expect(settlementService.validateEntry(valid, now)).toEqual({ valid: true });

        // No body at all is still a named rejection, not a crash.
        for (const absent of [undefined, null, 'a string', 42]) {
            const decision = settlementService.validateEntry(absent as any, now);
            expect(decision).toMatchObject({ valid: false, status: 400, field: 'settledAmount' });
        }

        // Whitespace-only is as absent as missing (Requirements 4.8, 6.3).
        expect(settlementService.validateEntry({ ...valid, settlementReference: '   ' }, now)).toMatchObject({
            field: 'settlementReference',
        });
        expect(settlementService.validateEntry({ ...valid, idempotencyKey: '\t\n ' }, now)).toMatchObject({
            field: 'idempotencyKey',
        });

        // Fractional rupees are not a whole-rupee transfer (Requirements 4.6, 4.7).
        expect(settlementService.validateEntry({ ...valid, settledAmount: 5000.5 }, now)).toMatchObject({
            field: 'settledAmount',
        });

        // One millisecond ahead is the future; exactly now is not (Requirement 4.9).
        expect(
            settlementService.validateEntry({ ...valid, settledAt: new Date(now.getTime() + 1) }, now),
        ).toMatchObject({ field: 'settledAt' });
        expect(settlementService.validateEntry({ ...valid, settledAt: new Date(now.getTime()) }, now)).toEqual({
            valid: true,
        });
    });
});
