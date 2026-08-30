/**
 * Runnable check for formatCount. Run: node src/lib/formatCount.check.mjs
 *
 * The smallest thing that fails if the compact-count logic breaks: boundaries
 * (999/1000, 999999/1000000), the dropped ".0", truncation instead of rounding,
 * and the width cap the card layout depends on.
 *
 * Kept as plain asserts with no framework, matching the other *.check.mjs files
 * in this repo. Mirrors formatCount.ts - if that changes, change this.
 */
import assert from 'node:assert/strict';

function formatCount(value) {
    const count = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    if (count < 1000) return String(count);

    const units = [
        [1_000_000_000, 'B'],
        [1_000_000, 'M'],
        [1_000, 'K'],
    ];

    for (const [size, suffix] of units) {
        if (count >= size) {
            const tenths = Math.floor((count / size) * 10) / 10;
            const text = tenths % 1 === 0 ? tenths.toFixed(0) : tenths.toFixed(1);
            return text + suffix;
        }
    }

    return String(count);
}

const cases = [
    // exact below a thousand
    [0, '0'],
    [3, '3'],
    [999, '999'],
    // thousands boundary, and ".0" dropped
    [1000, '1K'],
    [1049, '1K'],
    [1500, '1.5K'],
    [55_500, '55.5K'],
    // truncation, not rounding: 1999 has not reached 2K
    [1999, '1.9K'],
    [999_999, '999.9K'],
    // millions and billions
    [1_000_000, '1M'],
    [345_000_000, '345M'],
    [1_999_999_999, '1.9B'],
    [2_500_000_000, '2.5B'],
    // junk collapses to zero rather than rendering NaN
    [Number.NaN, '0'],
    [Number.POSITIVE_INFINITY, '0'],
    [-5, '0'],
];

for (const [input, expected] of cases) {
    const actual = formatCount(input);
    assert.equal(actual, expected, `formatCount(${input}) === ${expected}, got ${actual}`);
}

// The card layout is sized for a 6-character maximum. Assert nothing exceeds it.
const widest = Math.max(
    ...[999, 1000, 55_500, 999_999, 999_999_999, 123_456_789].map(n => formatCount(n).length)
);
assert.ok(widest <= 6, `widest formatted count must fit 6 chars, got ${widest}`);

console.log(`formatCount: ${cases.length} cases passed, widest output ${widest} chars`);
