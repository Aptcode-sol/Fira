// @ts-check

/**
 * Round a rupee amount to paise — two decimal places.
 *
 * Every money calculation used to `Math.round(...)` to whole rupees, so a 3%
 * platform fee on ₹999 was billed as ₹30 instead of ₹29.97 and the paise were
 * silently absorbed. Rounding to paise is the smallest unit the gateway can
 * actually settle (`amount * 100` in Razorpay's order payload), so two decimals
 * is both what the customer expects to see and what the rail can carry.
 *
 * The `(1 + EPSILON)` nudge is not cosmetic: `1.005 * 100` is 100.49999999999999
 * in binary floating point, so a plain `Math.round(n * 100)` would round a
 * legitimate half-paise *down*. Scaling by one relative ulp first makes halves
 * round up consistently, matching the previous `Math.round` semantics one decimal
 * place over.
 *
 * ponytail: float-with-nudge rather than integer paise or a decimal library.
 * Ceiling: exact for the magnitudes this platform handles (well under 2^53
 * paise); if amounts ever need arbitrary precision or multi-currency, the upgrade
 * path is storing integer paise end to end and dropping this helper.
 *
 * @param {number | string | null | undefined} value
 * @returns {number} the amount rounded to 2 decimals, or 0 when not a finite number
 */
function roundMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100 * (1 + Number.EPSILON)) / 100;
}

/**
 * Convert a rupee amount to the integer paise the payment gateway expects.
 * Rounding to paise first means this is an exact integer, not a re-round.
 *
 * @param {number} rupees
 * @returns {number} integer paise
 */
function toPaise(rupees) {
    return Math.round(roundMoney(rupees) * 100);
}

module.exports = { roundMoney, toPaise };
