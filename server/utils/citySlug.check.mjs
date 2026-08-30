/**
 * Runnable check for citySlug. `node server/utils/citySlug.check.mjs`
 *
 * The invariant that matters: two spellings of one city must produce one slug.
 * If that breaks, listings split across buckets and the city landing pages
 * empty out - silently, because nothing throws.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { slugify, citySlug, canonicalCityName } = require('./citySlug.js');

// Slug shape
assert.equal(slugify('New Delhi'), 'new-delhi');
assert.equal(slugify('  Hubli-Dharwad  '), 'hubli-dharwad');
assert.equal(slugify('Allahabad (Prayagraj)'), 'allahabad-prayagraj');
assert.equal(slugify(''), '');
assert.equal(slugify(null), '');

// Diacritics collapse rather than splitting a city in two
assert.equal(slugify('Pondichéry'), 'pondichery');

// Provider variance collapses to one slug - the whole point of the module
assert.equal(citySlug('Bengaluru'), citySlug('Bangalore'));
assert.equal(citySlug('Bombay'), 'mumbai');
assert.equal(citySlug('New Delhi'), 'delhi');
assert.equal(citySlug('North Goa'), 'goa');
assert.equal(citySlug('Panaji'), 'goa');
assert.equal(citySlug('Gurgaon'), 'gurugram');
assert.equal(citySlug('Prayagraj'), citySlug('Allahabad (Prayagraj)'));

// An unknown town still gets a usable slug - coverage must not depend on a list
assert.equal(citySlug('Vellore'), 'vellore');
assert.equal(citySlug('Kumbakonam'), 'kumbakonam');

// Empty stays empty, so "no city" never becomes a slug of '-'
assert.equal(citySlug(''), '');
assert.equal(citySlug(undefined), '');

// Display name: opinionated where we have listings, pass-through elsewhere
assert.equal(canonicalCityName('Bengaluru'), 'Bangalore');
assert.equal(canonicalCityName('bombay'), 'Mumbai');
assert.equal(canonicalCityName('Vellore'), 'Vellore');
assert.equal(canonicalCityName('  Kumbakonam  '), 'Kumbakonam');

// A canonical name must slug back to the same bucket, or storing it would move
// the listing out of the city it was saved under.
for (const name of ['Bengaluru', 'Panaji', 'Gurgaon', 'Prayagraj', 'Vizag']) {
    assert.equal(citySlug(canonicalCityName(name)), citySlug(name), name);
}

console.log('citySlug: all checks passed');
