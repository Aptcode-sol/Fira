// ponytail check for roundMoney / toPaise. No framework, no fixtures — run with:
//   node utils/money.check.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { roundMoney, toPaise } = require('./money.js');

// The regression this exists for: money used to be rounded to whole rupees, so a
// 3% fee on ₹999 was charged as ₹30 instead of ₹29.97.
assert.equal(roundMoney(29.97), 29.97);
assert.equal(roundMoney(999 * 3 / 100), 29.97);
assert.equal(roundMoney(29.97 * 0.18), 5.39);

// Whole rupees are unchanged, so nothing already correct moves.
for (const n of [0, 1, 50, 999, 1000, 1234567]) assert.equal(roundMoney(n), n);

// Third decimal and beyond is dropped, half rounds up.
assert.equal(roundMoney(1.234), 1.23);
assert.equal(roundMoney(1.235), 1.24);
assert.equal(roundMoney(1.236), 1.24);

// Binary-float half cases: 1.005 * 100 is 100.49999999999999, so a plain
// Math.round(n * 100) would round these *down* and silently lose a paise.
assert.equal(roundMoney(1.005), 1.01);
assert.equal(roundMoney(2.675), 2.68);
assert.equal(roundMoney(8.165), 8.17);

// Negative amounts (a reversal) round symmetrically away from zero on halves.
assert.equal(roundMoney(-29.976), -29.98);

// Non-finite / absent input is 0, never NaN - a NaN would poison every sum it
// touches and there is no safe way to display it.
for (const bad of [null, undefined, NaN, Infinity, -Infinity, 'abc', {}]) {
    assert.equal(roundMoney(bad), 0);
}
assert.equal(roundMoney(), 0);

// Numeric strings are accepted (query params arrive as strings).
assert.equal(roundMoney('29.976'), 29.98);

// Idempotent: rounding a rounded amount changes nothing.
for (const n of [29.97, 1.005, 0.5, 1234.56]) {
    assert.equal(roundMoney(roundMoney(n)), roundMoney(n));
}

// toPaise always yields a whole number - Razorpay rejects fractional paise.
for (const n of [29.97, 1.005, 999, 0, 1234.565]) {
    const paise = toPaise(n);
    assert.ok(Number.isInteger(paise), `${n} → ${paise} must be an integer`);
    assert.equal(paise, Math.round(roundMoney(n) * 100));
}
assert.equal(toPaise(29.97), 2997);
assert.equal(toPaise(1000), 100000);

console.log('money check: all assertions passed');
