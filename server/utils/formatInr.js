// @ts-check

// Canonical INR formatter for the payout/earnings surfaces. The client
// (client/src/lib/formatInr.ts) and admin (admin/src/lib/formatInr.js) keep
// byte-identical mirrors of this so the same recorded amount renders as the
// same string on every surface (Requirement 9.2). If this changes, update both.
//
// Amounts are stored as integer rupees, so there is never a paise portion
// (Requirement 9.1). maximumFractionDigits: 0 also floors any stray fraction.

// ponytail: single module-level formatter instance — Intl.NumberFormat is the
// platform's Indian-grouping ("₹12,34,567") + ₹ symbol, so we don't hand-roll
// grouping. Ceiling: relies on the runtime's ICU en-IN data; every surface
// here runs on modern ICU that emits the "₹" prefix with no separator.
const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

/**
 * Format an integer-rupee amount as an Indian-grouped INR string.
 *
 * Absent, null, undefined, or non-finite input renders as `₹0` rather than a
 * blank, error, or non-numeric value (Requirement 9.5).
 *
 * @param {number | null | undefined} amount - integer rupees
 * @returns {string} e.g. `₹12,34,567`, or `₹0` when the amount is unavailable
 */
function formatInr(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return inr.format(0);
    return inr.format(amount);
}

module.exports = { formatInr };
