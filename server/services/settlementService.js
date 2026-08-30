// @ts-check

// settlementService — the per-listing settlement ledger. It owns the ledger
// fold, the over-settlement guard, the audit write, and the admin/owner
// projections. It reads money figures through earningsService.getListingFigures
// and never recomputes money a second way (Requirement 12.1).
//
// Layout mirrors earningsService: pure helpers first (no Mongo, so the
// arithmetic is exercisable by settlementService.check.mjs and by property tests
// without a database), DB readers/writers after.
//
// This module is built method-by-method per the spec tasks. Task 3.1 adds
// buildLedger; 3.2 the guard and request validation; 3.3 the two row
// projections; 5.1–5.3 the DB methods.

const { roundMoney } = require('../utils/money');

// Every money comparison uses the same tolerance earningsService.buildOverview
// uses for its reconciliation residual: rupee figures are stored to paise, so
// anything inside one paise is the same amount (Requirements 5.7, 12.3).
const EPSILON = 0.01;

/** @typedef {'not_settled'|'partially_settled'|'fully_settled'|'over_settled'} SettlementState */

const settlementService = {
    EPSILON,

    // --- pure ---

    /**
     * Fold a listing's settlement rows into the derived ledger figures
     * (Requirements 1.1, 1.6, 1.7, 4.2, 12.2, 12.3).
     *
     * Settled_To_Date is solely the sum of effective `settledAmount` values
     * (Requirement 12.2). A reversal row (one carrying `isReversalOf`) and the
     * row it targets both contribute zero, so the pair nets out (Requirement
     * 7.2). Skipping both rows rather than relying on the reversal's negative
     * amount cancelling its target means a stored amount that does not mirror
     * its target exactly still cannot shift the total.
     *
     * Outstanding_Amount is floored at zero, and the excess is reported
     * separately, so an over-settled listing shows ₹0 outstanding alongside a
     * distinct excess figure rather than a negative balance (Requirement 5.6).
     *
     * Fails closed on a non-finite netPayable or a non-finite `settledAmount`,
     * exactly like the existing earningsService build* helpers: a corrupt field
     * must not become a settlement basis (Requirement 12.5).
     *
     * @param {Array<{ _id?: any, settledAmount?: number, isReversalOf?: any }>} rows
     * @param {number} netPayable
     * @returns {{ settledToDate: number, outstandingAmount: number, excessAmount: number, state: SettlementState }}
     */
    buildLedger(rows, netPayable) {
        if (!Array.isArray(rows)) {
            throw new Error('settlement rows must be an array; refusing to return a partial ledger');
        }
        if (typeof netPayable !== 'number' || !Number.isFinite(netPayable)) {
            throw new Error('netPayable is missing or not a finite number; refusing to return a partial ledger');
        }

        // Which rows have been reversed. A reversal row names its target, so one
        // pass over the rows is enough to know both halves of every pair.
        const reversedTargets = new Set();
        for (const row of rows) {
            if (row && row.isReversalOf != null) reversedTargets.add(String(row.isReversalOf));
        }

        let settledToDate = 0;
        for (const row of rows) {
            if (!row) continue;
            const amount = row.settledAmount;
            if (typeof amount !== 'number' || !Number.isFinite(amount)) {
                throw new Error('settlement row "settledAmount" is missing or not a finite number; refusing to return a partial ledger');
            }
            // The reversal row itself, and the row it targets, both contribute zero.
            if (row.isReversalOf != null) continue;
            if (reversedTargets.has(String(row._id))) continue;
            settledToDate += amount;
        }

        // Rupee figures are stored to paise; rounding the running sum strips the
        // binary-float dust so two callers folding the same rows get the same
        // number (Requirement 9.9).
        settledToDate = roundMoney(settledToDate);
        const outstandingAmount = roundMoney(Math.max(0, netPayable - settledToDate));
        const excessAmount = roundMoney(Math.max(0, settledToDate - netPayable));

        return {
            settledToDate,
            outstandingAmount,
            excessAmount,
            state: settlementState(settledToDate, netPayable),
        };
    },
};

/**
 * The Settlement_State lattice, every comparison inside EPSILON.
 *
 * Zero is checked first so a listing whose only entries have all been reversed
 * reads as `not_settled` (Requirement 1.6), and so a listing with no payout due
 * and nothing settled is not reported as `fully_settled` (Requirement 1.7).
 * Exact equality with Net_Payable is `fully_settled`, not `over_settled`
 * (Requirement 5.7).
 *
 * @param {number} settledToDate
 * @param {number} netPayable
 * @returns {SettlementState}
 */
function settlementState(settledToDate, netPayable) {
    if (Math.abs(settledToDate) <= EPSILON) return 'not_settled';
    if (settledToDate > netPayable + EPSILON) return 'over_settled';
    if (Math.abs(settledToDate - netPayable) <= EPSILON) return 'fully_settled';
    return 'partially_settled';
}

module.exports = settlementService;
