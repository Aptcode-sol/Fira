/**
 * Feature: venue-booking-payment-schedule — refund base under the Cancellation_Policy.
 *
 * Under test: `venueService.computeRefund(paymentSchedule, totalAmount, refundPercentage)`
 * — the pure helper that `processCancellation` calls for the refund math. Isolating
 * it means Property 7 runs without Mongo (no Booking.findById / Venue.findById /
 * findByIdAndUpdate), while keeping ONE source of truth: the same function the
 * cancellation path uses.
 *
 * Property 7 (Refund Base Amount Correctness): the refunded amount equals
 * refundPercentage/100 × amountPaid, where amountPaid is:
 *   - installment + balanceStatus 'paid'  ⇒ roundMoney(deposit + balance)
 *   - installment + balanceStatus not 'paid' ⇒ roundMoney(deposit)
 *   - full                                ⇒ roundMoney(deposit || total)
 *
 * The expected amountPaid is recomputed here independently of the helper (plain
 * branch over the generated schedule), so a helper that mis-handles a status
 * cannot agree by construction.
 *
 * Validates: Requirements 6.1, 6.2 — Correctness Property 7.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const venueService = require('../services/venueService');
const { roundMoney } = require('../utils/money');

const { computeRefund } = venueService;

// --- generators ------------------------------------------------------------

// Rupee amounts in paise increments so the rounding convention is exercised.
const money = fc.integer({ min: 0, max: 100_000_000 }).map((paise) => paise / 100);
const positiveMoney = fc.integer({ min: 100, max: 100_000_000 }).map((paise) => paise / 100);

// The four balanceStatus values the schema allows.
const balanceStatus = fc.constantFrom(
  'not_applicable',
  'pending',
  'paid',
  'forfeited'
);

// Refund percentage as used by the policy tiers: 0..100 (full=100, partial=any).
const refundPercentage = fc.integer({ min: 0, max: 100 });

// --- Property 7 ------------------------------------------------------------

describe('Property 7 — refund base = pct × amountPaid', () => {
  it('installment + balanceStatus paid ⇒ amountPaid === roundMoney(deposit + balance)', () => {
    fc.assert(
      fc.property(money, money, positiveMoney, refundPercentage, (deposit, balance, total, pct) => {
        const schedule = { type: 'installment', depositAmount: deposit, balanceAmount: balance, balanceStatus: 'paid' };
        const { amountPaid, refundAmount } = computeRefund(schedule, total, pct);

        expect(amountPaid).toBe(roundMoney(deposit + balance));
        expect(refundAmount).toBe(roundMoney(amountPaid * pct / 100));
      }),
      { numRuns: 300 }
    );
  });

  it("installment + balanceStatus not 'paid' ⇒ amountPaid === roundMoney(deposit)", () => {
    fc.assert(
      fc.property(
        money,
        money,
        positiveMoney,
        refundPercentage,
        fc.constantFrom('not_applicable', 'pending', 'forfeited'),
        (deposit, balance, total, pct, status) => {
          const schedule = { type: 'installment', depositAmount: deposit, balanceAmount: balance, balanceStatus: status };
          const { amountPaid, refundAmount } = computeRefund(schedule, total, pct);

          // Balance not paid ⇒ only the deposit counts, never the balance.
          expect(amountPaid).toBe(roundMoney(deposit));
          expect(refundAmount).toBe(roundMoney(amountPaid * pct / 100));
        }
      ),
      { numRuns: 300 }
    );
  });

  it('full ⇒ amountPaid === roundMoney(deposit || total)', () => {
    fc.assert(
      fc.property(money, positiveMoney, balanceStatus, refundPercentage, (deposit, total, status, pct) => {
        // For a full schedule balanceStatus is irrelevant; deposit is the charge,
        // falling back to total for legacy bookings with no recorded deposit.
        const schedule = { type: 'full', depositAmount: deposit, balanceAmount: 0, balanceStatus: status };
        const { amountPaid, refundAmount } = computeRefund(schedule, total, pct);

        expect(amountPaid).toBe(roundMoney(deposit || total));
        expect(refundAmount).toBe(roundMoney(amountPaid * pct / 100));
      }),
      { numRuns: 300 }
    );
  });

  it('refundAmount === roundMoney(amountPaid × pct / 100) across all schedule shapes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('full', 'installment'),
        money,
        money,
        positiveMoney,
        balanceStatus,
        refundPercentage,
        (type, deposit, balance, total, status, pct) => {
          const schedule = { type, depositAmount: deposit, balanceAmount: balance, balanceStatus: status };

          // Recompute the expected base independently of the helper.
          const expectedPaid =
            type === 'installment'
              ? roundMoney(deposit + (status === 'paid' ? balance : 0))
              : roundMoney(deposit || total);

          const { amountPaid, refundAmount } = computeRefund(schedule, total, pct);

          expect(amountPaid).toBe(expectedPaid);
          expect(refundAmount).toBe(roundMoney(expectedPaid * pct / 100));
        }
      ),
      { numRuns: 500 }
    );
  });
});
