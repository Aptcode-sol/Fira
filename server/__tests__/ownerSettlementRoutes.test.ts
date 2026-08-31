/**
 * Task 6.2 — the two owner GET routes.
 *
 * supertest over the real routers (no mocked service, in-memory Mongo), which is
 * what makes "the route is mounted, behind the same auth as /earnings, mapping
 * the service's status verbatim" a checkable claim rather than a code reading:
 *   1. An owner gets 200 and the owner DTO for their own event / venue
 *      (Requirements 9.1, 9.2).
 *   2. A non-owner gets the service's 403 with no money figures in the body,
 *      exactly as /earnings does today (Requirement 11.5).
 *   3. No token is a 401 from the auth middleware — the service is never reached.
 *   4. Every write verb on the same path is unroutable: the owner surface is
 *      read-only (Requirement 9.6).
 *
 * Feature: per-listing-settlement-tracking, Task 6.2
 * Validates: Requirements 9.1, 9.2, 9.6, 11.5
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import './setup';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
delete process.env.REDIS_HOST; // skip the Redis blocklist path in auth

const eventRoutes = require('../routes/event');
const venueRoutes = require('../routes/venue');
const User = require('../models/User');
const Settlement = require('../models/Settlement');

const app = express();
app.use(express.json());
app.use('/api/events', eventRoutes);
app.use('/api/venues', venueRoutes);

async function makeUser(name = 'Olive Owner') {
  return User.create({ email: `u_${Math.random().toString(36).slice(2)}@test.com`, password: 'x', name });
}
const tokenFor = (u: any) => jwt.sign({ userId: u._id.toString() }, process.env.JWT_SECRET as string);

/** Raw inserts, as in listingSettlementRead.test.ts: the full required field sets are fixture noise here. */
async function makeEvent(organizer: any) {
  const _id = new mongoose.Types.ObjectId();
  await mongoose.connection.db!.collection('events').insertOne({ _id, name: 'Sunburn Arena', organizer: organizer._id });
  return _id;
}
async function makeVenue(owner: any) {
  const _id = new mongoose.Types.ObjectId();
  await mongoose.connection.db!.collection('venues').insertOne({ _id, name: 'Grand Hall', owner: owner._id });
  return _id;
}

describe('GET /api/events/:id/settlement (Req 9.1, 9.2, 11.5)', () => {
  it('answers the organizer with the owner DTO and nothing admin-internal', async () => {
    const organizer = await makeUser();
    const admin = await makeUser('Ada Admin');
    const eventId = await makeEvent(organizer);
    await Settlement.create({
      listingKind: 'event',
      listing: eventId,
      listingModel: 'Event',
      settledAmount: 5000,
      settlementReference: 'UTR-1',
      settledAt: new Date('2024-05-02T00:00:00.000Z'),
      method: 'manual',
      adminNotes: 'SENTINEL-NOTE',
      recordedBy: admin._id,
      idempotencyKey: 'key-1',
    });

    const res = await request(app)
      .get(`/api/events/${eventId}/settlement`)
      .set('Authorization', `Bearer ${tokenFor(organizer)}`);

    expect(res.status).toBe(200);
    expect(res.body.listing).toEqual({ kind: 'event', id: String(eventId), name: 'Sunburn Arena' });
    expect(res.body.money.settledToDate).toBe(5000);
    expect(res.body.state).toBe('over_settled'); // ₹5000 settled against a ₹0 net payable
    expect(res.body.entries).toEqual([
      { settledAmount: 5000, settlementReference: 'UTR-1', settledAt: '2024-05-02T00:00:00.000Z', reversed: false },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('SENTINEL-NOTE');
  });

  it('maps the service 403 verbatim and returns no money figures to a non-owner', async () => {
    const organizer = await makeUser();
    const stranger = await makeUser('Sam Stranger');
    const eventId = await makeEvent(organizer);

    const res = await request(app)
      .get(`/api/events/${eventId}/settlement`)
      .set('Authorization', `Bearer ${tokenFor(stranger)}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Not authorized to view settlement for this event' });
  });

  it('rejects an unauthenticated request before the service is reached', async () => {
    const eventId = await makeEvent(await makeUser());
    const res = await request(app).get(`/api/events/${eventId}/settlement`);
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('money');
  });
});

describe('GET /api/venues/:id/settlement (Req 9.1, 9.2, 11.5)', () => {
  it('answers the venue owner and refuses everyone else with the same 403', async () => {
    const owner = await makeUser('Vera Owner');
    const stranger = await makeUser('Sam Stranger');
    const venueId = await makeVenue(owner);

    const ok = await request(app)
      .get(`/api/venues/${venueId}/settlement`)
      .set('Authorization', `Bearer ${tokenFor(owner)}`);
    expect(ok.status).toBe(200);
    expect(ok.body.listing).toEqual({ kind: 'venue', id: String(venueId), name: 'Grand Hall' });
    expect(ok.body.state).toBe('not_settled');
    expect(ok.body.entries).toEqual([]);

    const denied = await request(app)
      .get(`/api/venues/${venueId}/settlement`)
      .set('Authorization', `Bearer ${tokenFor(stranger)}`);
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: 'Not authorized to view settlement for this venue' });
  });
});

describe('the owner settlement surface is read-only (Req 9.6)', () => {
  it('routes no write verb on either settlement path', async () => {
    const owner = await makeUser();
    const eventId = await makeEvent(owner);
    const venueId = await makeVenue(owner);
    const token = tokenFor(owner);

    for (const path of [`/api/events/${eventId}/settlement`, `/api/venues/${venueId}/settlement`]) {
      for (const verb of ['post', 'put', 'patch', 'delete'] as const) {
        const res = await request(app)[verb](path).set('Authorization', `Bearer ${token}`).send({});
        expect(res.status, `${verb.toUpperCase()} ${path}`).toBe(404);
      }
    }
  });
});
