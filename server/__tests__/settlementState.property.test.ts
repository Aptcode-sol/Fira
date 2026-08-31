/**
 * Task 3.6 — the Settlement_State classification on the ledger fold.
 *
 * `settlementService.buildLedger(rows, netPayable)` is pure: no Mongo, no
 * clock, no listing lookup. So the whole state lattice is exercisable by
 * folding hand-built row sets — the DB adds nothing to what is under test here.
 *
 * The state is asserted as a TOTAL and MUTUALLY EXCLUSIVE classification: for
 * every (Settled_To_Date, Net_Payable) pair, exactly one of the four defining
 * conditions holds, and the returned state is that one. Every comparison uses
 * the service's own one-paise tolerance, so a paise-carrying Net_Payable
 * (recorded `Payout.netAmount` goes through `roundMoney`) settled by a
 * whole-rupee transfer still reads as `fully_settled` rather than
 * `over_settled` (Requirement 5.7).
 *
 * Generators deliberately cover every state plus the two boundaries the
 * requirements call out: exact equality with Net_Payable (`fully_settled`, not
 * `over_settled` — Requirement 5.7) and a Net_Payable of zero, where nothing
 * settled is `not_settled` (Requirement 1.7) and anything settled is
 * `over_settled` (Requirement 5.6). A ledger whose only entries have all been
 * reversed is generated too, since it must read as `not_settled` (Requirement
 * 1.6) rather than as a settled-then-cancelled state.
 *
 * Feature: per-listing-settlement-tracking, Property 2: Settlement state is a total classification
 * Validates: Requirements 1.1, 5.6, 5.7
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const settlementService = require('../services/settlementService');
const { roundMoney } = require('../utils/money');

const EPSILON: number = settlementService.EPSILON;
const STATES = ['not_settled', 'partially_settled', 'fully_settled', 'over_settled'] as const;

type Row = { _id?: string; settledAmount: number; isReversalOf?: string };
/** A folded scenario plus the Settled_To_Date it is built to produce. */
type Scenario = { rows: Row[]; netPayable: number; settled: number; label: string };

/** Net_Payable as recorded: zero, whole rupees, or carrying paise. */
const NET_PAYABLE = fc.oneof(
  fc.constant(0),
  fc.integer({ min: 1, max: 5_000_000 }),
  fc.integer({ min: 1, max: 5_000_000 }).map((n) => n + 0.5),
);

const entry = (settledAmount: number, id = 'e1'): Row => ({ _id: id, settledAmount });

const SCENARIO: fc.Arbitrary<Scenario> = fc.oneof(
  // not_settled — no entries at all (Requirement 1.6).
  NET_PAYABLE.map((netPayable) => ({ rows: [], netPayable, settled: 0, label: 'empty ledger' })),

  // not_settled — every entry reversed, so the pairs net out (Requirement 1.6).
  fc.tuple(NET_PAYABLE, fc.integer({ min: 1, max: 5_000_000 })).map(([netPayable, amount]) => ({
    rows: [entry(amount), { _id: 'r1', settledAmount: -amount, isReversalOf: 'e1' }],
    netPayable,
    settled: 0,
    label: 'all entries reversed',
  })),

  // fully_settled — exact equality, no override needed (Requirement 5.7).
  NET_PAYABLE.filter((n) => n > EPSILON).map((netPayable) => ({
    rows: [entry(netPayable)],
    netPayable,
    settled: netPayable,
    label: 'settled exactly to Net_Payable',
  })),

  // fully_settled — inside the one-paise tolerance either side.
  fc
    .tuple(
      fc.integer({ min: 1, max: 5_000_000 }),
      fc.constantFrom(-EPSILON / 2, EPSILON / 2, -EPSILON, EPSILON),
    )
    .map(([netPayable, drift]) => ({
      rows: [entry(netPayable + drift)],
      netPayable,
      settled: netPayable + drift,
      label: 'settled within one paise of Net_Payable',
    })),

  // partially_settled — strictly below Net_Payable.
  fc
    .integer({ min: 2, max: 5_000_000 })
    .chain((netPayable) =>
      fc.integer({ min: 1, max: netPayable - 1 }).map((settled) => ({
        rows: [entry(settled)],
        netPayable,
        settled,
        label: 'settled below Net_Payable',
      })),
    ),

  // partially_settled — spread over several effective entries.
  fc
    .integer({ min: 4, max: 5_000_000 })
    .chain((netPayable) =>
      fc
        .array(fc.integer({ min: 1, max: Math.floor(netPayable / 3) }), { minLength: 2, maxLength: 3 })
        .map((amounts) => ({
          rows: amounts.map((a, i) => entry(a, `e${i}`)),
          netPayable,
          settled: amounts.reduce((sum, a) => sum + a, 0),
          label: 'several entries below Net_Payable',
        })),
    ),

  // over_settled — above Net_Payable, including the zero-Net_Payable case
  // (Requirement 5.6), which NET_PAYABLE's constant(0) branch reaches.
  fc.tuple(NET_PAYABLE, fc.integer({ min: 1, max: 100_000 })).map(([netPayable, excess]) => ({
    rows: [entry(netPayable + excess)],
    netPayable,
    settled: netPayable + excess,
    label: 'settled above Net_Payable',
  })),
);

/**
 * The four defining conditions, straight from the glossary, evaluated at the
 * service's tolerance. Written as independent predicates rather than as an
 * if/else chain so "exactly one holds" is something the test can actually
 * count, not something its own structure assumes.
 *
 * All three comparisons hang off ONE signed difference. Measuring the gap two
 * different ways (`settled - net` here, `net + EPSILON` there) is not the same
 * comparison in binary floating point, and a classification that splits on two
 * different measures of the same gap cannot be total.
 */
function conditionsFor(settled: number, netPayable: number) {
  const nothingSettled = Math.abs(settled) <= EPSILON;
  const diff = settled - netPayable;
  return {
    not_settled: nothingSettled,
    partially_settled: !nothingSettled && diff < -EPSILON,
    fully_settled: !nothingSettled && Math.abs(diff) <= EPSILON,
    over_settled: !nothingSettled && diff > EPSILON,
  };
}

describe('buildLedger — Property 2: settlement state is a total classification', () => {
  it('returns exactly one state per (Settled_To_Date, Net_Payable) pair, with the excess reported only when over-settled', () => {
    fc.assert(
      fc.property(SCENARIO, ({ rows, netPayable, settled }) => {
        const ledger = settlementService.buildLedger(rows, netPayable);

        // The scenario produced the Settled_To_Date it claims — otherwise the
        // classification below would be checked against the wrong pair.
        expect(ledger.settledToDate).toBe(roundMoney(settled));

        // Total: the state is always one of the four named values.
        expect(STATES).toContain(ledger.state);

        // Exclusive: exactly one defining condition holds, and it is the one returned.
        const conditions = conditionsFor(ledger.settledToDate, netPayable);
        const holding = STATES.filter((s) => conditions[s]);
        expect(holding).toEqual([ledger.state]);

        if (ledger.state === 'over_settled') {
          // Excess is the overshoot, and Outstanding is pinned at zero rather
          // than going negative (Requirement 5.6).
          expect(ledger.excessAmount).toBe(roundMoney(ledger.settledToDate - netPayable));
          expect(ledger.outstandingAmount).toBe(0);
        } else {
          // A reported excess and a state other than over_settled cannot both
          // be true of the same ledger: the excess IS the over-settlement.
          expect(ledger.excessAmount).toBe(0);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('classifies the called-out boundaries: exact equality is fully_settled, zero Net_Payable splits on whether anything was settled', () => {
    // Exact equality is fully_settled, never over_settled (Requirement 5.7).
    expect(settlementService.buildLedger([entry(5000)], 5000).state).toBe('fully_settled');
    // Nothing due, nothing settled (Requirement 1.7).
    expect(settlementService.buildLedger([], 0)).toMatchObject({
      settledToDate: 0,
      outstandingAmount: 0,
      excessAmount: 0,
      state: 'not_settled',
    });
    // Nothing due, something settled (Requirement 5.6).
    expect(settlementService.buildLedger([entry(1)], 0)).toMatchObject({
      outstandingAmount: 0,
      excessAmount: 1,
      state: 'over_settled',
    });
  });
});
