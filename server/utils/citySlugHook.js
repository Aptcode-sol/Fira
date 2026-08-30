// @ts-check
'use strict';

const { citySlug } = require('./citySlug');

/**
 * Keep a `citySlug` field in step with its `city` field, on every write path.
 *
 * Deliberately a schema hook rather than a line in each service. A venue's
 * address is written by create, by edit, by the admin tools and by the seeds;
 * setting the slug in each of those is four places to forget, and a listing with
 * a missing slug is invisible to every city filter and every city page while
 * looking perfectly fine in the database. One hook per schema cannot be
 * forgotten by the next write path someone adds.
 *
 * @param {import('mongoose').Schema} schema
 * @param {string} [prefix] Sub-document holding the city, e.g. 'address'.
 *   Empty for a city on the document itself.
 */
function attachCitySlug(schema, prefix = '') {
    const cityPath = prefix ? `${prefix}.city` : 'city';
    const slugPath = prefix ? `${prefix}.citySlug` : 'citySlug';

    // Async middleware rather than the next(cb) form: Mongoose 9 does not pass a
    // callback to these, so a next() call here throws on every single save.
    schema.pre('save', async function () {
        const city = this.get(cityPath);
        // Guard rather than writing an empty slug: setting a nested path on a
        // document that has no sub-document at all would conjure one into
        // existence (an event with no custom venue growing a `customVenue`).
        if (city) this.set(slugPath, citySlug(city));
    });

    // Covers findByIdAndUpdate / findOneAndUpdate / updateOne / updateMany, which
    // never run the save hook above.
    schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], async function () {
        this.setUpdate(applyCitySlugToUpdate(this.getUpdate(), prefix));
    });
}

/**
 * Add the derived slug to an update object, in place.
 *
 * Split out from the hook so it can be checked without a database - the shape
 * matching is the part with the bugs in it, not the mongoose plumbing.
 *
 * @param {any} update
 * @param {string} [prefix]
 * @returns {any} the same update object
 */
function applyCitySlugToUpdate(update, prefix = '') {
    // An aggregation-pipeline update is an array and has no $set to read.
    if (!update || typeof update !== 'object' || Array.isArray(update)) return update;

    const cityPath = prefix ? `${prefix}.city` : 'city';
    const slugPath = prefix ? `${prefix}.citySlug` : 'citySlug';

    // Mongoose treats a plain object as an implicit $set, so both shapes end up
    // in the same place.
    const set = update.$set || update;

    // Dotted form: { 'address.city': 'Vellore' }, and the no-prefix case
    // ({ city: 'Vellore' }) where cityPath is just 'city'.
    if (typeof set[cityPath] === 'string') {
        set[slugPath] = citySlug(set[cityPath]);
    } else if (prefix && set[prefix] && typeof set[prefix].city === 'string') {
        // Nested form: { address: { city: 'Vellore', ... } }. The whole
        // sub-document is being replaced, so the slug has to go inside it or the
        // replacement would drop it.
        set[prefix].citySlug = citySlug(set[prefix].city);
    }

    return update;
}

module.exports = { attachCitySlug, applyCitySlugToUpdate };
