/**
 * Task 13.2 — messages route re-mounted + find-or-create inquiry-conversation handler.
 *
 * Expected_Behavior: canConverse(sender, owner) AND boundTo(conversation, inquiry)
 *   - POST /api/messages/start-inquiry-conversation creates a conversation between
 *     the inquiry sender and the reference (event/venue) owner, bound to the inquiry.
 *   - The handler is find-or-create: repeated calls for the same (sender, inquiry)
 *     reuse the same conversation (idempotent), for both event and venue references.
 *
 * The test mounts ONLY the message router on a minimal express app (with a real
 * User + signed JWT), which also proves the route mounts.
 *
 * Validates: Requirements 23.1
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import fc from 'fast-check';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
delete process.env.REDIS_HOST; // skip Redis blocklist path in auth middleware

const messageRoutes = require('../routes/message');
const User = require('../models/User');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Inquiry = require('../models/Inquiry');
const { Conversation } = require('../models');

const app = express();
app.use(express.json());
app.use('/api/messages', messageRoutes);

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  for (const collection of collections) await collection.deleteMany({});
});

const future = (days: number) => new Date(Date.now() + days * 24 * 3600 * 1000);

async function makeUser() {
  return User.create({
    email: `u_${Math.random().toString(36).slice(2)}@test.com`,
    password: 'x',
    name: 'Test User',
  });
}
const tokenFor = (u: any) => jwt.sign({ userId: u._id.toString() }, process.env.JWT_SECRET as string);

async function makeEvent(organizerId: any) {
  return Event.create({
    organizer: organizerId,
    name: 'Ref Event',
    description: 'desc',
    startDateTime: future(7),
    endDateTime: future(8),
    maxAttendees: 100,
    eventType: 'public',
  });
}
async function makeVenue(ownerId: any) {
  return Venue.create({
    owner: ownerId,
    name: 'Ref Venue',
    description: 'desc',
    capacity: { max: 100 },
    pricing: { basePrice: 1000 },
    address: { street: '1 Main St', city: 'Testville', state: 'TS', pincode: '000000' },
    location: { type: 'Point', coordinates: [0, 0] },
  });
}

async function makeInquiry(referenceType: 'event' | 'venue', referenceId: any, senderId: any) {
  return Inquiry.create({
    referenceType,
    referenceId,
    senderName: 'Sender',
    senderEmail: 'sender@test.com',
    message: 'I have a question about this listing.',
    user: senderId,
  });
}

describe('Task 13.2 — inquiry-conversation find-or-create (Property 12)', () => {
  it('binds a conversation to the inquiry between sender and owner, for event and venue refs', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom<'event' | 'venue'>('event', 'venue'), async (refType) => {
        // fresh DB per case
        for (const c of await mongoose.connection.db!.collections()) await c.deleteMany({});

        const owner = await makeUser();
        const sender = await makeUser();
        const ref = refType === 'event' ? await makeEvent(owner._id) : await makeVenue(owner._id);
        const inquiry = await makeInquiry(refType, ref._id, sender._id);

        const res = await request(app)
          .post('/api/messages/start-inquiry-conversation')
          .set('Authorization', `Bearer ${tokenFor(sender)}`)
          .send({ inquiryId: inquiry._id.toString(), message: 'Hello owner' });

        expect(res.status).toBe(201);
        const conv = res.body.conversation;
        // boundTo(conversation, inquiry)
        expect(conv.inquiry).toBe(inquiry._id.toString());
        // canConverse(sender, owner): both participants present
        const partIds = conv.participants.map((p: any) => (p._id || p).toString());
        expect(partIds).toContain(sender._id.toString());
        expect(partIds).toContain(owner._id.toString());
      }),
      { numRuns: 6 }
    );
  });

  it('is idempotent: repeated calls reuse the same conversation', async () => {
    const owner = await makeUser();
    const sender = await makeUser();
    const event = await makeEvent(owner._id);
    const inquiry = await makeInquiry('event', event._id, sender._id);
    const token = tokenFor(sender);

    const first = await request(app)
      .post('/api/messages/start-inquiry-conversation')
      .set('Authorization', `Bearer ${token}`)
      .send({ inquiryId: inquiry._id.toString(), message: 'first' });
    const second = await request(app)
      .post('/api/messages/start-inquiry-conversation')
      .set('Authorization', `Bearer ${token}`)
      .send({ inquiryId: inquiry._id.toString(), message: 'second' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.conversation._id).toBe(first.body.conversation._id);
    const count = await Conversation.countDocuments({ inquiry: inquiry._id });
    expect(count).toBe(1);
  });

  it('rejects a missing inquiry with 404', async () => {
    const sender = await makeUser();
    const res = await request(app)
      .post('/api/messages/start-inquiry-conversation')
      .set('Authorization', `Bearer ${tokenFor(sender)}`)
      .send({ inquiryId: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(404);
  });
});
