/**
 * Flow 8.1 + 8.5 — admin dashboard pending count + completed events filter.
 *
 * 8.1: adminService.getStats().pendingEvents must EXCLUDE events with no
 *      associated venue, while a genuinely pending event that HAS a venue
 *      still counts (preservation 3.11).
 * 8.5: adminService.getEvents({ status: 'completed' }) must return only
 *      events with status 'completed' (design 8.5); other filters unchanged
 *      (preservation 3.12).
 *
 * Validates: Requirements 8.1, 8.5, 3.11, 3.12
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const adminService = require('../services/adminService');
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

async function makeEvent(organizerId: any, overrides: Record<string, any> = {}) {
  return Event.create({
    organizer: organizerId,
    name: 'Event',
    description: 'desc',
    startDateTime: future(7),
    endDateTime: future(8),
    maxAttendees: 100,
    status: 'pending',
    eventType: 'public',
    ...overrides,
  });
}

describe('Flow 8.1 — getStats pending count excludes venue-less events', () => {
  it('counts a pending event with a venue but not one without (3.11)', async () => {
    const org = await makeUser();
    const venue = await makeVenue(org._id);
    await makeEvent(org._id, { name: 'PendingWithVenue', status: 'pending', venue: venue._id });
    await makeEvent(org._id, { name: 'PendingNoVenue', status: 'pending' }); // no venue

    const stats = await adminService.getStats();
    expect(stats.pendingEvents).toBe(1);
  });
});

describe('Flow 8.5 — getEvents completed filter returns only completed events', () => {
  it('returns completed events and excludes other statuses (3.12)', async () => {
    const org = await makeUser();
    const venue = await makeVenue(org._id);
    await makeEvent(org._id, { name: 'DoneA', status: 'completed', venue: venue._id });
    await makeEvent(org._id, { name: 'DoneB', status: 'completed', venue: venue._id });
    await makeEvent(org._id, { name: 'StillPending', status: 'pending', venue: venue._id });

    const { events, total } = await adminService.getEvents({ status: 'completed' });
    expect(total).toBe(2);
    const names = events.map((e: any) => e.name).sort();
    expect(names).toEqual(['DoneA', 'DoneB']);
  });

  it('other status filters are unaffected (3.12)', async () => {
    const org = await makeUser();
    const venue = await makeVenue(org._id);
    await makeEvent(org._id, { name: 'DoneA', status: 'completed', venue: venue._id });
    await makeEvent(org._id, { name: 'StillPending', status: 'pending', venue: venue._id });

    const { events, total } = await adminService.getEvents({ status: 'pending' });
    expect(total).toBe(1);
    expect(events[0].name).toBe('StillPending');
  });
});
