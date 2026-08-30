/**
 * Backfill citySlug on records saved before the field existed.
 *
 * City filters and the /events/in/<city> and /venues/in/<city> pages match on
 * `citySlug` now. A record written before that field existed has no slug, so it
 * is absent from every city filter and every city page while looking completely
 * healthy in the database - nothing errors, results are just quietly missing.
 *
 * Writes with updateOne so the model hooks derive the slug, which keeps the
 * canonical spelling rules in one place instead of duplicating them here.
 *
 * Idempotent: only touches records with a city and no matching slug, so running
 * it twice is harmless.
 *
 * Usage:
 *   node server/scripts/backfillCitySlug.js            # preview
 *   node server/scripts/backfillCitySlug.js --apply    # write
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const { citySlug } = require('../utils/citySlug');

const apply = process.argv.includes('--apply');

/**
 * @param {import('mongoose').Model<any>} Model
 * @param {string} cityPath e.g. 'address.city'
 */
async function backfill(Model, cityPath) {
    const slugPath = cityPath.replace(/city$/, 'citySlug');
    const docs = await Model.find({ [cityPath]: { $nin: [null, ''] } })
        .select(`_id ${cityPath} ${slugPath}`)
        .lean();

    let changed = 0;
    for (const doc of docs) {
        // Walk the path rather than assuming a depth, so 'city' and
        // 'address.city' both work.
        const city = cityPath.split('.').reduce((o, k) => o?.[k], doc);
        const existing = slugPath.split('.').reduce((o, k) => o?.[k], doc);
        const wanted = citySlug(city);
        if (!wanted || existing === wanted) continue;

        changed++;
        console.log(`  ${Model.modelName} ${doc._id}: ${city} -> ${wanted}${existing ? ` (was ${existing})` : ''}`);
        if (apply) await Model.updateOne({ _id: doc._id }, { $set: { [cityPath]: city } });
    }

    console.log(`${Model.modelName}.${cityPath}: ${changed} of ${docs.length} need a slug\n`);
    return changed;
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(apply ? '=== APPLYING ===\n' : '=== DRY RUN (nothing written) ===\n');

    const total =
        (await backfill(require('../models/Venue'), 'address.city')) +
        (await backfill(require('../models/Event'), 'customVenue.city')) +
        (await backfill(require('../models/User'), 'city'));

    console.log(total === 0
        ? 'Nothing to backfill.'
        : apply ? `Done. ${total} records updated.` : `${total} records would be updated. Re-run with --apply.`);

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
