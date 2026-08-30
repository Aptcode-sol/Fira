// Mirror of the canonical INR formatter in server/utils/formatInr.js. Kept
// byte-identical in behavior so the same recorded amount renders as the same
// string on every surface (Requirement 9.2). If server logic changes, update
// this and admin/src/lib/formatInr.js too.

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
 */
export function formatInr(amount: number | null | undefined): string {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return inr.format(0);
    return inr.format(amount);
}
