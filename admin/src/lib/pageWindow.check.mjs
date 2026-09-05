/**
 * Runnable check for the pager's sliding window.
 * Run: node src/lib/pageWindow.check.mjs
 *
 * The window is the part that was actually broken in the four hand-rolled copies, and
 * the failure was invisible unless you clicked to the end of a long list. Two
 * invariants carry the whole thing:
 *
 *   - the pages are STRICTLY ASCENDING (the old version emitted [8,9,10,9,10])
 *   - the pages are DISTINCT (duplicates meant duplicate React keys)
 */
import assert from 'node:assert/strict';
import { pageWindow } from './pageWindow.js';

const show = (c, t) => `page ${c} of ${t}`;

/* ---- the invariants, over every position of every list up to 40 pages ---- */
for (let total = 1; total <= 40; total++) {
    for (let current = 1; current <= total; current++) {
        const w = pageWindow(current, total);
        const where = show(current, total);

        assert.equal(w.length, Math.min(5, total), `${where}: window should be ${Math.min(5, total)} wide`);
        assert.equal(new Set(w).size, w.length, `${where}: duplicate page numbers -> duplicate React keys, got ${w}`);
        for (let i = 1; i < w.length; i++) {
            assert.ok(w[i] === w[i - 1] + 1, `${where}: pages must be consecutive and ascending, got ${w}`);
        }
        assert.ok(w[0] >= 1, `${where}: window starts before page 1, got ${w}`);
        assert.ok(w[w.length - 1] <= total, `${where}: window runs past the last page, got ${w}`);
        assert.ok(w.includes(current), `${where}: the current page must be visible, got ${w}`);
    }
}

/* ---- the exact cases the old inline version got wrong ---- */
// Old: [7,8,9,10,10]
assert.deepEqual(pageWindow(9, 10), [6, 7, 8, 9, 10]);
// Old: [8,9,10,9,10]
assert.deepEqual(pageWindow(10, 10), [6, 7, 8, 9, 10]);

/* ---- ordinary positions ---- */
assert.deepEqual(pageWindow(1, 10), [1, 2, 3, 4, 5]);
assert.deepEqual(pageWindow(3, 10), [1, 2, 3, 4, 5]);
assert.deepEqual(pageWindow(5, 10), [3, 4, 5, 6, 7]);
assert.deepEqual(pageWindow(2, 3), [1, 2, 3], 'a short list shows every page');
assert.deepEqual(pageWindow(1, 1), [1]);

/* ---- degenerate input must not throw or invent pages ---- */
assert.deepEqual(pageWindow(1, 0), [], 'no pages = nothing to show');
assert.deepEqual(pageWindow(1, -3), []);
assert.deepEqual(pageWindow(1, undefined), []);
assert.deepEqual(pageWindow(1, NaN), []);
// A stale currentPage past the end still yields a valid window rather than an empty one,
// so the controls stay usable and the reader can click back.
assert.deepEqual(pageWindow(99, 4), [1, 2, 3, 4], 'out-of-range current page must not empty the pager');

console.log('pageWindow.check.mjs: all assertions passed');
