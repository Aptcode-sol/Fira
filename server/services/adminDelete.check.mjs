// Runnable self-check for the admin user-delete guard.
//   node server/services/adminDelete.check.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const adminService = require('./adminService.js');

const reason = adminService.userDeleteBlockReason.bind(adminService);
const ADMIN = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439022';

// A plain user is deletable.
assert.strictEqual(reason({ role: 'user' }, OTHER, ADMIN), null);
assert.strictEqual(reason({ role: 'venue_owner', roles: ['user', 'venue_owner'] }, OTHER, ADMIN), null);
// No role fields at all must not throw and must not block.
assert.strictEqual(reason({}, OTHER, ADMIN), null);

// Self-delete is refused - an admin must not be able to lock themselves out.
assert.strictEqual(reason({ role: 'user' }, ADMIN, ADMIN)?.status, 400);
// ObjectId vs string comparison must still catch self-delete.
assert.strictEqual(reason({ role: 'user' }, { toString: () => ADMIN }, ADMIN)?.status, 400);

// Admin targets are refused on either role shape (legacy `role`, array `roles`).
assert.strictEqual(reason({ role: 'admin' }, OTHER, ADMIN)?.status, 403);
assert.strictEqual(reason({ roles: ['user', 'admin'] }, OTHER, ADMIN)?.status, 403);

// Self-delete is checked before the admin-target rule, so an admin deleting
// themselves gets the clearer 400 rather than the generic 403.
assert.strictEqual(reason({ role: 'admin' }, ADMIN, ADMIN)?.status, 400);

console.log('adminDelete.check.mjs: all assertions passed');
