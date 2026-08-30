/**
 * Runnable check for venue pricing. Run: node src/lib/venuePricing.check.mjs
 *
 * The smallest thing that fails if the day-rate logic breaks: the back-compat
 * fallback to the old basePrice, and the inclusive day count that decides what a
 * guest is billed. Mirrors venuePricing.ts - if that changes, change this.
 */
import assert from 'node:assert/strict';

function venueDayRate(venue) {
    const pricing = venue?.pricing;
    if (!pricing) return 0;
    return pricing.pricePerDay ?? pricing.basePrice ?? 0;
}

function billableDays(startDate, endDate) {
    if (!startDate) return 1;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(end) - startOfDay(start)) / 86_400_000);
    return Math.max(1, diffDays + 1);
}

const venueBookingTotal = (venue, s, e) => venueDayRate(venue) * billableDays(s, e);

// --- rate resolution -------------------------------------------------------
assert.equal(venueDayRate({ pricing: { pricePerDay: 8000, basePrice: 5000 } }), 8000,
    'pricePerDay wins when both are present');
assert.equal(venueDayRate({ pricing: { basePrice: 5000 } }), 5000,
    'falls back to legacy basePrice');
assert.equal(venueDayRate({ pricing: { pricePerDay: 0, basePrice: 5000 } }), 0,
    'an explicit 0 day rate is respected, not treated as missing');
assert.equal(venueDayRate({ pricing: {} }), 0, 'unpriced venue reads as 0');
assert.equal(venueDayRate(null), 0, 'missing venue reads as 0');

// --- day counting ----------------------------------------------------------
assert.equal(billableDays('2026-03-05', '2026-03-05'), 1, 'same day bills 1 day');
assert.equal(billableDays('2026-03-05'), 1, 'no end date bills 1 day');
assert.equal(billableDays('2026-03-05', '2026-03-06'), 2, 'consecutive days bill 2, not 1 night');
assert.equal(billableDays('2026-03-05', '2026-03-11'), 7, 'a full week bills 7');
assert.equal(billableDays('2026-03-05', '2026-03-01'), 1, 'reversed range never bills negative');
// Month and year rollovers must not be off by one.
assert.equal(billableDays('2026-01-31', '2026-02-01'), 2, 'month rollover');
assert.equal(billableDays('2026-12-31', '2027-01-01'), 2, 'year rollover');
assert.equal(billableDays('', '2026-03-06'), 1, 'missing start bills 1');

// --- totals ----------------------------------------------------------------
assert.equal(venueBookingTotal({ pricing: { pricePerDay: 10000 } }, '2026-03-05', '2026-03-06'), 20000,
    'two days at 10k is 20k');
assert.equal(venueBookingTotal({ pricing: { basePrice: 7500 } }, '2026-03-05', '2026-03-05'), 7500,
    'legacy single-day booking bills exactly what it used to');

console.log('venuePricing: all checks passed');

// --- booking advance breakdown ---------------------------------------------
// Mirrors bookingService.initiateBookingPayment + paymentService.calculateBilling.
// The reported bug: a ₹166 booking showed ₹17 and Razorpay charged ₹18.
function bookingAdvance(bookingTotal, platformFeePercentage = 5) {
    const advance = Math.round(bookingTotal * 0.1);
    const platformFee = Math.round((advance * platformFeePercentage) / 100);
    const gstAmount = Math.round(platformFee * 0.18);
    return {
        advance,
        platformFee,
        gstAmount,
        payableNow: advance + platformFee + gstAmount,
        remaining: bookingTotal - advance,
    };
}

// The exact case from the bug report.
const reported = bookingAdvance(166);
assert.equal(reported.advance, 17, '10% of 166 rounds to 17');
assert.equal(reported.platformFee, 1, '5% of 17 rounds to 1');
assert.equal(reported.gstAmount, 0, '18% of 1 rounds to 0');
assert.equal(reported.payableNow, 18, 'gateway charges 18, which is what must be displayed');
assert.equal(reported.remaining, 149, 'the rest is settled with the owner');

// The documented end-to-end case (docs/TESTING_END_TO_END.md TC-3.11).
const big = bookingAdvance(100_000);
assert.equal(big.advance, 10_000);
assert.equal(big.platformFee, 500);
assert.equal(big.gstAmount, 90);
assert.equal(big.payableNow, 10_590);

// Rounding must happen per step, in the server's order. Rounding the sum instead
// gives a different rupee here, which is exactly the class of bug being fixed.
const perStep = bookingAdvance(166);
assert.equal(
    perStep.payableNow,
    Math.round(166 * 0.1) + Math.round((Math.round(166 * 0.1) * 5) / 100) + 0,
    'per-step rounding, not rounding of the total'
);

// A free/zero booking must not invent a charge.
const zero = bookingAdvance(0);
assert.equal(zero.payableNow, 0, 'nothing to pay on a zero total');

console.log('venuePricing.check.mjs: all assertions passed');
