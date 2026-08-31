/**
 * Task 6.1 — the three admin settlement routes.
 *
 * supertest over the REAL admin router (mounted on a bare express app with a
 * real User + signed JWT), so adminAuth, the role guard, the zod validate
 * middleware and the error mapping are all exercised as they ship:
 *   1. GET returns the listing's figures, state and ledger (Req 1, 2, 3, 11.1).
 *   2. POST records an entry and returns the refolded ledger (Req 4.1, 4.2).
 *   3. A malformed body is rejected by zod before the service is reached, and
 *      nothing is written (Req 4.7, 4.8, 4.9, 6.3).
 *   4. An over-settlement rejection carries code + netPayable + settledToDate +
 *      maxRecordable (Req 5.2).
 *   5. The reversal route appends a reversal; a blank reason is a 400 (Req 7.1, 7.7).
 *   6. A moderator, an admin session carrying NO adminRole, and no session at
 *      all are all refused and write nothing (Req 11.2, 11.3, 11.4, 11.6).
 *
 * Case 6's middle row is the one this task had to decide: roleGuard deliberately
 * calls next() when `adminRole` is falsy, so these routes name the role
 * explicitly instead of relying on the shared guard alone.
 *
 * Feature: per-listing-settlement-tracking, Task 6.1
 * Validates: Requirements 4.7, 4.8, 4.9, 5.2, 5.4, 5.5, 6.3, 7.5, 7.6, 7.7,
 *            7.8, 11.1, 11.2, 11.3, 11.4
 */
import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import './setup';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
delete process.env.REDIS_HOST; // skip the Redis blocklist path in auth

const adminRoutes = require('../routes/admin');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Settlement = require('../models/Settlement');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

const tokenFor = (u: any) => jwt.sign({ userId: String(u._id) }, process.env.JWT_SECRET as string);

async function makeAdmin(name: string, adminRole?: string) {
  return User.create({
    name,
    email: `${new mongoose.Types.ObjectId()}@x.test`,
    password: 'x',
    role: 'admin',
    roles: ['admin'],
    ...(adminRole ? { adminRole } : {}),
  });
}

async function makeOrganizer() {
  return User.create({ name: 'Olive Organizer', email: `${new mongoose.Types.ObjectId()}@x.test`, password: 'x' });
}

async function makeEvent(organizer: any) {
  const _id = new mongoose.Types.ObjectId();
  await mongoose.connection
    .db!.collection('events')
    .insertOne({ _id, name: 'Sunburn Arena', organizer: organizer._id, status: 'approved' });
  return _id;
}

/** netPayable 9000 for the event: one success Payment plus the recorded Payout. */
async function seedEventMoney(eventId: mongoose.Types.ObjectId) {
  await Payment.create({
    user: new mongoose.Types.ObjectId(),
    type: 'ticket_purchase',
    referenceId: eventId,
    referenceModel: 'Event',
    amount: 10000,
    platformFee: 500,
    gstAmount: 1800,
    totalAmount: 11800,
    status: 'success',
    paidAt: new Date('2024-05-01T10:00:00.000Z'),
  });
  await mongoose.connection.db!.collection('payouts').insertOne({
    _id: new mongoose.Types.ObjectId(),
    recipient: new mongoose.Types.ObjectId(),
    type: 'event_tickets',
    referenceId: eventId,
    referenceModel: 'Event',
    grossAmount: 10000,
    platformCommission: 1000,
    netAmount: 9000,
    status: 'completed',
    createdAt: new Date('2024-05-03T00:00:00.000Z'),
  });
}

const body = (over: Record<string, any> = {}) => ({
  settledAmount: 5000,
  settlementReference: 'UTR-4411',
  settledAt: '2024-05-04T00:00:00.000Z',
  idempotencyKey: 'key-1',
  ...over,
});

let admin: any;
let eventId: mongoose.Types.ObjectId;
let base: string;

beforeEach(async () => {
  await Settlement.init(); // the unique index is part of what the routes lean on
  admin = await makeAdmin('Ada Admin', 'admin');
  eventId = await makeEvent(await makeOrganizer());
  await seedEventMoney(eventId);
  base = `/api/admin/listings/event/${eventId}/settlement`;
});

describe('GET /listings/:kind/:id/settlement', () => {
  it('returns the figures, the state and the ledger', async () => {
    const res = await request(app).get(base).set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.listing).toMatchObject({ kind: 'event', id: String(eventId), name: 'Sunburn Arena' });
    expect(res.body.money).toMatchObject({ netPayable: 9000, settledToDate: 0, outstandingAmount: 9000 });
    expect(res.body.state).toBe('not_settled');
    expect(res.body.entries).toEqual([]);
  });

  it('404s an unknown listing rather than reporting an empty ledger', async () => {
    const res = await request(app)
      .get(`/api/admin/listings/event/${new mongoose.Types.ObjectId()}/settlement`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(404);
    expect(res.body.money).toBeUndefined();
  });
});

describe('POST /listings/:kind/:id/settlement/entries', () => {
  it('records the entry and returns the refolded ledger', async () => {
    const res = await request(app)
      .post(`${base}/entries`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send(body());

    expect(res.status).toBe(200);
    expect(res.body.entry).toMatchObject({ settledAmount: 5000, settlementReference: 'UTR-4411', method: 'manual' });
    expect(res.body.ledger).toMatchObject({ settledToDate: 5000, outstandingAmount: 4000 });
    expect(res.body.state).toBe('partially_settled');
    expect(await Settlement.countDocuments({ listing: eventId })).toBe(1);
  });

  it.each([
    ['fractional amount', { settledAmount: 5000.5 }],
    ['zero amount', { settledAmount: 0 }],
    ['blank reference', { settlementReference: '   ' }],
    ['unparseable date', { settledAt: 'not-a-date' }],
    ['missing idempotency key', { idempotencyKey: '' }],
  ])('rejects a %s before the service is reached, writing nothing', async (_label, over) => {
    const res = await request(app)
      .post(`${base}/entries`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send(body(over));

    expect(res.status).toBe(400);
    expect(await Settlement.countDocuments({})).toBe(0);
  });

  it('carries the over-settlement figures on a rejection', async () => {
    const res = await request(app)
      .post(`${base}/entries`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send(body({ settledAmount: 12000 }));

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'over_settlement',
      netPayable: 9000,
      settledToDate: 0,
      maxRecordable: 9000,
    });
    expect(await Settlement.countDocuments({})).toBe(0);
  });

  it('refuses an override from a non-super_admin', async () => {
    const res = await request(app)
      .post(`${base}/entries`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send(body({ settledAmount: 12000, override: true, overrideReason: 'agreed with finance' }));

    expect(res.status).toBe(403);
    expect(await Settlement.countDocuments({})).toBe(0);
  });
});

describe('POST /listings/:kind/:id/settlement/entries/:entryId/reversal', () => {
  const recorded = async () => {
    const res = await request(app)
      .post(`${base}/entries`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send(body());
    return res.body.entry._id as string;
  };

  it('appends a reversal and nets the pair out', async () => {
    const entryId = await recorded();

    const res = await request(app)
      .post(`${base}/entries/${entryId}/reversal`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ reason: 'wrong beneficiary' });

    expect(res.status).toBe(200);
    expect(res.body.ledger).toMatchObject({ settledToDate: 0, outstandingAmount: 9000 });
    expect(res.body.state).toBe('not_settled');
    // Append-only: the original row is still there alongside its reversal.
    expect(await Settlement.countDocuments({ listing: eventId })).toBe(2);
  });

  it('rejects a blank reason and writes no reversal', async () => {
    const entryId = await recorded();

    const res = await request(app)
      .post(`${base}/entries/${entryId}/reversal`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ reason: '   ' });

    expect(res.status).toBe(400);
    expect(await Settlement.countDocuments({ listing: eventId })).toBe(1);
  });

  it('404s a reversal target that does not exist', async () => {
    const res = await request(app)
      .post(`${base}/entries/${new mongoose.Types.ObjectId()}/reversal`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({ reason: 'wrong beneficiary' });

    expect(res.status).toBe(404);
    expect(await Settlement.countDocuments({})).toBe(0);
  });
});

describe('access control (Req 11.2, 11.3, 11.4, 11.6)', () => {
  it('refuses a moderator on every settlement route and writes nothing', async () => {
    const moderator = await makeAdmin('Mo Moderator', 'moderator');
    const auth = `Bearer ${tokenFor(moderator)}`;

    expect((await request(app).get(base).set('Authorization', auth)).status).toBe(403);
    expect((await request(app).post(`${base}/entries`).set('Authorization', auth).send(body())).status).toBe(403);
    expect(
      (await request(app)
        .post(`${base}/entries/${new mongoose.Types.ObjectId()}/reversal`)
        .set('Authorization', auth)
        .send({ reason: 'x' })).status
    ).toBe(403);
    expect(await Settlement.countDocuments({})).toBe(0);
  });

  it('refuses an admin session carrying no adminRole and writes nothing', async () => {
    // roleGuard alone would call next() here (its documented legacy fallback).
    const legacy = await makeAdmin('Len Legacy');
    expect(legacy.adminRole).toBeFalsy();
    const auth = `Bearer ${tokenFor(legacy)}`;

    expect((await request(app).get(base).set('Authorization', auth)).status).toBe(403);
    expect((await request(app).post(`${base}/entries`).set('Authorization', auth).send(body())).status).toBe(403);
    expect(await Settlement.countDocuments({})).toBe(0);
  });

  it('refuses a request with no session and returns no figures', async () => {
    const res = await request(app).get(base);

    expect(res.status).toBe(401);
    expect(res.body.money).toBeUndefined();
  });
});
