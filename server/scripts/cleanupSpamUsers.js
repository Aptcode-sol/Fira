/**
 * Remove bot-registered accounts.
 *
 * A bot signed up ~48 times with a advertising link stuffed into the `name`
 * field. They are all unverified so nobody can log in as them, but they:
 *   - inflate the user count and clutter the admin panel
 *   - would display an attacker-controlled link anywhere a name is rendered
 *
 * Only ever deletes accounts that are BOTH unverified AND have a link in the
 * name, and refuses to touch anything with real activity attached.
 *
 * Usage:
 *   node server/scripts/cleanupSpamUsers.js            # preview only
 *   node server/scripts/cleanupSpamUsers.js --apply    # delete
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const apply = process.argv.includes('--apply');

// Links, or a bare domain in a name field. Both are advertising, never a name.
const SPAM_NAME = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ly|xyz|ru|top|link|click)\b/i;

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected\n');

    const candidates = await User.find({
        emailVerified: false,
        name: SPAM_NAME,
    }).select('_id email name createdAt').lean();

    if (candidates.length === 0) {
        console.log('No spam accounts found.');
        return;
    }

    console.log(`Found ${candidates.length} unverified account(s) with a link in the name:\n`);
    for (const u of candidates.slice(0, 10)) {
        console.log(`  ${u.email.padEnd(34)} ${String(u.name).slice(0, 44)}`);
    }
    if (candidates.length > 10) console.log(`  ... and ${candidates.length - 10} more`);

    // Safety net: never delete an account that owns anything real.
    const ids = candidates.map(u => u._id);
    const Event = require('../models/Event');
    const Ticket = require('../models/Ticket');
    const Booking = require('../models/Booking');

    const [withEvents, withTickets, withBookings] = await Promise.all([
        Event.distinct('organizer', { organizer: { $in: ids } }),
        Ticket.distinct('user', { user: { $in: ids } }),
        Booking.distinct('user', { user: { $in: ids } }),
    ]);

    const active = new Set([...withEvents, ...withTickets, ...withBookings].map(String));
    const deletable = ids.filter(id => !active.has(String(id)));

    if (active.size > 0) {
        console.log(`\nSkipping ${active.size} account(s) that have events, tickets or bookings.`);
    }

    console.log(`\nWould delete: ${deletable.length}`);

    if (!apply) {
        console.log('\nDRY RUN - nothing deleted. Re-run with --apply to commit.');
        return;
    }

    const result = await User.deleteMany({ _id: { $in: deletable } });
    console.log(`\nDeleted ${result.deletedCount} account(s).`);
    console.log(`Remaining users: ${await User.countDocuments({})}`);
}

main()
    .catch(err => console.error('\nFailed:', err.message))
    .finally(() => mongoose.disconnect());
