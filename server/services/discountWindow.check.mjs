// Runnable self-check for the derived discount validity window.
//   node server/services/discountWindow.check.mjs
//
// Replaces the client-side date-bounds test. That test asserted the OLD rule -
// validFrom >= event start - which was the bug: a code is checked at purchase time
// and tickets sell before the event runs, so a code that could not start before its
// event began was unusable for the entire selling period.
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const discountService = require('./discountService.js');

const window = discountService.discountWindow.bind(discountService);

// Relative to now, not a literal date - a hardcoded 2025 fixture silently became a
// past event and the "non-empty window" assertion started failing for the wrong
// reason.
const DAY = 24 * 60 * 60 * 1000;
const start = new Date(Date.now() + 30 * DAY).toISOString();
const end = new Date(Date.now() + 30 * DAY + 5 * 60 * 60 * 1000).toISOString();

const w = window({ startDateTime: new Date(start), endDateTime: new Date(end) });

// Usable immediately - this is the whole point. Under the old rule validFrom was the
// event start, so nothing could be redeemed until the doors opened.
assert.ok(w.validFrom <= new Date(), 'a new code must be usable now, not from the event start');
assert.strictEqual(w.validUntil.toISOString(), end, 'validity ends with the event');
assert.ok(w.validFrom < w.validUntil, 'window must be non-empty for a future event');

// Falls back to the start when an event has no end recorded, rather than producing
// an Invalid Date that would silently store null and never expire.
const noEnd = window({ startDateTime: new Date(start) });
assert.strictEqual(noEnd.validUntil.toISOString(), start);

// An event with neither bound is a programming error, not a code with no expiry.
assert.throws(() => window({}), /no end date/);
assert.throws(() => window(null), /no end date/);

// A past event yields an already-expired window: validateAndApplyDiscount rejects on
// `now > validUntil`, so creating a code for a finished event cannot be redeemed.
const past = window({ endDateTime: new Date('2020-01-01T00:00:00.000Z') });
assert.ok(past.validUntil < past.validFrom, 'a finished event yields an expired window');

console.log('discountWindow.check.mjs: all assertions passed');
