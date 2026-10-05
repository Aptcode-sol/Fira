/**
 * Regression check — a venue date that already has a pending or accepted
 * booking must not be bookable again by a second user.
 *
 * `createBooking` used to go straight to `Booking.create(data)` with no check
 * against existing bookings for the same venue+day, so two guests could each
 * get a 201 for the same date. The fix adds an app-level pre-check plus a
 * partial unique index on (venue, bookingDate) as an atomic backstop for the
 * race the pre-check alone cannot close.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const bookingService = require('../services/bookingService');
const Booking = require('../models/Booking');

async function makeUser(name: string) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('users').insertOne({ _id, name, email: `${_id}@x.test` });
    return _id;
}

async function makeVenue() {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('venues').insertOne({
        _id,
        name: 'Test Venue',
        pricing: { basePrice: 1000, currency: 'INR' },
        capacity: { min: 10, max: 100 },
    });
    return _id;
}

function bookingInput(over: Record<string, any> = {}) {
    return {
        bookingDate: new Date('2026-11-20T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '14:00',
        purpose: 'Birthday',
        expectedGuests: 50,
        totalAmount: 1000,
        status: 'pending',
        bookingType: 'personal',
        ...over,
    };
}

let venueId: mongoose.Types.ObjectId;
let userA: mongoose.Types.ObjectId;
let userB: mongoose.Types.ObjectId;

beforeEach(async () => {
    // The partial unique index must exist for the atomic backstop to be under
    // test rather than assumed.
    await Booking.init();
    venueId = await makeVenue();
    userA = await makeUser('Guest A');
    userB = await makeUser('Guest B');
});

describe('createBooking — same-day conflict (double-booking fix)', () => {
    it('rejects a second pending booking for a date another user already booked', async () => {
        await bookingService.createBooking(bookingInput({ user: userA, venue: venueId }));

        await expect(
            bookingService.createBooking(
                bookingInput({ user: userB, venue: venueId, startTime: '18:00', endTime: '20:00' })
            )
        ).rejects.toThrow('This date is no longer available for this venue');

        expect(await Booking.countDocuments({ venue: venueId })).toBe(1);
    });

    it('rejects a second booking even against an already-accepted booking', async () => {
        const first = await bookingService.createBooking(bookingInput({ user: userA, venue: venueId }));
        await Booking.findByIdAndUpdate(first._id, { $set: { status: 'accepted' } });

        await expect(
            bookingService.createBooking(bookingInput({ user: userB, venue: venueId }))
        ).rejects.toThrow('This date is no longer available for this venue');
    });

    it('allows a second booking once the first was rejected or cancelled', async () => {
        const first = await bookingService.createBooking(bookingInput({ user: userA, venue: venueId }));
        await Booking.findByIdAndUpdate(first._id, { $set: { status: 'rejected' } });

        const second = await bookingService.createBooking(bookingInput({ user: userB, venue: venueId }));
        expect(second).toBeTruthy();
        expect(await Booking.countDocuments({ venue: venueId })).toBe(2);
    });

    it('allows bookings for the same venue on different dates', async () => {
        await bookingService.createBooking(bookingInput({ user: userA, venue: venueId }));

        const second = await bookingService.createBooking(
            bookingInput({ user: userB, venue: venueId, bookingDate: new Date('2026-11-21T00:00:00.000Z') })
        );
        expect(second).toBeTruthy();
        expect(await Booking.countDocuments({ venue: venueId })).toBe(2);
    });

    it('closes the race the pre-check alone cannot: the DB index rejects a concurrent duplicate', async () => {
        // Simulate two requests that both pass the pre-check read before either
        // write lands, by bypassing the service's findOne guard and inserting
        // twice directly — the partial unique index must be what stops the second.
        await Booking.create(bookingInput({ user: userA, venue: venueId }));

        await expect(
            Booking.create(bookingInput({ user: userB, venue: venueId }))
        ).rejects.toMatchObject({ code: 11000 });

        expect(await Booking.countDocuments({ venue: venueId })).toBe(1);
    });
});

describe('createBooking — same-day start/end time validation', () => {
    it('rejects identical start and end time on a same-day booking', async () => {
        await expect(
            bookingService.createBooking(
                bookingInput({ user: userA, venue: venueId, startTime: '14:00', endTime: '14:00' })
            )
        ).rejects.toThrow('End time must be after start time');

        expect(await Booking.countDocuments({ venue: venueId })).toBe(0);
    });

    it('rejects an end time before the start time on a same-day booking', async () => {
        await expect(
            bookingService.createBooking(
                bookingInput({ user: userA, venue: venueId, startTime: '18:00', endTime: '10:00' })
            )
        ).rejects.toThrow('End time must be after start time');
    });

    it('rejects an end date before the start date', async () => {
        await expect(
            bookingService.createBooking(
                bookingInput({
                    user: userA,
                    venue: venueId,
                    bookingDate: new Date('2026-11-20T00:00:00.000Z'),
                    endDate: new Date('2026-11-19T00:00:00.000Z'),
                })
            )
        ).rejects.toThrow('End date must be on or after the start date');
    });

    it('allows identical start and end time when the booking spans multiple days', async () => {
        const booking = await bookingService.createBooking(
            bookingInput({
                user: userA,
                venue: venueId,
                bookingDate: new Date('2026-11-20T00:00:00.000Z'),
                endDate: new Date('2026-11-21T00:00:00.000Z'),
                startTime: '14:00',
                endTime: '14:00',
            })
        );
        expect(booking).toBeTruthy();
    });

    it('allows a valid same-day booking with a real duration', async () => {
        const booking = await bookingService.createBooking(
            bookingInput({ user: userA, venue: venueId, startTime: '10:00', endTime: '14:00' })
        );
        expect(booking).toBeTruthy();
    });
});

describe('createBooking — multi-day ranges', () => {
    const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

    it('rejects a range whose LAST day is already booked (21st-22nd over a booked 22nd)', async () => {
        await bookingService.createBooking(bookingInput({ user: userA, venue: venueId, bookingDate: day('2026-11-22') }));

        await expect(
            bookingService.createBooking(
                bookingInput({ user: userB, venue: venueId, bookingDate: day('2026-11-21'), endDate: day('2026-11-22') })
            )
        ).rejects.toThrow('One or more of the selected dates is no longer available for this venue');
    });

    it('rejects a single day that falls inside an existing multi-day booking', async () => {
        await bookingService.createBooking(
            bookingInput({ user: userA, venue: venueId, bookingDate: day('2026-11-20'), endDate: day('2026-11-22') })
        );

        await expect(
            bookingService.createBooking(bookingInput({ user: userB, venue: venueId, bookingDate: day('2026-11-21') }))
        ).rejects.toThrow('This date is no longer available for this venue');
    });

    it('allows a range that ends the day before an existing booking', async () => {
        await bookingService.createBooking(bookingInput({ user: userA, venue: venueId, bookingDate: day('2026-11-22') }));

        const ok = await bookingService.createBooking(
            bookingInput({ user: userB, venue: venueId, bookingDate: day('2026-11-20'), endDate: day('2026-11-21') })
        );
        expect(ok.endDate?.toISOString()).toBe('2026-11-21T00:00:00.000Z');
    });

    it('prices the booking server-side as day rate × days, ignoring the client total', async () => {
        const b = await bookingService.createBooking(
            bookingInput({
                user: userA, venue: venueId, totalAmount: 1,
                bookingDate: day('2026-11-20'), endDate: day('2026-11-22'),
            })
        );
        expect(b.totalAmount).toBe(3000); // basePrice 1000 × 3 days
    });

    it('rejects a range that crosses an owner-blocked day', async () => {
        await mongoose.connection.db!.collection('venues').updateOne(
            { _id: venueId },
            { $set: { blockedDates: [{ date: '2026-11-21', slots: [{ startTime: '09:00', endTime: '12:00', type: 'busy' }] }] } }
        );

        await expect(
            bookingService.createBooking(
                bookingInput({ user: userA, venue: venueId, bookingDate: day('2026-11-20'), endDate: day('2026-11-22') })
            )
        ).rejects.toThrow('One or more of the selected dates is no longer available for this venue');
    });

    it('ignores a client-sent status - a new booking is always pending', async () => {
        const b = await bookingService.createBooking(
            bookingInput({ user: userA, venue: venueId, status: 'accepted', paymentStatus: 'paid' })
        );
        expect(b.status).toBe('pending');
        expect(b.paymentStatus).toBe('pending');
    });
});
