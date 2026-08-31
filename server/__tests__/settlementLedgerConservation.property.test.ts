/**
 * Feature: per-listing-settlement-tracking, Property 1: Ledger conservation.
 *
 * For any listing, any recorded Net_Payable, and any sequence of settlement and
 * reversal rows, Settled_To_Date equals the sum of the effective rows'
 * `settledAmount`, Outstanding_Amount equals `Net_Payable − Settled_To_Date`
 * floored at zero, and when the state is not `over_settled`, Settled_To_Date
 * plus Outstanding_Amount equals Net_Payable within one paisa.
 *
 * Under test: `settlementService.buildLedger(rows, netPayable)` — pure, so no
 * database and no stubs. A reversal row names its target through `isReversalOf`;
 * both halves of the pair contribute zero to Settled_To_Date.
 *
 * The expected figures are recomputed here from the generated entry list with
 * plain arithmetic over the entries the generator KNOWS are effective (the ones
 * it did not mark reversed), independently of the fold under test, so a fold
 * that mis-handles a reversal pair cannot agree by construction.
 *
 * Generator coverage is pinned with explicit `examples`: the empty ledger, the
 * empty ledger against a non-zero Net_Payable, the exact-equality case where
 * Settled_To_Date equals Net_Payable, and a ledger whose only entry is reversed.
 *
 * Validates: Requirements 1.1, 1.6, 1.7, 4.2, 12.2, 12.3
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const settlementService = require('../services/settlementService');

const EPSILON = 0.01; // one paisa — the tolerance the service itself uses

/** Round to paise without borrowing the service's own helper. */
const toPaise2 = (n: number) => Math.round(n * 100) / 100;

type Entry = { amount: number; reversed: boolean };
type Row = { _id: string; settledAmount: number; isReversalOf: string | null };

/**
 * One settlement fact: a whole-rupee amount (Requirement 4.6) and whether a
 * reversal row was later appended for it.
 */
const entryArb: fc.Arbitrary<Entry> = fc.record({
    amount: fc.integer({ min: 1, max: 200_000 }),
    reversed: fc.boolean(),
});

// maxLength with no minLength includes the empty ledger (Requirement 1.6).
const entriesArb = fc.array(entryArb, { maxLength: 12 });

/**
 * Net_Payable is either an arbitrary rupee amount carrying paise (recorded
 * Payout figures go through roundMoney, so paise are real), or the marker
 * 'exact' meaning "exactly Settled_To_Date" — the equality boundary of
 * Requirements 12.3 and 5.7.
 */
const netPayableArb: fc.Arbitrary<number | 'exact'> = fc.oneof(
    fc.constant('exact' as const),
    fc.integer({ min: 0, max: 3_000_000 }).map((paise) => paise / 100),
);

/**
 * Flatten entries into the row list a real read would hand the fold: each
 * settlement row, plus a reversal row naming it where one exists. `rotation`
 * shifts the row order, since a real read is newest-first and the fold must not
 * depend on a reversal arriving after its target.
 */
function buildRows(entries: Entry[], rotation: number): Row[] {
    const rows: Row[] = [];
    entries.forEach((entry, i) => {
        const id = `entry-${i}`;
        rows.push({ _id: id, settledAmount: entry.amount, isReversalOf: null });
        if (entry.reversed) {
            rows.push({ _id: `reversal-${i}`, settledAmount: -entry.amount, isReversalOf: id });
        }
    });
    if (rows.length === 0) return rows;
    const offset = rotation % rows.length;
    return [...rows.slice(offset), ...rows.slice(0, offset)];
}

describe('Property 1: Ledger conservation', () => {
    it('settled + outstanding reconstruct Net_Payable for any row sequence', () => {
        fc.assert(
            fc.property(
                entriesArb,
                fc.nat({ max: 30 }),
                netPayableArb,
                (entries, rotation, netPayableMode) => {
                    const rows = buildRows(entries, rotation);

                    // Recomputed independently: only entries the generator left
                    // un-reversed are effective (Requirement 12.2).
                    const expectedSettled = entries
                        .filter((e) => !e.reversed)
                        .reduce((sum, e) => sum + e.amount, 0);

                    const netPayable =
                        netPayableMode === 'exact' ? expectedSettled : netPayableMode;

                    const ledger = settlementService.buildLedger(rows, netPayable);

                    // Settled_To_Date is the sum of the effective rows, nothing else.
                    expect(ledger.settledToDate).toBe(expectedSettled);

                    // Outstanding_Amount is Net_Payable − Settled_To_Date, floored
                    // at zero; the excess is reported separately (Requirement 1.7, 5.6).
                    expect(ledger.outstandingAmount).toBeCloseTo(
                        toPaise2(Math.max(0, netPayable - expectedSettled)), 6,
                    );
                    expect(ledger.excessAmount).toBeCloseTo(
                        toPaise2(Math.max(0, expectedSettled - netPayable)), 6,
                    );

                    // Conservation, except when over-settled (Requirement 12.3).
                    if (ledger.state !== 'over_settled') {
                        expect(
                            Math.abs(ledger.settledToDate + ledger.outstandingAmount - netPayable),
                        ).toBeLessThanOrEqual(EPSILON);
                    }
                },
            ),
            {
                numRuns: 50,
                examples: [
                    // Empty ledger, nothing due (Requirements 1.6, 1.7).
                    [[], 0, 'exact' as const],
                    // Empty ledger against a real payout: outstanding == Net_Payable.
                    [[], 0, 5000],
                    // Exact equality: Settled_To_Date == Net_Payable (Requirement 12.3).
                    [[{ amount: 1000, reversed: false }], 0, 'exact' as const],
                    // Every entry reversed: the pairs net out to zero (Requirement 1.6).
                    [[{ amount: 1000, reversed: true }], 0, 'exact' as const],
                    // Reversed pair alongside an effective entry, rotated order.
                    [
                        [
                            { amount: 2500, reversed: true },
                            { amount: 1500, reversed: false },
                        ],
                        2,
                        1500,
                    ],
                ],
            },
        );
    });
});
