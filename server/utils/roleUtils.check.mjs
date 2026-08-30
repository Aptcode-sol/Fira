// Runnable self-check for the idempotent role grant. No framework: run with
//   node server/utils/roleUtils.check.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { withRole } = require('./roleUtils.js');

// Grants the role to a plain user, keeping the existing one.
assert.deepStrictEqual(withRole(['user'], 'user', 'venue_owner'), ['user', 'venue_owner']);

// Idempotent: a re-submit does not duplicate the role.
assert.deepStrictEqual(withRole(['user', 'venue_owner'], 'user', 'venue_owner'), ['user', 'venue_owner']);

// Un-migrated account with no roles[] seeds from the legacy scalar.
assert.deepStrictEqual(withRole(undefined, 'user', 'venue_owner'), ['user', 'venue_owner']);
assert.deepStrictEqual(withRole([], 'user', 'venue_owner'), ['user', 'venue_owner']);

// venue_owner is always present after the grant, whatever the input.
for (const input of [['user'], ['admin'], ['user', 'venue_owner'], []]) {
    assert.ok(withRole(input, 'user', 'venue_owner').includes('venue_owner'));
}

// No legacy role and no roles[]: still grants the role cleanly.
assert.deepStrictEqual(withRole(null, null, 'venue_owner'), ['venue_owner']);

console.log('roleUtils.check.mjs: all assertions passed');
