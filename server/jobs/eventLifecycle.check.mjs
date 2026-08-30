// ponytail check for the event lifecycle filters. No framework, no fixtures,
// no database — run with: node jobs/eventLifecycle.check.mjs
//
// What this guards: the job flips Event.status, so a filter that is one word too
// wide would silently resurrect a cancelled event as 'completed'.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    LIVE_EVENT_STATUSES,
    completedEventFilter,
    ongoingEventFilter,
} = require('./scheduledJobs.js');

const now = new Date('2026-06-15T12:00:00.000Z');
const completed = completedEventFilter(now);
const ongoing = ongoingEventFilter(now);

// Terminal and pre-approval states are decisions a human made. The job must never
// overwrite one of them.
const UNTOUCHABLE = ['draft', 'pending', 'cancelled', 'rejected', 'blocked', 'completed'];
for (const status of UNTOUCHABLE) {
    assert.ok(
        !ongoing.status.$in.includes(status),
        `ongoing filter must not match '${status}'`
    );
}
for (const status of UNTOUCHABLE.filter((s) => s !== 'completed')) {
    assert.ok(
        !completed.status.$in.includes(status),
        `completed filter must not match '${status}'`
    );
}

// 'ongoing' is re-checked by the completed filter (an event that was running and
// has now ended), but is not re-matched by the ongoing filter - that would be a
// no-op write on every tick.
assert.ok(completed.status.$in.includes('ongoing'));
assert.ok(!ongoing.status.$in.includes('ongoing'));

// Both filters cover every live status, so nothing live is left behind.
for (const status of LIVE_EVENT_STATUSES) {
    assert.ok(completed.status.$in.includes(status));
    assert.ok(ongoing.status.$in.includes(status));
}

// The two windows are disjoint on endDateTime: ended (<= now) vs still running
// (> now). An event cannot satisfy both in the same pass.
assert.deepEqual(completed.endDateTime, { $lte: now });
assert.deepEqual(ongoing.endDateTime, { $gt: now });
assert.deepEqual(ongoing.startDateTime, { $lte: now });

// Soft-deleted events stay out of both.
assert.deepEqual(completed.isDeleted, { $ne: true });
assert.deepEqual(ongoing.isDeleted, { $ne: true });

// Sanity-match the filters against representative documents, using the only
// operators these filters actually use.
const matches = (filter, doc) =>
    filter.status.$in.includes(doc.status) &&
    (!filter.endDateTime.$lte || doc.endDateTime <= filter.endDateTime.$lte) &&
    (!filter.endDateTime.$gt || doc.endDateTime > filter.endDateTime.$gt) &&
    (!filter.startDateTime || doc.startDateTime <= filter.startDateTime.$lte) &&
    doc.isDeleted !== true;

const past = { status: 'approved', startDateTime: new Date('2026-06-14T10:00:00Z'), endDateTime: new Date('2026-06-14T18:00:00Z') };
const running = { status: 'approved', startDateTime: new Date('2026-06-15T10:00:00Z'), endDateTime: new Date('2026-06-15T18:00:00Z') };
const future = { status: 'approved', startDateTime: new Date('2026-06-20T10:00:00Z'), endDateTime: new Date('2026-06-20T18:00:00Z') };
const cancelledPast = { ...past, status: 'cancelled' };
const deletedPast = { ...past, isDeleted: true };

assert.equal(matches(completed, past), true);
assert.equal(matches(ongoing, past), false);

assert.equal(matches(ongoing, running), true);
assert.equal(matches(completed, running), false);

assert.equal(matches(completed, future), false);
assert.equal(matches(ongoing, future), false);

assert.equal(matches(completed, cancelledPast), false);
assert.equal(matches(completed, deletedPast), false);

console.log('event lifecycle filters check: all assertions passed');
