/**
 * Access control on the booking routes.
 *
 * PUT /bookings/:id/status had no auth at all, so anyone could accept, reject
 * or complete any booking; edit/cancel/read only required being signed in as
 * *somebody*, and the list routes were public. Each route now checks who the
 * caller is relative to the booking: the guest who made it, the owner of its
 * venue, or an admin.
 *
 * Uses the real auth middleware with real signed tokens - vi.mock cannot reach
 * the route's CommonJS require() of the middleware.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import './setup';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
delete process.env.REDIS_HOST;

const Booking = require('../models/Booking');

let app: express.Express;
let guest: string, owner: string, stranger: string, admin: string;
let venueId: mongoose.Types.ObjectId;
const tokens: Record<string, string> = {};

/** Insert a user and remember a bearer token for them. */
async function makeUser(role = 'user') {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('users').insertOne({
        _id, name: role, email: `${_id}@x.test`, role, roles: [role],
    });
    const id = _id.toString();
    tokens[id] = jwt.sign({ userId: id, role }, process.env.JWT_SECRET!);
    return id;
}

const bearer = (id: string) => `Bearer ${tokens[id]}`;

async function makeBooking(status = 'pending') {
    return Booking.create({
        user: guest,
        venue: venueId,
        bookingDate: new Date('2026-12-20T00:00:00Z'),
        startTime: '10:00',
        endTime: '14:00',
        totalAmount: 1000,
        status,
    });
}

beforeEach(async () => {
    guest = await makeUser();
    owner = await makeUser('venue_owner');
    stranger = await makeUser();
    admin = await makeUser('admin');
    venueId = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('venues').insertOne({
        _id: venueId, name: 'V', owner: new mongoose.Types.ObjectId(owner),
    });

    app = express();
    app.use(express.json());
    const routes = await import('../routes/booking');
    app.use('/bookings', (routes as any).default || routes);
});

describe('PUT /bookings/:id/status', () => {
    it('rejects an unauthenticated caller', async () => {
        const b = await makeBooking();
        const res = await request(app).put(`/bookings/${b._id}/status`).send({ status: 'accepted' });
        expect(res.status).toBe(401);
        expect((await Booking.findById(b._id)).status).toBe('pending');
    });

    it('rejects a signed-in user who does not own the venue - including the guest', async () => {
        const b = await makeBooking();
        for (const who of [stranger, guest]) {
            const res = await request(app)
                .put(`/bookings/${b._id}/status`)
                .set('Authorization', bearer(who))
                .send({ status: 'accepted' });
            expect(res.status).toBe(403);
        }
        expect((await Booking.findById(b._id)).status).toBe('pending');
    });

    it('lets the venue owner reject, and saves the reason the owner apps send', async () => {
        const b = await makeBooking();
        const res = await request(app)
            .put(`/bookings/${b._id}/status`)
            .set('Authorization', bearer(owner))
            .send({ status: 'rejected', reason: 'Closed for renovation' });
        expect(res.status).toBe(200);
        const saved = await Booking.findById(b._id);
        expect(saved.status).toBe('rejected');
        expect(saved.rejectionReason).toBe('Closed for renovation');
    });

    it('refuses statuses and transitions an owner may not make', async () => {
        const b = await makeBooking('cancelled');
        const asOwner = (status: string) =>
            request(app).put(`/bookings/${b._id}/status`).set('Authorization', bearer(owner)).send({ status });
        expect((await asOwner('accepted')).status).toBe(400); // cancelled -> accepted
        expect((await asOwner('pending')).status).toBe(400); // not an owner status
    });
});

describe('other per-booking routes', () => {
    it('GET /:id is limited to the guest, the venue owner and admins', async () => {
        const b = await makeBooking();
        const get = (who: string) => request(app).get(`/bookings/${b._id}`).set('Authorization', bearer(who));
        expect((await get(stranger)).status).toBe(403);
        expect((await get(guest)).status).toBe(200);
        expect((await get(owner)).status).toBe(200);
        expect((await get(admin)).status).toBe(200);
    });

    it('GET /venue/:venueId is limited to the venue owner', async () => {
        await makeBooking();
        const asStranger = await request(app).get(`/bookings/venue/${venueId}`).set('Authorization', bearer(stranger));
        expect(asStranger.status).toBe(403);
        const res = await request(app).get(`/bookings/venue/${venueId}`).set('Authorization', bearer(owner));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    it('PUT /:id lets only the guest edit, and only the descriptive fields', async () => {
        const b = await makeBooking();
        const asStranger = await request(app)
            .put(`/bookings/${b._id}`)
            .set('Authorization', bearer(stranger))
            .send({ purpose: 'x' });
        expect(asStranger.status).toBe(403);

        const res = await request(app)
            .put(`/bookings/${b._id}`)
            .set('Authorization', bearer(guest))
            .send({ purpose: 'Wedding', status: 'accepted', totalAmount: 1, paymentStatus: 'paid' });
        expect(res.status).toBe(200);
        const saved = await Booking.findById(b._id);
        expect(saved.purpose).toBe('Wedding');
        expect(saved.status).toBe('pending');
        expect(saved.totalAmount).toBe(1000);
        expect(saved.paymentStatus).toBe('pending');
    });

    it('POST /:id/cancel refuses anyone but the guest', async () => {
        const b = await makeBooking('accepted');
        const res = await request(app).post(`/bookings/${b._id}/cancel`).set('Authorization', bearer(stranger));
        expect(res.status).toBe(403);
        expect((await Booking.findById(b._id)).status).toBe('accepted');
    });
});

describe('GET /bookings', () => {
    it('requires sign-in', async () => {
        expect((await request(app).get('/bookings')).status).toBe(401);
    });

    it("lists only the caller's own bookings for a non-admin, whatever user filter is sent", async () => {
        await makeBooking();
        const res = await request(app).get(`/bookings?user=${guest}`).set('Authorization', bearer(stranger));
        expect(res.status).toBe(200);
        expect(res.body.bookings).toHaveLength(0);

        const own = await request(app).get('/bookings').set('Authorization', bearer(guest));
        expect(own.body.bookings).toHaveLength(1);
    });
});
