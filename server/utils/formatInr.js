// @ts-check

// Canonical INR formatter for the payout/earnings surfaces. The client
// (client/src/lib/formatInr.ts) and admin (admin/src/lib/formatInr.js) keep
// byte-identical mirrors of this so the same recorded amount renders as the
// same string on every surface (Requirement 9.2). If this changes, update both.
//
// Amounts are rupees rounded to paise (see utils/money.js roundMoney), so the
// paise portion is always shown: exactly two fraction digits, never truncated.
// Fixing both min and max at 2 keeps "₹1,000.00" and "₹29.97" the same shape, so
// a column of amounts lines up on the decimal point.

// ponytail: single module-level formatter instance — Intl.NumberFormat is the
// platform's Indian-grouping ("₹12,34,567.00") + ₹ symbol, so we don't hand-roll
// grouping. Ceiling: relies on the runtime's ICU en-IN data; every surface
// here runs on modern ICU that emits the "₹" prefix with no separator.
const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Format a rupee amount as an Indian-grouped INR string with paise.
 *
 * Absent, null, undefined, or non-finite input renders as `₹0.00` rather than a
 * blank, error, or non-numeric value (Requirement 9.5).
 *
 * @param {number | null | undefined} amount - rupees, to two decimals
 * @returns {string} e.g. `₹12,34,567.00`, or `₹0.00` when the amount is unavailable
 */
function formatInr(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return inr.format(0);
    return inr.format(amount);
}

module.exports = { formatInr };
