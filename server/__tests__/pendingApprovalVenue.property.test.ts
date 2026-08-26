/**
 * Flow 8.1 — admin pending-approval count/list excludes venue-less events.
 *
 * getPendingAdminApproval (the query behind the admin pending count + list)
 * must NOT count events that have no associated venue, while a genuinely
 * pending event that HAS a venue still counts (preservation 3.11).
 *
 * Validates: Requirements 8.1, 3.11
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const eventService = require('../services/eventService');
const Event = require('../models/Event');
const User = require('../models/User');
const Venue = require('../models/Venue');

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

async function makeVenue(ownerId: any) {
  return Venue.create({
    owner: ownerId,
    name: 'Test Venue',
    description: 'desc',
    capacity: { max: 100 },
    pricing: { basePrice: 1000 },
    address: { street: '1 Main St', city: 'Testville', state: 'TS', pincode: '000000' },
    location: { type: 'Point', coordinates: [0, 0] },
  });
}

async function makePendingEvent(organizerId: any, overrides: Record<string, any> = {}) {
  return Event.create({
    organizer: organizerId,
    name: 'Pending Event',
    description: 'desc',
    startDateTime: future(7),
    endDateTime: future(8),
    maxAttendees: 100,
    status: 'pending',
    eventType: 'public',
    adminApproval: { status: 'pending' },
    ...overrides,
  });
}

describe('Flow 8.1 — pending approval excludes venue-less events', () => {
  it('counts a genuinely pending event that HAS a venue (preservation 3.11)', async () => {
    const org = await makeUser();
    const venue = await makeVenue(org._id);
    await makePendingEvent(org._id, { name: 'PendingWithVenue', venue: venue._id });

    const { events, total } = await eventService.getPendingAdminApproval({});
    expect(total).toBe(1);
    expect(events.map((e: any) => e.name)).toContain('PendingWithVenue');
  });

  it('excludes a venue-less pending event from the count and list', async () => {
    const org = await makeUser();
    await makePendingEvent(org._id, { name: 'PendingNoVenue' }); // no venue

    const { events, total } = await eventService.getPendingAdminApproval({});
    expect(total).toBe(0);
    expect(events.map((e: any) => e.name)).not.toContain('PendingNoVenue');
  });

  it('counts only the venue-backed one when both exist', async () => {
    const org = await makeUser();
    const venue = await makeVenue(org._id);
    await makePendingEvent(org._id, { name: 'WithVenue', venue: venue._id });
    await makePendingEvent(org._id, { name: 'NoVenue' });

    const { events, total } = await eventService.getPendingAdminApproval({});
    expect(total).toBe(1);
    const names = events.map((e: any) => e.name);
    expect(names).toContain('WithVenue');
    expect(names).not.toContain('NoVenue');
  });
});
