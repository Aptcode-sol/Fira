/**
 * Clear stale data so the admin panel and Platform Revenue only reflect the
 * listings that are actually still there.
 *
 * Keeps: the events and venues currently visible in the panel (isDeleted != true),
 * and the tickets/bookings that belong to them.
 *
 * Deletes:
 *   - events and venues with isDeleted: true (already hidden from the panel)
 *   - ORPHANED tickets: ticket.event is not an existing (non-deleted) event
 *   - ORPHANED bookings: booking.venue is not an existing (non-deleted) venue
 *
 * Orphan handling is why the dashboard revenue clears: a ticket/booking whose
 * listing is gone (hard-deleted earlier, or soft-deleted now) still sums into
 * revenue until the ticket/booking row itself is removed.
 *
 * SAFE BY DEFAULT: dry run. Prints what WOULD be removed and writes nothing.
 * Re-run with --apply to actually delete.
 *
 *   Dry run:  node scripts/purgeDeletedListings.js
 *   Apply:    node scripts/purgeDeletedListings.js --apply
 *
 * This is irreversible. Take a mongodump first.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const apply = process.argv.includes('--apply');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const Event = require('../models/Event');
    const Venue = require('../models/Venue');
    const Ticket = require('../models/Ticket');
    const Booking = require('../models/Booking');

    // Listings that survive: everything not soft-deleted. These are the panel's
    // visible rows, and the only tickets/bookings we keep are the ones pointing
    // at them.
    const liveEventIds = (await Event.find({ isDeleted: { $ne: true } }).select('_id').lean()).map((e) => e._id);
    const liveVenueIds = (await Venue.find({ isDeleted: { $ne: true } }).select('_id').lean()).map((v) => v._id);

    // Soft-deleted listings to hard-delete.
    const deletedEventCount = await Event.countDocuments({ isDeleted: true });
    const deletedVenueCount = await Venue.countDocuments({ isDeleted: true });

    // Orphans: a ticket whose event is not a live event, a booking whose venue
    // is not a live venue. $nin against the live set catches both dangling refs
    // (listing hard-deleted already) and refs to now-soft-deleted listings.
    const orphanTicketFilter = { event: { $nin: liveEventIds } };
    const orphanBookingFilter = { venue: { $nin: liveVenueIds } };

    const orphanTickets = await Ticket.countDocuments(orphanTicketFilter);
    const orphanBookings = await Booking.countDocuments(orphanBookingFilter);

    console.log(apply ? '\n=== APPLYING (deleting) ===' : '\n=== DRY RUN (nothing written) ===');
    console.log(`  Live events kept:                ${liveEventIds.length}`);
    console.log(`  Live venues kept:                ${liveVenueIds.length}`);
    console.log(`  Soft-deleted events to remove:   ${deletedEventCount}`);
    console.log(`  Soft-deleted venues to remove:   ${deletedVenueCount}`);
    console.log(`  Orphaned tickets to remove:      ${orphanTickets}`);
    console.log(`  Orphaned bookings to remove:     ${orphanBookings}`);

    const [remTickets, remBookings] = await Promise.all([
        Ticket.countDocuments({ event: { $in: liveEventIds } }),
        Booking.countDocuments({ venue: { $in: liveVenueIds } }),
    ]);
    console.log('\n  Will remain:');
    console.log(`    Events:   ${liveEventIds.length}`);
    console.log(`    Venues:   ${liveVenueIds.length}`);
    console.log(`    Tickets:  ${remTickets}`);
    console.log(`    Bookings: ${remBookings}`);

    if (!apply) {
        console.log('\nNothing was deleted. Re-run with --apply to perform the deletion.\n');
        await mongoose.disconnect();
        return;
    }

    const ticketRes = await Ticket.deleteMany(orphanTicketFilter);
    const bookingRes = await Booking.deleteMany(orphanBookingFilter);
    const eventRes = await Event.deleteMany({ isDeleted: true });
    const venueRes = await Venue.deleteMany({ isDeleted: true });

    console.log('\n  Deleted:');
    console.log(`    Orphaned tickets:  ${ticketRes.deletedCount}`);
    console.log(`    Orphaned bookings: ${bookingRes.deletedCount}`);
    console.log(`    Events:            ${eventRes.deletedCount}`);
    console.log(`    Venues:            ${venueRes.deletedCount}`);
    console.log('\nDone.\n');

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
