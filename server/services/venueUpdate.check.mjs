// Runnable self-check for the venue update mass-assignment guard.
//   node server/services/venueUpdate.check.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const venueService = require('./venueService.js');

const strip = venueService.stripProtectedFields.bind(venueService);

// Legit owner-editable fields survive.
const cleaned = strip({
    name: 'Skyline',
    description: 'Rooftop',
    'pricing': { basePrice: 5000 },
    isActive: false, // owner may pause their own listing
    // escalation attempts:
    status: 'approved',
    owner: 'someOtherUserId',
    rating: { average: 5, count: 999 },
    isVerified: true,
    isDeleted: true,
    _id: 'forged',
});

assert.strictEqual(cleaned.name, 'Skyline');
assert.strictEqual(cleaned.description, 'Rooftop');
assert.strictEqual(cleaned.isActive, false);

// Every escalation field must be gone.
for (const forbidden of ['status', 'owner', 'rating', 'isVerified', 'isDeleted', '_id']) {
    assert.ok(!(forbidden in cleaned), `${forbidden} must be stripped from a venue update`);
}

// Never mutates the caller's object.
const original = { name: 'X', status: 'approved' };
strip(original);
assert.strictEqual(original.status, 'approved', 'strip must not mutate its input');

// Empty / undefined input is safe.
assert.deepStrictEqual(strip(), {});
assert.deepStrictEqual(strip({}), {});

console.log('venueUpdate.check.mjs: all assertions passed');
