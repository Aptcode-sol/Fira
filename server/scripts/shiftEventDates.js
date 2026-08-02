/**
 * Shift every event's date forward so the catalogue is upcoming again.
 *
 * Why this exists: seedEvents.js builds dates as "N days from now" at the
 * moment it runs. Months later every seeded event sits in the past, and the
 * public listing (which filters on `startDateTime >= now`) correctly returns
 * nothing - so the events page looks broken when it is actually just empty.
 *
 * This is the non-destructive alternative to re-seeding: it edits dates in
 * place, so user-created events, tickets, bookings and IDs all survive.
 *
 * Every event is moved by the SAME offset, which preserves the relative spacing
 * between them - that is what keeps the "Today", "This Weekend" and "Upcoming"
 * sections looking natural rather than dumping everything on one day.
 *
 * Usage:
 *   node server/scripts/shiftEventDates.js            # preview only, no writes
 *   node server/scripts/shiftEventDates.js --apply    # actually write
 *   node server/scripts/shiftEventDates.js --apply --force   # ignore the guard
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Event = require('../models/Event');

const DAY_MS = 24 * 60 * 60 * 1000;

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not set. Check server/.env');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const now = new Date();
    const events = await Event.find({ isDeleted: { $ne: true } })
        .select('name startDateTime endDateTime status')
        .sort({ startDateTime: 1 });

    if (events.length === 0) {
        console.log('No events found - nothing to do.');
        return;
    }

    const upcoming = events.filter(e => e.startDateTime && e.startDateTime >= now);

    console.log(`Events: ${events.length} total, ${upcoming.length} currently upcoming`);

    // Guard: if the catalogue already has future events, shifting would push
    // them further out for no reason. Re-running this by accident should be a
    // no-op, not a surprise.
    if (upcoming.length > 0 && !force) {
        console.log('\nThere are already upcoming events. Nothing to fix.');
        console.log('Pass --force if you really want to shift them anyway.');
        return;
    }

    const earliest = events[0].startDateTime;
    if (!earliest) {
        throw new Error('Earliest event has no startDateTime - aborting.');
    }

    // Land the earliest event one day from now, on a whole-day boundary so the
    // original time of day is preserved.
    const offsetDays = Math.ceil((now.getTime() + DAY_MS - earliest.getTime()) / DAY_MS);
    const offsetMs = offsetDays * DAY_MS;

    console.log(`Earliest event: ${earliest.toISOString()} (${events[0].name})`);
    console.log(`Shift: +${offsetDays} days\n`);

    const preview = events.slice(0, 8).map(e => ({
        name: e.name.slice(0, 38),
        from: e.startDateTime.toISOString().slice(0, 16).replace('T', ' '),
        to: new Date(e.startDateTime.getTime() + offsetMs).toISOString().slice(0, 16).replace('T', ' '),
    }));
    for (const row of preview) {
        console.log(`  ${row.from}  ->  ${row.to}   ${row.name}`);
    }
    if (events.length > preview.length) {
        console.log(`  ... and ${events.length - preview.length} more`);
    }

    if (!apply) {
        console.log('\nDRY RUN - no changes written. Re-run with --apply to commit.');
        return;
    }

    // One bulk write rather than N round-trips.
    const ops = events
        .filter(e => e.startDateTime && e.endDateTime)
        .map(e => ({
            updateOne: {
                filter: { _id: e._id },
                update: {
                    $set: {
                        startDateTime: new Date(e.startDateTime.getTime() + offsetMs),
                        endDateTime: new Date(e.endDateTime.getTime() + offsetMs),
                    },
                },
            },
        }));

    const skipped = events.length - ops.length;
    if (skipped > 0) {
        console.log(`\nSkipping ${skipped} event(s) missing a start or end date.`);
    }

    const result = await Event.bulkWrite(ops);
    console.log(`\nUpdated ${result.modifiedCount} event(s).`);

    const stillPast = await Event.countDocuments({
        isDeleted: { $ne: true },
        startDateTime: { $lt: new Date() },
    });
    const nowUpcoming = await Event.countDocuments({
        isDeleted: { $ne: true },
        status: 'approved',
        startDateTime: { $gte: new Date() },
    });
    console.log(`Approved + upcoming (what the public listing shows): ${nowUpcoming}`);
    console.log(`Still in the past: ${stillPast}`);
}

main()
    .catch(err => {
        console.error('\nFailed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
