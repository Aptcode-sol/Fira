/**
 * Runnable check for the update-shape matching in citySlugHook.
 * `node server/utils/citySlugHook.check.mjs`
 *
 * A missed shape here is invisible: the write succeeds, the city looks right in
 * the database, and the listing is absent from every city filter and city page.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { applyCitySlugToUpdate } = require('./citySlugHook.js');

// Dotted path inside $set - what findByIdAndUpdate({ $set: {...} }) produces
assert.deepEqual(
    applyCitySlugToUpdate({ $set: { 'address.city': 'Bengaluru' } }, 'address'),
    { $set: { 'address.city': 'Bengaluru', 'address.citySlug': 'bangalore' } }
);

// Whole sub-document replaced - the slug must land inside it, or the replacement
// drops the field entirely
assert.deepEqual(
    applyCitySlugToUpdate({ $set: { address: { city: 'Vellore', state: 'Tamil Nadu' } } }, 'address'),
    { $set: { address: { city: 'Vellore', state: 'Tamil Nadu', citySlug: 'vellore' } } }
);

// Implicit $set - a plain update object with no operator
assert.deepEqual(
    applyCitySlugToUpdate({ 'customVenue.city': 'Panaji' }, 'customVenue'),
    { 'customVenue.city': 'Panaji', 'customVenue.citySlug': 'goa' }
);

// No prefix: a city on the document itself (User.city)
assert.deepEqual(
    applyCitySlugToUpdate({ $set: { city: 'Gurgaon' } }),
    { $set: { city: 'Gurgaon', citySlug: 'gurugram' } }
);

// Untouched when the update does not mention the city, so an unrelated edit
// cannot blank the slug
assert.deepEqual(
    applyCitySlugToUpdate({ $set: { 'address.street': '1 Main St' } }, 'address'),
    { $set: { 'address.street': '1 Main St' } }
);

// Shapes that must not throw
assert.equal(applyCitySlugToUpdate(null, 'address'), null);
assert.deepEqual(applyCitySlugToUpdate([{ $set: { x: 1 } }], 'address'), [{ $set: { x: 1 } }]);
assert.deepEqual(applyCitySlugToUpdate({ $unset: { address: '' } }, 'address'), { $unset: { address: '' } });

// A non-string city (bad client input) must not become the slug '-'
assert.deepEqual(
    applyCitySlugToUpdate({ $set: { 'address.city': 42 } }, 'address'),
    { $set: { 'address.city': 42 } }
);

console.log('citySlugHook: all checks passed');
