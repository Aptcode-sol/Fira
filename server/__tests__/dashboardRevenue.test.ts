/**
 * Organizer overview revenue = Σ Ticket.price over the organizer's events.
 *
 * Ticket.price is the line total (unit price × quantity). The overview used to
 * price every attendee at the event's base ticketPrice, and the event page
 * multiplied the line total by quantity again - both disagreed with the admin
 * panel, which sums Ticket.price.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const dashboardService = require('../services/dashboardService');

describe('dashboardService.getOverviewStats — totalRevenue', () => {
    it('sums ticket line totals: 2 bookings × 2 tickets at ₹499 = ₹1,996', async () => {
        const db = mongoose.connection.db!;
        const organizer = new mongoose.Types.ObjectId();
        const other = new mongoose.Types.ObjectId();
        const eventId = new mongoose.Types.ObjectId();
        const otherEvent = new mongoose.Types.ObjectId();

        await db.collection('users').insertOne({ _id: organizer, name: 'Org', email: 'o@x.test' });
        await db.collection('events').insertMany([
            { _id: eventId, name: 'Dandiya', organizer, ticketPrice: 299, currentAttendees: 4, maxAttendees: 300 },
            { _id: otherEvent, name: 'Not mine', organizer: other, ticketPrice: 100, currentAttendees: 1, maxAttendees: 10 },
        ]);
        await db.collection('tickets').insertMany([
            { event: eventId, user: other, quantity: 2, price: 998, ticketId: 'T1' },
            { event: eventId, user: other, quantity: 2, price: 998, ticketId: 'T2' },
            { event: otherEvent, user: organizer, quantity: 1, price: 100, ticketId: 'T3' },
        ]);

        const overview = await dashboardService.getOverviewStats(organizer.toString());
        expect(overview.stats.totalRevenue).toBe(1996);
    });
});
