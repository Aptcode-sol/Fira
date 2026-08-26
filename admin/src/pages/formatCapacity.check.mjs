// ponytail check for formatCapacity (design Property 7 / Flow 8.8).
// No framework, no fixtures — run with: node src/pages/formatCapacity.check.mjs
// Kept as a mirror of the in-file helper in Venues.jsx (small pure fn; if the
// helper changes, update this copy). Ceiling: manual copy, not imported from a
// .jsx module to avoid a JSX-aware loader just for a pure-fn check.
import assert from 'node:assert/strict';

const formatCapacity = (capacity) => {
    if (capacity === null || capacity === undefined || capacity === '') return '0';
    if (typeof capacity === 'number' || typeof capacity === 'string') {
        const num = Number(capacity);
        return Number.isFinite(num) ? num.toLocaleString() : String(capacity);
    }
    if (typeof capacity === 'object') {
        const low = capacity.min ?? capacity.seated;
        const high = capacity.max ?? capacity.standing;
        const lowNum = Number(low);
        const highNum = Number(high);
        const hasLow = low != null && Number.isFinite(lowNum);
        const hasHigh = high != null && Number.isFinite(highNum);
        if (hasLow && hasHigh) return `${lowNum.toLocaleString()}\u2013${highNum.toLocaleString()}`;
        if (hasHigh) return highNum.toLocaleString();
        if (hasLow) return lowNum.toLocaleString();
        const firstNum = Object.values(capacity).map(Number).find(Number.isFinite);
        return firstNum != null ? firstNum.toLocaleString() : '0';
    }
    return '0';
};

// min–max range when both bounds exist (en-dash, not hyphen)
assert.equal(formatCapacity({ min: 100, max: 500 }), '100\u2013500');
// seated/standing shape → readable range
assert.equal(formatCapacity({ seated: 100, standing: 500 }), '100\u2013500');
// single-bound object → the single number
assert.equal(formatCapacity({ min: 100 }), '100');
assert.equal(formatCapacity({ standing: 250 }), '250');
// plain number / string renders as-is (preservation 3.13)
assert.equal(formatCapacity(250), '250');
assert.equal(formatCapacity('250'), '250');
// never "[object Object]"
assert.notEqual(formatCapacity({ min: 1, max: 2 }), '[object Object]');
assert.equal(formatCapacity({}), '0');
assert.equal(formatCapacity(null), '0');

console.log('formatCapacity check: all assertions passed');
