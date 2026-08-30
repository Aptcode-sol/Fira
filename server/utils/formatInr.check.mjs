// ponytail check for formatInr (design Property 15, Requirements 9.1/9.2/9.5).
// No framework, no fixtures — run with: node utils/formatInr.check.mjs
// The formal property test is task 1.2; this is the minimum runnable guard.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { formatInr } = require('./formatInr.js');

// ₹ prefix, Indian grouping (thousands → lakhs → crores), no paise (9.1)
assert.equal(formatInr(0), '\u20B90');
assert.equal(formatInr(1234567), '\u20B912,34,567');
assert.equal(formatInr(123456), '\u20B91,23,456');
assert.equal(formatInr(100000000), '\u20B910,00,00,000'); // 10 crore

// equals Intl.NumberFormat('en-IN', …) for the amount (9.1) + determinism (9.2)
const ref = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
for (const n of [0, 5, 999, 1000, 250000, 9876543210]) {
    assert.equal(formatInr(n), ref.format(n));
    assert.equal(formatInr(n), formatInr(n)); // deterministic
}

// absent / null / undefined / non-finite → ₹0, never blank/error (9.5)
assert.equal(formatInr(null), '\u20B90');
assert.equal(formatInr(undefined), '\u20B90');
assert.equal(formatInr(), '\u20B90');
assert.equal(formatInr(NaN), '\u20B90');
assert.equal(formatInr(Infinity), '\u20B90');

// no fractional/paise portion even if a stray fraction sneaks in (9.1)
assert.ok(!formatInr(1234.56).includes('.'));

console.log('formatInr check: all assertions passed');
