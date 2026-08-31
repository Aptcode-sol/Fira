/**
 * Task 5.1 — settlementService.getListingSettlement / getOwnerSettlement.
 *
 * The runnable check for the two read methods, in-memory Mongo, no mocks:
 *   1. The admin DTO carries the money figures verbatim from the money path
 *      plus the three derived ones, the six activity counts, the state, the
 *      payout summary, and one entry per stored row newest-first with its
 *      reversal linkage (Requirements 1.1, 1.2, 1.3, 1.5, 2.1, 2.4, 3.1).
 *   2. The owner DTO agrees with the admin DTO on every shared figure and
 *      leaks no admin-internal field at any depth (Requirements 9.1, 9.2,
 *      9.3, 9.9).
 *   3. A non-owner, an absent listing and a malformed id are all the same 403
 *      carrying no figures (Requirement 11.5).
 *   4. A money-path failure is a 502 naming the listing, with no figures
 *      (Requirement 12.5).
 *
 * Feature: per-listing-settlement-tracking, Task 5.1
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 2.1, 2.4, 3.1, 9.1, 9.2, 9.3, 9.9, 11.5, 12.1, 12.5
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const settlementService = require('../services/settlementService');
const earningsService = require('../services/earningsService');
const Settlement = require('../models/Settlement');
const Payment = require('../models/Payment');

const ADMIN_ONLY_KEYS = ['adminNotes', 'overrideReason', 'isOverSettlement', 'recordedBy', 'reversedBy'];

/** Raw inserts so the checks don't couple to the full Event/Venue required fields. */
async function makeEvent(organizer: mongoose.Types.ObjectId) {
  const _id = new mongoose.Types.ObjectId();
  await mongoose.connection
    .db!.collection('events')
    .insertOne({ _id, name: 'Sunburn Arena', organizer, status: 'approved' });
  return _id;
}

async function makeVenue(owner: mongoose.Types.ObjectId) {
  const _id = new mongoose.Types.ObjectId();
  await mongoose.connection.db!.collection('venues').insertOne({ _id, name: 'Grand Hall', owner });
  return _id;
}

async function makeAdmin(name = 'Ada Admin') {
  const _id = new mongoose.Types.ObjectId();
  await mongoose.connection.db!.collection('users').insertOne({ _id, name, email: `${_id}@x.test` });
  return _id;
}

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
  // Raw insert: the payout's required bankDetails are irrelevant to the figures
  // and would only be fixture noise.
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

function entry(listing: mongoose.Types.ObjectId, recordedBy: mongoose.Types.ObjectId, over: Record<string, any> = {}) {
  return {
    listingKind: 'event',
    listing,
    listingModel: 'Event',
    settledAmount: 5000,
    settlementReference: 'UTR-1',
    settledAt: new Date('2024-05-02T00:00:00.000Z'),
    method: 'manual',
    recordedBy,
    idempotencyKey: `key-${Math.random()}`,
    ...over,
  };
}

describe('getListingSettlement — the admin read (Req 1, 2, 3)', () => {
  it('returns the money path figures verbatim plus the derived three, the activity, the payout and the ledger newest-first', async () => {
    const organizer = await makeAdmin('Olive Organizer');
    const admin = await makeAdmin();
    const eventId = await makeEvent(organizer);
    await seedEventMoney(eventId);

    const older = await Settlement.create(
      entry(eventId, admin, { settledAmount: 2000, settlementReference: 'UTR-OLD', settledAt: new Date('2024-05-02T00:00:00.000Z'), adminNotes: 'first tranche' }),
    );
    const newer = await Settlement.create(
      entry(eventId, admin, { settledAmount: 3000, settlementReference: 'UTR-NEW', settledAt: new Date('2024-05-09T00:00:00.000Z') }),
    );

    const dto = await settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) });
    const figures = await earningsService.getListingFigures({ kind: 'event', listingId: String(eventId) });

    expect(dto.listing).toEqual({ kind: 'event', id: String(eventId), name: 'Sunburn Arena' });

    // Verbatim: every money figure the money path reported comes back unchanged (Req 2.4, 12.1).
    for (const [key, value] of Object.entries(figures.money)) {
      expect(dto.money[key]).toBe(value);
    }
    expect(dto.money.settledToDate).toBe(5000);
    expect(dto.money.outstandingAmount).toBe(4000); // 9000 net payable − 5000 settled
    expect(dto.money.excessAmount).toBe(0);
    expect(dto.state).toBe('partially_settled');

    expect(dto.activity).toEqual(figures.activity);
    expect(dto.payout).toEqual(figures.payout);
    expect(dto.payout.status).toBe('completed');

    // Newest first, one row per stored entry, admin fields present (Req 1.2, 1.3).
    expect(dto.entries.map((e: any) => e._id)).toEqual([String(newer._id), String(older._id)]);
    expect(dto.entries[1].adminNotes).toBe('first tranche');
    expect(dto.entries[0].recordedBy).toEqual({ _id: String(admin), name: 'Ada Admin' });
    expect(dto.entries[0].reversedBy).toBeNull();
  });

  it('carries the reversal linkage and nets the reversed pair out of Settled_To_Date (Req 7.2, 7.4)', async () => {
    const organizer = await makeAdmin('Olive Organizer');
    const admin = await makeAdmin('Rex Reverser');
    const eventId = await makeEvent(organizer);
    await seedEventMoney(eventId);

    const target = await Settlement.create(entry(eventId, admin, { settledAmount: 4000 }));
    await Settlement.create(
      entry(eventId, admin, {
        settledAmount: -4000,
        settlementReference: 'UTR-1',
        isReversalOf: target._id,
        reversalReason: 'wrong account',
        idempotencyKey: `reversal:${target._id}`,
      }),
    );

    const dto = await settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) });

    expect(dto.money.settledToDate).toBe(0);
    expect(dto.state).toBe('not_settled');
    expect(dto.entries).toHaveLength(2);
    const reversedRow = dto.entries.find((e: any) => e._id === String(target._id));
    expect(reversedRow.reversedBy).toMatchObject({ reason: 'wrong account', recordedBy: { name: 'Rex Reverser' } });
  });

  it('rejects an absent or malformed listing with a 404 rather than an empty ledger (Req 4.10)', async () => {
    for (const listingId of [String(new mongoose.Types.ObjectId()), 'not-an-object-id']) {
      await expect(settlementService.getListingSettlement({ kind: 'event', listingId })).rejects.toMatchObject({
        status: 404,
        message: 'Listing not found',
      });
    }
    await expect(
      settlementService.getListingSettlement({ kind: 'ticket', listingId: String(new mongoose.Types.ObjectId()) }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('getOwnerSettlement — the owner mirror (Req 9, 11.5)', () => {
  it('agrees with the admin read on every shared figure and leaks nothing admin-internal', async () => {
    const organizer = await makeAdmin('Olive Organizer');
    const admin = await makeAdmin();
    const eventId = await makeEvent(organizer);
    await seedEventMoney(eventId);
    const target = await Settlement.create(
      entry(eventId, admin, { settledAmount: 5000, adminNotes: 'SENTINEL-NOTE', isOverSettlement: true, overrideReason: 'SENTINEL-OVERRIDE' }),
    );
    await Settlement.create(
      entry(eventId, admin, {
        settledAmount: -5000,
        isReversalOf: target._id,
        reversalReason: 'SENTINEL-REASON',
        idempotencyKey: `reversal:${target._id}`,
      }),
    );

    const adminDto = await settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) });
    const ownerDto = await settlementService.getOwnerSettlement({
      kind: 'event',
      listingId: String(eventId),
      requesterId: String(organizer),
    });

    // Req 9.9 — every shared figure holds the same value.
    for (const key of Object.keys(ownerDto.money)) {
      expect(ownerDto.money[key]).toBe(adminDto.money[key]);
    }
    expect(ownerDto.state).toBe(adminDto.state);
    expect(ownerDto.activity).toEqual(adminDto.activity);

    // Req 9.2, 9.5 — the effective entry, marked reversed; the negative row is not a transfer the owner received.
    expect(ownerDto.entries).toEqual([
      { settledAmount: 5000, settlementReference: 'UTR-1', settledAt: target.settledAt, reversed: true },
    ]);

    // Req 9.3 — nothing admin-internal at any depth.
    const serialized = JSON.stringify(ownerDto);
    for (const sentinel of ['SENTINEL-NOTE', 'SENTINEL-OVERRIDE', 'SENTINEL-REASON', String(admin), 'Ada Admin']) {
      expect(serialized).not.toContain(sentinel);
    }
    for (const key of ADMIN_ONLY_KEYS) {
      expect(serialized).not.toContain(`"${key}"`);
    }
  });

  it('answers a venue owner through Venue.owner', async () => {
    const owner = await makeAdmin('Vera Owner');
    const venueId = await makeVenue(owner);

    const dto = await settlementService.getOwnerSettlement({
      kind: 'venue',
      listingId: String(venueId),
      requesterId: String(owner),
    });

    expect(dto.listing).toEqual({ kind: 'venue', id: String(venueId), name: 'Grand Hall' });
    expect(dto.money.netPayable).toBe(0);
    expect(dto.state).toBe('not_settled');
    expect(dto.entries).toEqual([]);
  });

  it('rejects a non-owner, an absent listing and a malformed id with the same 403 carrying no figures (Req 11.5)', async () => {
    const organizer = await makeAdmin('Olive Organizer');
    const eventId = await makeEvent(organizer);
    await seedEventMoney(eventId);

    const cases = [
      { listingId: String(eventId), requesterId: String(new mongoose.Types.ObjectId()) },
      { listingId: String(eventId), requesterId: undefined },
      { listingId: String(new mongoose.Types.ObjectId()), requesterId: String(organizer) },
      { listingId: 'not-an-object-id', requesterId: String(organizer) },
    ];

    for (const { listingId, requesterId } of cases) {
      const err = await settlementService
        .getOwnerSettlement({ kind: 'event', listingId, requesterId })
        .then(() => null, (e: any) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err.status).toBe(403);
      // Identical message for "not yours" and "does not exist" — existence is not leaked.
      expect(err.message).toBe('Not authorized to view settlement for this event');
      expect(err).not.toHaveProperty('money');
    }
  });
});

describe('a money-path failure is a 502 naming the listing (Req 12.5)', () => {
  it('surfaces no money figures when getListingFigures cannot produce them', async () => {
    const organizer = await makeAdmin('Olive Organizer');
    const eventId = await makeEvent(organizer);
    const original = earningsService.getListingFigures;
    earningsService.getListingFigures = async () => {
      throw new Error('aggregation exploded');
    };

    try {
      for (const read of [
        () => settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) }),
        () => settlementService.getOwnerSettlement({ kind: 'event', listingId: String(eventId), requesterId: String(organizer) }),
      ]) {
        const err = await read().then(() => null, (e: any) => e);
        expect(err.status).toBe(502);
        expect(err.message).toBe(`Earnings figures unavailable for listing ${String(eventId)}`);
        expect(err).not.toHaveProperty('money');
      }
    } finally {
      earningsService.getListingFigures = original;
    }
  });
});
