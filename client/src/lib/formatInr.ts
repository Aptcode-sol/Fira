// Mirror of the canonical INR formatter in server/utils/formatInr.js. Kept
// byte-identical in behavior so the same recorded amount renders as the same
// string on every surface (Requirement 9.2). If server logic changes, update
// this and admin/src/lib/formatInr.js too.

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
 */
export function formatInr(amount: number | null | undefined): string {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return inr.format(0);
    return inr.format(amount);
}

/**
 * Round a rupee amount to paise. Mirror of server/utils/money.js `roundMoney` —
 * the client previews the same billing lines the server charges, so both sides
 * have to round the same way or the preview and the invoice disagree.
 */
export function roundMoney(value: number | null | undefined): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100 * (1 + Number.EPSILON)) / 100;
}
