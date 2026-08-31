/**
 * Feature: per-listing-settlement-tracking, Property 18: Activity counts match
 * the underlying records.
 *
 * For any set of payment, ticket, and booking records for a listing, the
 * reported count of successful payments, units sold, confirmed units, cancelled
 * units, and refunded payments each equal the count over those records, and the
 * reported last payment timestamp equals the latest successful payment's
 * timestamp, or is absent when there is none.
 *
 * Under test: `earningsService.getListingFigures({ kind, listingId })` for both
 * listing kinds — `event` (Ticket-backed, unitsSold = Σ Ticket.quantity) and
 * `venue` (Booking-backed, unitsSold = count of bookings).
 *
 * The expected values are recomputed here from the generated record set with
 * plain JavaScript, independently of the aggregation pipeline the service uses,
 * so an aggregation that silently counts the wrong rows cannot agree by
 * construction.
 *
 * Real records in a real (in-memory) Mongo — no stubs: the counts ARE the
 * aggregation over the store, so stubbing the store would test nothing.
 *
 * Validates: Requirements 3.1, 3.4
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
// The in-memory Mongo server and its connection are owned by the shared setup
// file (registered as vitest `setupFiles`). Connecting a second one here throws
// "openUri() on an active connection with different connection strings".
import './setup';

const earningsService = require('../services/earningsService');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const User = require('../models/User');
// Registered so the payout read inside getListingFigures resolves its model.
require('../models/Payout');

// What "confirmed" and "cancelled" mean per kind (design, ListingActivity).
const TICKET_CONFIRMED = ['active', 'used'];
const TICKET_CANCELLED = ['cancelled'];
const BOOKING_CONFIRMED = ['accepted', 'completed'];
const BOOKING_CANCELLED = ['cancelled', 'rejected'];

// --- generators ------------------------------------------------------------

type TicketSpec = { quantity: number; status: string };
type BookingSpec = { status: string };
type PaymentSpec = { status: string; daysAgo: number };

// Statuses outside the confirmed/cancelled sets ('expired', 'pending') are
// generated too: they must be counted in unitsSold but in neither bucket.
const ticketSpec = fc.record({
    quantity: fc.integer({ min: 1, max: 5 }),
    status: fc.constantFrom('active', 'used', 'cancelled', 'expired'),
});

const bookingSpec = fc.record({
    status: fc.constantFrom('pending', 'accepted', 'rejected', 'cancelled', 'completed'),
});

// 'pending'/'failed' payments must land in neither count. `daysAgo` spreads the
// success timestamps so the max is a real maximum and not a tie.
const paymentSpec = fc.record({
    status: fc.constantFrom('success', 'refunded', 'pending', 'failed'),
    daysAgo: fc.integer({ min: 1, max: 400 }),
});

// minLength 0 — the empty record set is part of the generated domain and is the
// Requirement 3.4 boundary (every count 0, lastPaymentAt absent).
const ticketSets = fc.array(ticketSpec, { minLength: 0, maxLength: 6 });
const bookingSets = fc.array(bookingSpec, { minLength: 0, maxLength: 6 });
const paymentSets = fc.array(paymentSpec, { minLength: 0, maxLength: 6 });

// --- fixtures --------------------------------------------------------------

const NOW = Date.now();
const paidAtOf = (daysAgo: number) => new Date(NOW - daysAgo * 24 * 3600 * 1000);
// Sentinel: a refunded payment is stamped at NOW, later than every success
// timestamp. If lastPaymentAt ever included a refunded row, the assertion fails.
const REFUNDED_PAID_AT = new Date(NOW);

async function makeUser() {
    return User.create({
        email: `u_${Math.random().toString(36).slice(2)}@test.com`,
        password: 'x',
        name: 'Test User',
    });
}

async function makeEvent(organizerId: any) {
    return Event.create({
        organizer: organizerId,
        name: 'Test Event',
        description: 'desc',
        startDateTime: new Date(NOW + 7 * 24 * 3600 * 1000),
        endDateTime: new Date(NOW + 8 * 24 * 3600 * 1000),
        maxAttendees: 100000,
    });
}

async function makeVenue(ownerId: any) {
    return Venue.create({
        owner: ownerId,
        name: 'Test Venue',
        description: 'desc',
        capacity: { max: 500 },
        pricing: { basePrice: 10000, pricePerDay: 10000 },
        address: { street: 'S', city: 'Pune', state: 'MH', pincode: '411001' },
    });
}

async function insertPayments(
    specs: PaymentSpec[],
    userId: any,
    referenceModel: 'Event' | 'Booking',
    referenceIdFor: (index: number) => any
) {
    if (!specs.length) return;
    await Payment.insertMany(
        specs.map((s, i) => ({
            user: userId,
            type: referenceModel === 'Event' ? 'ticket_purchase' : 'venue_booking',
            referenceId: referenceIdFor(i),
            referenceModel,
            amount: 1000,
            totalAmount: 1000,
            status: s.status,
            paidAt: s.status === 'refunded' ? REFUNDED_PAID_AT : paidAtOf(s.daysAgo),
        }))
    );
}

// The expectation, recomputed from the generated specs alone.
function expectedPaymentCounts(specs: PaymentSpec[]) {
    const successes = specs.filter((s) => s.status === 'success');
    return {
        successfulPayments: successes.length,
        refundedPayments: specs.filter((s) => s.status === 'refunded').length,
        lastPaymentAt: successes.length
            ? new Date(Math.max(...successes.map((s) => paidAtOf(s.daysAgo).getTime())))
            : null,
    };
}

function assertActivity(activity: any, expected: any) {
    expect(activity.successfulPayments).toBe(expected.successfulPayments);
    expect(activity.refundedPayments).toBe(expected.refundedPayments);
    expect(activity.unitsSold).toBe(expected.unitsSold);
    expect(activity.confirmed).toBe(expected.confirmed);
    expect(activity.cancelled).toBe(expected.cancelled);
    if (expected.lastPaymentAt === null) {
        expect(activity.lastPaymentAt).toBeNull();
    } else {
        expect(activity.lastPaymentAt).toBeInstanceOf(Date);
        expect(activity.lastPaymentAt.getTime()).toBe(expected.lastPaymentAt.getTime());
    }
}

async function clearRecords() {
    await Promise.all([
        Ticket.deleteMany({}),
        Booking.deleteMany({}),
        Payment.deleteMany({}),
        Event.deleteMany({}),
        Venue.deleteMany({}),
        User.deleteMany({}),
    ]);
}

// 100 property runs, each doing a handful of real DB round-trips, comfortably
// outrun vitest's 5s default when the whole suite runs in parallel — and a
// timed-out run keeps clearing records in the background, wiping the next
// test's fixtures. So both tests carry an explicit timeout.
const PROPERTY_TIMEOUT_MS = 60000;

describe('Property 18 — activity counts match the underlying records', () => {
    it('event listing: counts and last payment timestamp match the generated tickets and payments', async () => {
        await fc.assert(
            fc.asyncProperty(ticketSets, paymentSets, async (tickets: TicketSpec[], payments: PaymentSpec[]) => {
                const organizer = await makeUser();
                const buyer = await makeUser();
                const event = await makeEvent(organizer._id);

                if (tickets.length) {
                    await Ticket.insertMany(
                        tickets.map((t, i) => ({
                            ticketId: `T_${String(event._id)}_${i}`,
                            user: buyer._id,
                            event: event._id,
                            quantity: t.quantity,
                            status: t.status,
                        }))
                    );
                }
                // Event-kind payments reference the event itself.
                await insertPayments(payments, buyer._id, 'Event', () => event._id);

                const figures = await earningsService.getListingFigures({
                    kind: 'event',
                    listingId: String(event._id),
                });

                assertActivity(figures.activity, {
                    ...expectedPaymentCounts(payments),
                    unitsSold: tickets.reduce((sum, t) => sum + t.quantity, 0),
                    confirmed: tickets.filter((t) => TICKET_CONFIRMED.includes(t.status)).length,
                    cancelled: tickets.filter((t) => TICKET_CANCELLED.includes(t.status)).length,
                });

                await clearRecords();
            }),
            { numRuns: 25 }
        );
    }, PROPERTY_TIMEOUT_MS);

    it('venue listing: counts and last payment timestamp match the generated bookings and payments', async () => {
        await fc.assert(
            fc.asyncProperty(bookingSets, paymentSets, async (bookings: BookingSpec[], payments: PaymentSpec[]) => {
                const owner = await makeUser();
                const guest = await makeUser();
                const venue = await makeVenue(owner._id);

                const bookingDocs = bookings.length
                    ? await Booking.insertMany(
                        bookings.map((b) => ({
                            user: guest._id,
                            venue: venue._id,
                            bookingDate: new Date(NOW + 3 * 24 * 3600 * 1000),
                            startTime: '10:00',
                            endTime: '12:00',
                            status: b.status,
                            totalAmount: 5000,
                        }))
                    )
                    : [];

                // Venue-kind payments reference that venue's bookings; with no
                // booking there is no reference to hang a payment on, which is
                // itself the boundary the service short-circuits.
                if (bookingDocs.length) {
                    await insertPayments(
                        payments,
                        guest._id,
                        'Booking',
                        (i) => bookingDocs[i % bookingDocs.length]._id
                    );
                }

                const figures = await earningsService.getListingFigures({
                    kind: 'venue',
                    listingId: String(venue._id),
                });

                const paymentCounts = bookingDocs.length
                    ? expectedPaymentCounts(payments)
                    : { successfulPayments: 0, refundedPayments: 0, lastPaymentAt: null };

                assertActivity(figures.activity, {
                    ...paymentCounts,
                    unitsSold: bookings.length,
                    confirmed: bookings.filter((b) => BOOKING_CONFIRMED.includes(b.status)).length,
                    cancelled: bookings.filter((b) => BOOKING_CANCELLED.includes(b.status)).length,
                });

                await clearRecords();
            }),
            { numRuns: 25 }
        );
    }, PROPERTY_TIMEOUT_MS);
});
