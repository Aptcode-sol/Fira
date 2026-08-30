// Runnable self-check for admin audit coverage.
//   node server/services/auditTrail.check.mjs
//
// Two things it guards:
//   1. actionForStatus never returns a value the AuditLog enum rejects. A rejected
//      write means the action goes UNRECORDED, which is the one failure an audit trail
//      cannot absorb.
//   2. Every mutating admin operation goes through recordAdminAction. Four of nine did
//      before; approve/reject/block left no trace at all.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const adminService = require('./adminService.js');
const AuditLog = require('../models/AuditLog.js');

const ALLOWED = AuditLog.schema.path('action').options.enum;
const actionFor = adminService.actionForStatus.bind(adminService);

/* ---- 1) status -> action, always inside the enum ---- */
assert.strictEqual(actionFor('approved'), 'approve');
assert.strictEqual(actionFor('rejected'), 'reject');
assert.strictEqual(actionFor('blocked'), 'block');
assert.strictEqual(actionFor('unblocked'), 'unblock');
assert.strictEqual(actionFor('APPROVED'), 'approve', 'case must not decide the action');

// Statuses the enum has no word for still produce a recordable action rather than
// failing validation: 'update', with the real values carried in metadata.
for (const status of ['pending', 'cancelled', 'completed', 'draft', '', null, undefined, 'anything']) {
    const action = actionFor(status);
    assert.ok(
        ALLOWED.includes(action),
        `actionForStatus(${JSON.stringify(status)}) returned "${action}", which AuditLog would reject`
    );
}
assert.strictEqual(actionFor('pending'), 'update');

/* ---- 2) no mutating operation writes AuditLog directly ---- */
const source = readFileSync(new URL('./adminService.js', import.meta.url), 'utf8');

// One writer. A direct AuditLog.create call is how the coverage gaps happened: each
// site decided for itself, and five decided not to.
const directWrites = source.match(/AuditLog\.create\(/g) || [];
assert.strictEqual(
    directWrites.length,
    1,
    'AuditLog.create belongs only inside recordAdminAction - route every action through it'
);
assert.ok(
    /async recordAdminAction\([\s\S]{0,900}AuditLog\.create\(/.test(source),
    'the single AuditLog.create must be the one inside recordAdminAction'
);

// Every operation that changes state must record something.
for (const fn of [
    'blockUser',
    'unblockUser',
    'deleteUser',
    'updateVenueStatus',
    'deleteVenue',
    'updateEventStatus',
    'deleteEvent',
    'toggleFeatured',
    'updateBrandStatus',
]) {
    // Slice from this function's declaration to the start of the next one, then look
    // for the writer inside that body.
    const start = source.indexOf(`async ${fn}(`);
    assert.ok(start > -1, `${fn} not found in adminService`);
    const rest = source.slice(start + fn.length);
    const next = rest.search(/\n {4}(?:async )?[a-zA-Z]+\(/);
    const body = next > -1 ? rest.slice(0, next) : rest;
    assert.ok(
        body.includes('recordAdminAction'),
        `${fn} changes state but records no audit entry`
    );
    assert.ok(
        /adminUserId/.test(body),
        `${fn} must accept adminUserId - an unattributable entry is not an audit entry`
    );
}

/* ---- 3) paging input is clamped before it reaches Mongo ---- */
const paging = adminService.auditPaging.bind(adminService);
const MAX = adminService.AUDIT_MAX_LIMIT;

assert.deepStrictEqual(paging(), { page: 1, limit: 20, skip: 0 }, 'defaults');
assert.deepStrictEqual(paging({ page: 3, limit: 10 }), { page: 3, limit: 10, skip: 20 });

// Query-string values arrive as strings.
assert.deepStrictEqual(paging({ page: '2', limit: '5' }), { page: 2, limit: 5, skip: 5 });

// An unbounded limit would return the whole audit table in one populated query, and
// this table grows on every admin action.
assert.strictEqual(paging({ limit: 1000000 }).limit, MAX, 'limit must be capped');
assert.strictEqual(paging({ limit: MAX + 1 }).limit, MAX);
assert.strictEqual(paging({ limit: MAX }).limit, MAX, 'the cap itself is allowed');

// skip must never go negative and page must never be below 1 - both produced an invalid
// query rather than an empty page.
for (const bad of [0, -1, -100, 'abc', null, undefined, NaN, '', 1.7]) {
    const p = paging({ page: bad });
    assert.ok(p.page >= 1, `page ${JSON.stringify(bad)} -> ${p.page}, must be >= 1`);
    assert.ok(p.skip >= 0, `page ${JSON.stringify(bad)} -> skip ${p.skip}, must be >= 0`);
    assert.ok(Number.isInteger(p.skip), `skip must be an integer, got ${p.skip}`);
}
for (const bad of [0, -5, 'abc', null, undefined, NaN, '']) {
    const p = paging({ limit: bad });
    assert.ok(p.limit >= 1 && p.limit <= MAX, `limit ${JSON.stringify(bad)} -> ${p.limit}`);
    assert.ok(Number.isInteger(p.limit), `limit must be an integer, got ${p.limit}`);
}

console.log('auditTrail.check.mjs: all assertions passed');
