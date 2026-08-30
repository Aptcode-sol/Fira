// Mirror of the canonical INR formatter in server/utils/formatInr.js. Kept
// behavior-identical so the same recorded amount renders as the same string on
// every surface (Requirement 9.2). If server logic changes, update this and
// client/src/lib/formatInr.ts too.

// ponytail: single module-level formatter — Intl gives Indian grouping
// ("₹12,34,567.00") and the ₹ symbol. Amounts are rupees rounded to paise, so
// both fraction digits are pinned at 2: paise are never hidden, and a column of
// amounts lines up on the decimal point.
const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Format a rupee amount as an Indian-grouped INR string with paise.
 * Absent, null, undefined, or non-finite input renders as `₹0.00` (Requirement 9.5).
 *
 * @param {number | null | undefined} amount - rupees, to two decimals
 * @returns {string} e.g. `₹12,34,567.00`, or `₹0.00` when the amount is unavailable
 */
export function formatInr(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return inr.format(0);
    return inr.format(amount);
}
