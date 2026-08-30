// ponytail check for formatInr (design Property 15, Requirements 9.1/9.2/9.5).
// No framework, no fixtures — run with: node utils/formatInr.check.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { formatInr } = require('./formatInr.js');

// ₹ prefix, Indian grouping (thousands → lakhs → crores), always two paise digits
assert.equal(formatInr(0), '\u20B90.00');
assert.equal(formatInr(1234567), '\u20B912,34,567.00');
assert.equal(formatInr(123456), '\u20B91,23,456.00');
assert.equal(formatInr(100000000), '\u20B910,00,00,000.00'); // 10 crore

// equals Intl.NumberFormat('en-IN', …) for the amount + determinism (9.2)
const ref = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
for (const n of [0, 5, 999, 1000, 29.97, 250000, 9876543210]) {
    assert.equal(formatInr(n), ref.format(n));
    assert.equal(formatInr(n), formatInr(n)); // deterministic
}

// absent / null / undefined / non-finite → ₹0.00, never blank/error (9.5)
assert.equal(formatInr(null), '\u20B90.00');
assert.equal(formatInr(undefined), '\u20B90.00');
assert.equal(formatInr(), '\u20B90.00');
assert.equal(formatInr(NaN), '\u20B90.00');
assert.equal(formatInr(Infinity), '\u20B90.00');

// The regression this guards: paise used to be dropped on display, so ₹29.97 of
// platform fee was shown to the organiser as ₹30.
assert.equal(formatInr(29.97), '\u20B929.97');
assert.equal(formatInr(1234.5), '\u20B91,234.50');
assert.equal(formatInr(0.5), '\u20B90.50');

// Every amount carries a decimal point, so a column of figures aligns.
for (const n of [0, 1, 29.97, 1000]) assert.ok(formatInr(n).includes('.'));

console.log('formatInr check: all assertions passed');
