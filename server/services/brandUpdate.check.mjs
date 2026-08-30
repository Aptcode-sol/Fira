// Runnable self-check for the brand profile mass-assignment guard.
//   node server/services/brandUpdate.check.mjs
//
// The one thing that fails if `status` ever finds its way back into the $set:
// updateProfile grants the verified badge whenever the profile reads 'approved', so
// an unfiltered body let an applicant approve themselves on the same request that
// created the application.
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const brandService = require('./brandService.js');

const strip = brandService.stripProtectedFields.bind(brandService);

const cleaned = strip({
    name: 'Cosmic Events',
    type: 'dj',
    bio: 'Techno',
    cities: ['Hyderabad'],
    isActive: false, // the owner may pause their own profile
    // escalation attempts:
    status: 'approved',
    stats: { followers: 99999, views: 99999 },
    user: 'someOtherUserId',
    isVerified: true,
    verificationBadge: 'organizer',
    _id: 'forged',
});

assert.strictEqual(cleaned.name, 'Cosmic Events');
assert.strictEqual(cleaned.type, 'dj');
assert.strictEqual(cleaned.bio, 'Techno');
assert.deepStrictEqual(cleaned.cities, ['Hyderabad']);
assert.strictEqual(cleaned.isActive, false);

for (const forbidden of ['status', 'stats', 'user', 'isVerified', 'verificationBadge', '_id']) {
    assert.ok(!(forbidden in cleaned), `${forbidden} must be stripped from a brand profile save`);
}

// Never mutates the caller's object.
const original = { name: 'X', status: 'approved' };
strip(original);
assert.strictEqual(original.status, 'approved', 'strip must not mutate its input');

// Empty / undefined input is safe - the upsert path passes whatever the route got.
assert.deepStrictEqual(strip(), {});
assert.deepStrictEqual(strip({}), {});

console.log('brandUpdate.check.mjs: all assertions passed');
