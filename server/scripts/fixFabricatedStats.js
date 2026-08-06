/**
 * Replace seeded/fabricated numbers with the real thing.
 *
 * Three sets of figures were being shown to users as fact when nothing in the
 * app could ever produce them:
 *
 *   1. Venue ratings  - "4.7 ★ (83 reviews)". There is no review system at all:
 *                       no Review model, no endpoint, no UI. The numbers came
 *                       from seedVenues.js and could never change. They also fed
 *                       `aggregateRating` in the venue structured data, so
 *                       Google was being shown invented review counts - which
 *                       breaks its review-snippet policy.
 *                       -> reset to 0. The UI already hides ratings when
 *                          count === 0, as does the JSON-LD, so real values
 *                          will appear on their own once reviews ship.
 *
 *   2. Brand followers - seeded at 12,000-15,000. Following IS real (followBrand
 *                       increments the counter), so this recomputes the true
 *                       count from users' `followingBrands` rather than zeroing,
 *                       and likewise counts real events.
 *
 *   3. Event attendees - `currentAttendees` was seeded far above the tickets
 *                       actually sold (e.g. 730 shown vs 20 real). This drives
 *                       "spots left" and can make an event look sold out, so it
 *                       is recomputed from live ticket quantities.
 *
 * Usage:
 *   node server/scripts/fixFabricatedStats.js            # preview
 *   node server/scripts/fixFabricatedStats.js --apply    # write
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const apply = process.argv.includes('--apply');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(apply ? '=== APPLYING ===\n' : '=== DRY RUN (nothing written) ===\n');

    const Venue = require('../models/Venue');
    const BrandProfile = require('../models/BrandProfile');
    const Event = require('../models/Event');
    const Ticket = require('../models/Ticket');
    const User = require('../models/User');

    /* ---------------- 1. Venue ratings ---------------- */
    const rated = await Venue.countDocuments({ 'rating.count': { $gt: 0 } });
    console.log(`1. VENUE RATINGS`);
    console.log(`   ${rated} venue(s) currently display a fabricated rating`);
    if (apply && rated > 0) {
        const r = await Venue.updateMany({}, { $set: { 'rating.average': 0, 'rating.count': 0 } });
        console.log(`   -> reset ${r.modifiedCount} venue(s) to 0`);
    }

    /* ---------------- 2. Brand stats ---------------- */
    console.log(`\n2. BRAND STATS`);
    const brands = await BrandProfile.find({}).select('name stats user').lean();
    let brandChanges = 0;
    for (const b of brands) {
        // Events belong to a brand through its owning USER - there is no
        // `brand` field on Event. GET /brands/:id/events resolves them via
        // getEventsByOrganizer(brand.user._id), so mirror that here. Counting
        // on a non-existent field would have written 0 for every brand.
        const [followers, events] = await Promise.all([
            User.countDocuments({ followingBrands: b._id }),
            b.user
                ? Event.countDocuments({ organizer: b.user, isDeleted: { $ne: true } })
                : Promise.resolve(0),
        ]);
        const shownF = b.stats?.followers ?? 0;
        const shownE = b.stats?.events ?? 0;
        if (shownF !== followers || shownE !== events) {
            brandChanges++;
            if (brandChanges <= 6) {
                console.log(`   ${String(b.name).slice(0, 26).padEnd(28)} followers ${shownF} -> ${followers}   events ${shownE} -> ${events}`);
            }
            if (apply) {
                await BrandProfile.updateOne(
                    { _id: b._id },
                    { $set: { 'stats.followers': followers, 'stats.events': events } }
                );
            }
        }
    }
    if (brandChanges > 6) console.log(`   ... and ${brandChanges - 6} more`);
    console.log(`   ${brandChanges} brand(s) ${apply ? 'corrected' : 'would change'}`);

    /* ---------------- 3. Event attendees ---------------- */
    console.log(`\n3. EVENT ATTENDEES`);
    const events = await Event.find({ isDeleted: { $ne: true } }).select('name currentAttendees').lean();
    let eventChanges = 0;
    for (const e of events) {
        const agg = await Ticket.aggregate([
            { $match: { event: e._id, status: { $ne: 'cancelled' } } },
            { $group: { _id: null, n: { $sum: '$quantity' } } },
        ]);
        const actual = agg[0]?.n || 0;
        if ((e.currentAttendees ?? 0) !== actual) {
            eventChanges++;
            if (eventChanges <= 6) {
                console.log(`   ${String(e.name).slice(0, 30).padEnd(32)} ${e.currentAttendees} -> ${actual}`);
            }
            if (apply) {
                await Event.updateOne({ _id: e._id }, { $set: { currentAttendees: actual } });
            }
        }
    }
    if (eventChanges > 6) console.log(`   ... and ${eventChanges - 6} more`);
    console.log(`   ${eventChanges} event(s) ${apply ? 'corrected' : 'would change'}`);

    if (!apply) {
        console.log('\nRe-run with --apply to write these changes.');
    } else {
        console.log('\nDone. Ratings will stay hidden until a real review system exists.');
    }
}

main()
    .catch(err => console.error('\nFailed:', err.message))
    .finally(() => mongoose.disconnect());
