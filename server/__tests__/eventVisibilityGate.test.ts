/**
 * Flow 6 — server-side event visibility gates (Task 9).
 *
 * Locks the three server-side gates the fix adds:
 *   1. Public listing (getAllEvents, no organizer) excludes completed events and
 *      events whose endDateTime is in the past; approved, not-completed,
 *      before-end public events still list (preservation 3.9).
 *   2. getEventById on a private, NOT-yet-approved event returns "Event not
 *      found" for a non-owner / anonymous viewer, but resolves for the owner.
 *   3. purchaseTicketByTier rejects completed / cancelled / past events, matching
 *      the flat purchaseTicket guard.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 3.9
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const eventService = require('../services/eventService');
const ticketService = require('../services/ticketService');
const Event = require('../models/Event');
const User = require('../models/User');
require('../models/Venue');

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

async function makeUser(overrides: Record<string, any> = {}) {
  return User.create({
    email: `u_${Math.random().toString(36).slice(2)}@test.com`,
    password: 'x',
    name: 'Test User',
    ...overrides,
  });
}

const future = (days: number) => new Date(Date.now() + days * 24 * 3600 * 1000);
const past = (days: number) => new Date(Date.now() - days * 24 * 3600 * 1000);

async function makeEvent(organizerId: any, overrides: Record<string, any> = {}) {
  return Event.create({
    organizer: organizerId,
    name: 'Test Event',
    description: 'desc',
    startDateTime: future(7),
    endDateTime: future(8),
    maxAttendees: 100,
    status: 'approved',
    eventType: 'public',
    ...overrides,
  });
}

describe('Flow 6 — public listing gate', () => {
  it('lists an approved, not-completed, before-end public event (preservation 3.9)', async () => {
    const org = await makeUser();
    await makeEvent(org._id, { name: 'Upcoming' });

    const { events } = await eventService.getAllEvents({});
    expect(events.map((e: any) => e.name)).toContain('Upcoming');
  });

  it('excludes a completed event even if before end date', async () => {
    const org = await makeUser();
    await makeEvent(org._id, { name: 'Done', status: 'completed' });

    const { events } = await eventService.getAllEvents({});
    expect(events.map((e: any) => e.name)).not.toContain('Done');
  });

  it('excludes a started-but-already-ended event (endDateTime < now)', async () => {
    const org = await makeUser();
    // Started yesterday, ended an hour ago — startDateTime alone would not gate it.
    await makeEvent(org._id, { name: 'Ended', startDateTime: past(1), endDateTime: past(0.04) });

    const { events } = await eventService.getAllEvents({});
    expect(events.map((e: any) => e.name)).not.toContain('Ended');
  });
});

describe('Flow 6 — private-link approval gate (getEventById)', () => {
  it('hides an unapproved private event from a non-owner / anonymous viewer', async () => {
    const org = await makeUser();
    const ev = await makeEvent(org._id, {
      eventType: 'private',
      status: 'pending',
      adminApproval: { status: 'pending' },
    });

    await expect(eventService.getEventById(ev._id)).rejects.toThrow('Event not found');
    const stranger = await makeUser();
    await expect(eventService.getEventById(ev._id, stranger._id)).rejects.toThrow('Event not found');
  });

  it('resolves an unapproved private event for its owner', async () => {
    const org = await makeUser();
    const ev = await makeEvent(org._id, {
      eventType: 'private',
      status: 'pending',
      adminApproval: { status: 'pending' },
    });

    const resolved = await eventService.getEventById(ev._id, org._id);
    expect(resolved._id.toString()).toBe(ev._id.toString());
  });

  it('resolves an approved private event for anyone with the link', async () => {
    const org = await makeUser();
    const ev = await makeEvent(org._id, {
      eventType: 'private',
      adminApproval: { status: 'approved' },
    });

    const resolved = await eventService.getEventById(ev._id);
    expect(resolved._id.toString()).toBe(ev._id.toString());
  });
});

describe('Flow 6 — tier purchase guard parity', () => {
  it('rejects a completed event on the tier path', async () => {
    const org = await makeUser();
    const buyer = await makeUser();
    const ev = await makeEvent(org._id, {
      status: 'completed',
      ticketTiers: [{ name: 'VIP', price: 0, maxQuantity: 10, soldCount: 0 }],
    });

    await expect(
      ticketService.purchaseTicketByTier(ev._id, 'VIP', 1, buyer._id)
    ).rejects.toThrow(/completed/);
  });

  it('rejects a past event on the tier path', async () => {
    const org = await makeUser();
    const buyer = await makeUser();
    const ev = await makeEvent(org._id, {
      startDateTime: past(2),
      endDateTime: past(1),
      ticketTiers: [{ name: 'VIP', price: 0, maxQuantity: 10, soldCount: 0 }],
    });

    await expect(
      ticketService.purchaseTicketByTier(ev._id, 'VIP', 1, buyer._id)
    ).rejects.toThrow(/past events/);
  });
});
