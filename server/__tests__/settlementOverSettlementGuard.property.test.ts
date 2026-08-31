/**
 * Task 3.8 — the over-settlement guard.
 *
 * `settlementService.checkOverSettlement(...)` is a pure decision: no Mongo, no
 * clock, no listing lookup. So the whole guard is exercisable by calling it with
 * generated figures — a database adds nothing to what is under test here.
 *
 * SCOPE. Property 5 also states that an accepted override produces an entry
 * FLAGGED as an over-settlement which STORES the override reason. That half is
 * the DB layer's (task 5.2 `recordEntry`), which does not exist yet, so it is
 * not asserted here. What is asserted is the guard's decision: which requests
 * are accepted, which are refused, and what each refusal reports. The "no entry
 * is created" half of the statement holds structurally for a function that
 * cannot write — checked here as purity: the guard returns the same answer twice
 * and never mutates its input.
 *
 * The expected-decision model below re-derives the three rejection shapes from
 * the acceptance criteria (5.2, 5.4, 5.5) in the order the design's error table
 * fixes, and compares the projected total at the service's own one-paise
 * tolerance — a paise of float dust in a recorded `Payout.netAmount` must not
 * turn a full settlement into a rejection (Requirement 5.7).
 *
 * Feature: per-listing-settlement-tracking, Property 5: The over-settlement guard is exact
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const settlementService = require('../services/settlementService');
const { roundMoney } = require('../utils/money');

const EPSILON: number = settlementService.EPSILON;

/** Every Admin_Role the session can carry, plus an absent one. */
const ADMIN_ROLES = ['super_admin', 'admin', 'moderator', undefined] as const;
/** The override flag as the request can carry it. */
const OVERRIDES = [true, false, undefined] as const;
/** Reasons: supplied, blank, whitespace-only, absent (Requirement 5.5). */
const REASONS = ['Owner underpaid last cycle', '', '   ', undefined] as const;

type Params = {
  settledToDate: number;
  netPayable: number;
  settledAmount: number;
  override?: boolean;
  adminRole?: string;
  overrideReason?: string;
};

/** A whitespace-only reason is as absent as a missing one (Requirement 5.5). */
const filled = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

/**
 * The decision the acceptance criteria call for, derived independently of the
 * service's control flow: an override is honoured only for a `super_admin`
 * carrying a reason (5.3, 5.4, 5.5); with no honoured override the request is
 * accepted exactly when the projected total does not exceed Net_Payable, with
 * exact equality accepted (5.1, 5.2, 5.7).
 */
function expectedDecision(p: Params) {
  if (p.override) {
    if (p.adminRole !== 'super_admin') return { allowed: false, status: 403, code: 'override_forbidden' };
    if (!filled(p.overrideReason)) return { allowed: false, status: 400, code: 'invalid_override' };
    return { allowed: true };
  }
  const projected = roundMoney(p.settledToDate + p.settledAmount);
  if (projected - p.netPayable > EPSILON) return { allowed: false, status: 409, code: 'over_settlement' };
  return { allowed: true };
}

/** Net_Payable as recorded: zero, whole rupees, or carrying paise. */
const NET_PAYABLE = fc.oneof(
  fc.constant(0),
  fc.integer({ min: 1, max: 5_000_000 }),
  fc.integer({ min: 1, max: 5_000_000 }).map((n) => roundMoney(n + 0.5)),
  fc
    .tuple(fc.integer({ min: 1, max: 5_000_000 }), fc.integer({ min: 1, max: 99 }))
    .map(([n, paise]) => roundMoney(n + paise / 100)),
);

/**
 * How the requested amount sits against the remaining headroom. `exact` is the
 * boundary Requirement 5.7 names; `wholeRupeeUnder` / `wholeRupeeOver` are the
 * whole-rupee transfer against a paise-carrying Net_Payable; `onePaiseOver` is
 * the smallest overshoot the tolerance must still catch.
 */
const AMOUNT_SHAPES = {
  exact: (remaining: number) => remaining,
  half: (remaining: number) => roundMoney(remaining / 2),
  wholeRupeeUnder: (remaining: number) => Math.floor(remaining),
  wholeRupeeOver: (remaining: number) => Math.ceil(remaining),
  onePaiseOver: (remaining: number) => roundMoney(remaining + 0.01),
  oneRupeeOver: (remaining: number) => remaining + 1,
  farOver: (remaining: number) => remaining + 100_000,
} as const;

const SCENARIO: fc.Arbitrary<Params> = NET_PAYABLE.chain((netPayable) =>
  fc
    .tuple(
      // Settled_To_Date: nothing yet, part of the way, exactly there, or already past it.
      fc.oneof(
        fc.constant(0),
        fc.integer({ min: 1, max: 5_000_000 }).map((n) => roundMoney(Math.min(n, netPayable))),
        fc.constant(netPayable),
        fc.integer({ min: 1, max: 100_000 }).map((excess) => roundMoney(netPayable + excess)),
      ),
      fc.constantFrom(...(Object.keys(AMOUNT_SHAPES) as Array<keyof typeof AMOUNT_SHAPES>)),
      fc.constantFrom(...OVERRIDES),
      fc.constantFrom(...ADMIN_ROLES),
      fc.constantFrom(...REASONS),
    )
    .map(([settledToDate, shape, override, adminRole, overrideReason]) => {
      const remaining = roundMoney(netPayable - settledToDate);
      // A settlement is always a positive transfer (Requirement 4.7), so a
      // shape that lands at or below zero headroom is clamped to ₹1 — which is
      // itself an over-settlement, and the model above decides it as one.
      const settledAmount = Math.max(1, roundMoney(AMOUNT_SHAPES[shape](remaining)));
      return { settledToDate, netPayable, settledAmount, override, adminRole, overrideReason };
    }),
);

describe('checkOverSettlement — Property 5: the over-settlement guard is exact', () => {
  it('accepts exactly the requests the criteria allow, and reports the figures on every refusal', () => {
    fc.assert(
      fc.property(SCENARIO, (params) => {
        const frozen = Object.freeze({ ...params });
        const result = settlementService.checkOverSettlement(frozen);
        const expected = expectedDecision(params);

        expect(result.allowed).toBe(expected.allowed);

        if (expected.allowed) {
          // An accepted request carries nothing but the verdict.
          expect(result).toEqual({ allowed: true });

          // Cross-check against the ledger fold: a request accepted with no
          // override must not leave the listing over-settled, or the guard
          // would be waving through the very state it exists to gate.
          if (!params.override) {
            const ledger = settlementService.buildLedger(
              [
                { _id: 'prior', settledAmount: params.settledToDate },
                { _id: 'new', settledAmount: params.settledAmount },
              ],
              params.netPayable,
            );
            expect(ledger.state).not.toBe('over_settled');
          }
        } else {
          expect(result.status).toBe(expected.status);
          expect(result.code).toBe(expected.code);
          expect(typeof result.error).toBe('string');
          expect(result.error.length).toBeGreaterThan(0);

          if (expected.code === 'over_settlement') {
            // The refusal reports Net_Payable, Settled_To_Date and the maximum
            // recordable amount (Requirement 5.2).
            expect(result.netPayable).toBe(roundMoney(params.netPayable));
            expect(result.settledToDate).toBe(roundMoney(params.settledToDate));
            expect(result.maxRecordable).toBe(roundMoney(Math.max(0, params.netPayable - params.settledToDate)));
            expect(result.maxRecordable).toBeGreaterThanOrEqual(0);
            // What it says can be recorded is actually recordable.
            if (result.maxRecordable > 0) {
              expect(
                settlementService.checkOverSettlement({ ...params, override: false, settledAmount: result.maxRecordable }).allowed,
              ).toBe(true);
            }
            // And the request it refused really would have over-settled.
            const wouldBe = settlementService.buildLedger(
              [
                { _id: 'prior', settledAmount: params.settledToDate },
                { _id: 'new', settledAmount: params.settledAmount },
              ],
              params.netPayable,
            );
            expect(wouldBe.state).toBe('over_settled');
          } else {
            // 403 / 400 are decisions about the override itself, so they carry
            // no money figures.
            expect(result.netPayable).toBeUndefined();
            expect(result.maxRecordable).toBeUndefined();
          }
        }

        // Pure: same answer twice, and the request object is untouched — the
        // guard decides, it never records (Requirement 4.11).
        expect(settlementService.checkOverSettlement(frozen)).toEqual(result);
        expect(frozen).toEqual(params);
      }),
      { numRuns: 50 },
    );
  });

  it('covers every adminRole x override x reason pairing, at the exact boundary and one rupee past it', () => {
    const netPayable = 10_000;
    const settledToDate = 4_000;
    const remaining = netPayable - settledToDate; // 6000

    for (const adminRole of ADMIN_ROLES) {
      for (const override of OVERRIDES) {
        for (const overrideReason of REASONS) {
          for (const settledAmount of [remaining, remaining + 1]) {
            const params = { settledToDate, netPayable, settledAmount, override, adminRole, overrideReason };
            const result = settlementService.checkOverSettlement(params);
            const expected = expectedDecision(params);
            expect(
              { allowed: result.allowed, code: result.code },
              `role=${adminRole} override=${override} reason=${JSON.stringify(overrideReason)} amount=${settledAmount}`,
            ).toEqual({ allowed: expected.allowed, code: expected.code });
          }
        }
      }
    }
  });

  it('accepts exact equality with no override, and a paise-carrying Net_Payable settled by whole rupees', () => {
    // Settling to the rupee is the normal end state (Requirement 5.7).
    expect(settlementService.checkOverSettlement({ settledToDate: 4_000, netPayable: 10_000, settledAmount: 6_000 })).toEqual({
      allowed: true,
    });
    // A paise-carrying Net_Payable, settled by a whole-rupee transfer that
    // leaves the paise behind: accepted, with no override.
    expect(settlementService.checkOverSettlement({ settledToDate: 0, netPayable: 5_000.5, settledAmount: 5_000 })).toEqual({
      allowed: true,
    });
    // The same figures one rupee up overshoot by ₹0.50, which is past the
    // one-paise tolerance, so the guard refuses and says what fits.
    expect(settlementService.checkOverSettlement({ settledToDate: 0, netPayable: 5_000.5, settledAmount: 5_001 })).toMatchObject({
      allowed: false,
      status: 409,
      code: 'over_settlement',
      netPayable: 5_000.5,
      settledToDate: 0,
      maxRecordable: 5_000.5,
    });
  });

  it('refuses an override from a non-super-admin even when the amount fits, and one with no reason', () => {
    // The flag alone is unauthorized, regardless of the arithmetic (Req 5.4).
    expect(
      settlementService.checkOverSettlement({
        settledToDate: 0,
        netPayable: 10_000,
        settledAmount: 100,
        override: true,
        adminRole: 'admin',
        overrideReason: 'Owner underpaid last cycle',
      }),
    ).toMatchObject({ allowed: false, status: 403, code: 'override_forbidden' });

    // A super admin with a blank reason cannot record an undocumented
    // overpayment (Requirement 5.5).
    expect(
      settlementService.checkOverSettlement({
        settledToDate: 0,
        netPayable: 10_000,
        settledAmount: 25_000,
        override: true,
        adminRole: 'super_admin',
        overrideReason: '   ',
      }),
    ).toMatchObject({ allowed: false, status: 400, code: 'invalid_override', field: 'overrideReason' });

    // With a reason, the excess is deliberate and documented (Requirement 5.3).
    expect(
      settlementService.checkOverSettlement({
        settledToDate: 0,
        netPayable: 10_000,
        settledAmount: 25_000,
        override: true,
        adminRole: 'super_admin',
        overrideReason: 'Owner underpaid last cycle',
      }),
    ).toEqual({ allowed: true });
  });

  it('fails closed on a non-finite figure rather than waving a transfer through', () => {
    for (const bad of [NaN, Infinity, undefined, null, '5000']) {
      expect(() =>
        settlementService.checkOverSettlement({ settledToDate: 0, netPayable: 10_000, settledAmount: bad as any }),
      ).toThrow();
      expect(() =>
        settlementService.checkOverSettlement({ settledToDate: bad as any, netPayable: 10_000, settledAmount: 100 }),
      ).toThrow();
    }
  });
});
