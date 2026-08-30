// Mirror of the canonical INR formatter in server/utils/formatInr.js. Kept
// behavior-identical so the same recorded amount renders as the same string on
// every surface (Requirement 9.2). If server logic changes, update this and
// client/src/lib/formatInr.ts too.

// ponytail: single module-level formatter — Intl gives Indian grouping
// ("₹12,34,567") and the ₹ symbol; amounts are integer rupees so there is no
// paise portion (Requirement 9.1).
const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

/**
 * Format an integer-rupee amount as an Indian-grouped INR string.
 * Absent, null, undefined, or non-finite input renders as `₹0` (Requirement 9.5).
 *
 * @param {number | null | undefined} amount - integer rupees
 * @returns {string} e.g. `₹12,34,567`, or `₹0` when the amount is unavailable
 */
export function formatInr(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return inr.format(0);
    return inr.format(amount);
}
