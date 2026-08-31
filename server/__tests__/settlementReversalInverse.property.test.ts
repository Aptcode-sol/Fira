/**
 * Task 3.7 — reversal is the inverse of recording.
 *
 * `settlementService.buildLedger(rows, netPayable)` is pure: it folds signed
 * settlement rows into Settled_To_Date, Outstanding_Amount, the excess, and the
 * Settlement_State. A reversal row names its target through `isReversalOf` and
 * carries the negated amount; the fold skips BOTH halves of the pair, so the
 * pair contributes zero to every later read (Requirement 7.2).
 *
 * The property is stated as a round trip on the fold: take any base ledger,
 * append an entry, then append its reversal — Settled_To_Date is back where it
 * started, and stays neutral no matter what is appended afterwards.
 *
 * Pure helper => no database.
 *
 * Feature: per-listing-settlement-tracking, Property 3: Reversal is the inverse of recording
 * **Validates: Requirements 7.1, 7.2, 9.5**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const settlementService = require('../services/settlementService');

type Row = { _id: string; settledAmount: number; isReversalOf?: string };

/**
 * A ledger segment: each item is one recorded entry that may already have been
 * reversed. Generating the segment as a spec rather than as raw rows keeps `_id`
 * values unique and keeps every reversal row pointing at a real target — the
 * only shapes the store can hold.
 */
const segmentSpec = (maxLength: number) =>
  fc.array(
    fc.record({
      // whole rupees, as stored (Requirement 4.6)
      amount: fc.integer({ min: 1, max: 500_000 }),
      reversed: fc.boolean(),
    }),
    { maxLength },
  );

type SegmentSpec = ReadonlyArray<{ amount: number; reversed: boolean }>;

function expand(spec: SegmentSpec, prefix: string): Row[] {
  const rows: Row[] = [];
  spec.forEach(({ amount, reversed }, i) => {
    const id = `${prefix}${i}`;
    rows.push({ _id: id, settledAmount: amount });
    if (reversed) {
      rows.push({ _id: `${id}r`, settledAmount: -amount, isReversalOf: id });
    }
  });
  return rows;
}

// Net_Payable comes from recorded Payout figures, so it may carry paise.
const NET_PAYABLE = fc.oneof(
  fc.integer({ min: 0, max: 5_000_000 }),
  fc.integer({ min: 0, max: 500_000_00 }).map((paise) => paise / 100),
);

describe('buildLedger — Property 3: reversal is the inverse of recording', () => {
  it('recording an entry then reversing it restores Settled_To_Date, and the pair stays neutral under later appends', () => {
    fc.assert(
      fc.property(
        segmentSpec(8),
        segmentSpec(6),
        fc.integer({ min: 1, max: 500_000 }),
        NET_PAYABLE,
        (baseSpec, tailSpec, amount, netPayable) => {
          const base = expand(baseSpec, 'b');
          const tail = expand(tailSpec, 't');
          const entry: Row = { _id: 'x', settledAmount: amount };
          const reversal: Row = { _id: 'xr', settledAmount: -amount, isReversalOf: 'x' };

          // fold 1 — before the entry exists
          const before = settlementService.buildLedger(base, netPayable);
          // fold 2 — the entry is recorded and counts in full
          const recorded = settlementService.buildLedger([...base, entry], netPayable);
          // fold 3 — the entry is reversed
          const reversed = settlementService.buildLedger([...base, entry, reversal], netPayable);

          // recording moves Settled_To_Date by exactly the recorded amount...
          expect(recorded.settledToDate).toBe(before.settledToDate + amount);
          // ...and reversing it puts every derived figure back where it was.
          expect(reversed).toEqual(before);

          // The reversed pair contributes zero to every subsequent read: rows
          // appended after it fold to the same result as if the pair were never
          // there at all.
          const withTail = settlementService.buildLedger(
            [...base, entry, reversal, ...tail],
            netPayable,
          );
          const withoutPair = settlementService.buildLedger([...base, ...tail], netPayable);
          expect(withTail).toEqual(withoutPair);
        },
      ),
      { numRuns: 50 },
    );
  });
});
