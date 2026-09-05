/**
 * Where the dashboard's Platform Revenue actually comes from.
 *
 * Read-only. Reproduces admin getStats() exactly, then breaks each figure down
 * by source so you can see which events and venues contribute:
 *
 *   - Ticket Revenue: SUM(tickets.price) over every ticket, grouped by event.
 *     This is unfiltered on purpose - it mirrors the dashboard, which sums all
 *     tickets regardless of status. The `status` column shows how much of a
 *     row is cancelled so you can spot inflated figures.
 *   - Venue Revenue: SUM(bookings.totalAmount) where status in
 *     (accepted, completed), grouped by venue.
 *
 * `isDeleted` flags money coming from soft-deleted listings - the usual reason
 * the lists look empty while revenue is not zero.
 *
 * Run: node scripts/revenueBreakdown.js   (from the server/ directory)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const Ticket = require('../models/Ticket');
    const Booking = require('../models/Booking');

    // ---- Ticket revenue by event ----
    const byEvent = await Ticket.aggregate([
        { $group: { _id: '$event', revenue: { $sum: '$price' }, tickets: { $sum: 1 } } },
        { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'event' } },
        { $unwind: { path: '$event', preserveNullAndEmptyArrays: true } },
        { $project: {
            _id: 0,
            eventId: '$_id',
            name: { $ifNull: ['$event.name', '$event.customVenue.name', '(deleted / unknown)'] },
            isDeleted: { $ifNull: ['$event.isDeleted', false] },
            revenue: 1,
            tickets: 1,
        } },
        { $sort: { revenue: -1 } },
    ]);

    // Cancelled-ticket revenue per event, so you can see what would drop off if
    // cancelled tickets were excluded.
    const cancelledByEvent = await Ticket.aggregate([
        { $match: { status: 'cancelled' } },
        { $group: { _id: '$event', cancelledRevenue: { $sum: '$price' }, cancelled: { $sum: 1 } } },
    ]);
    const cancelledMap = new Map(cancelledByEvent.map((r) => [String(r._id), r]));

    // ---- Venue revenue by venue ----
    const byVenue = await Booking.aggregate([
        { $match: { status: { $in: ['accepted', 'completed'] } } },
        { $group: { _id: '$venue', revenue: { $sum: '$totalAmount' }, bookings: { $sum: 1 } } },
        { $lookup: { from: 'venues', localField: '_id', foreignField: '_id', as: 'venue' } },
        { $unwind: { path: '$venue', preserveNullAndEmptyArrays: true } },
        { $project: {
            _id: 0,
            venueId: '$_id',
            name: { $ifNull: ['$venue.name', '(deleted / unknown)'] },
            isDeleted: { $ifNull: ['$venue.isDeleted', false] },
            revenue: 1,
            bookings: 1,
        } },
        { $sort: { revenue: -1 } },
    ]);

    const ticketTotal = byEvent.reduce((t, r) => t + r.revenue, 0);
    const venueTotal = byVenue.reduce((t, r) => t + r.revenue, 0);

    console.log('\n=== TICKET REVENUE BY EVENT ===');
    for (const r of byEvent) {
        const c = cancelledMap.get(String(r.eventId));
        const flags = [r.isDeleted ? 'DELETED' : null, c ? `${inr(c.cancelledRevenue)} cancelled` : null]
            .filter(Boolean).join(', ');
        console.log(`  ${inr(r.revenue).padEnd(12)} ${String(r.tickets).padStart(4)} tkt  ${r.name}${flags ? `  [${flags}]` : ''}`);
    }
    console.log(`  ---- Ticket total: ${inr(ticketTotal)} across ${byEvent.length} event(s) ----`);

    console.log('\n=== VENUE REVENUE BY VENUE (accepted/completed bookings) ===');
    for (const r of byVenue) {
        console.log(`  ${inr(r.revenue).padEnd(12)} ${String(r.bookings).padStart(4)} bkg  ${r.name}${r.isDeleted ? '  [DELETED]' : ''}`);
    }
    console.log(`  ---- Venue total: ${inr(venueTotal)} across ${byVenue.length} venue(s) ----`);

    console.log(`\n=== PLATFORM REVENUE: ${inr(ticketTotal + venueTotal)} (ticket ${inr(ticketTotal)} + venue ${inr(venueTotal)}) ===\n`);

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
