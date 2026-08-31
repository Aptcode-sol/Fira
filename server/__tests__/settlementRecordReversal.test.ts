/**
 * Task 5.3 — settlementService.recordReversal.
 *
 * The runnable check for the correction path, in-memory Mongo, no mocks except
 * where a sink has to be made to fail:
 *   1. An accepted reversal appends a negating row, leaves the target byte-for-byte
 *      as recorded, and nets the pair out of Settled_To_Date (Req 7.1, 7.2, 7.3).
 *   2. The audit record is written before the row and names the reversed entry and
 *      the reason (Req 8.2); an audit failure creates no reversal (Req 8.4).
 *   3. The owner is told that a settlement was reversed and what Settled_To_Date
 *      is now, with nothing admin-internal in the payload (Req 10.2, 10.3).
 *   4. Every rejection creates no Reversal_Entry: unknown or cross-listing target
 *      → 404, already reversed → 409 (guard and unique index both), reversing a
 *      reversal → 400, blank reason → 400 (Req 7.5, 7.6, 7.7, 7.8).
 *   5. The service exposes no update and no delete capability (Req 7.3).
 *
 * Feature: per-listing-settlement-tracking, Task 5.3
 * Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 7.8, 8.2, 8.4, 10.2, 10.3
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const settlementService = require('../services/settlementService');
const notificationService = require('../services/notificationService');
const Settlement = require('../models/Settlement');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');

async function makeUser(name: string) {
  const _id = new mongoose.Types.ObjectId();
  await mongoose.connection.db!.collection('users').insertOne({ _id, name, email: `${_id}@x.test` });
  return _id;
}

async function makeEvent(organizer: mongoose.Types.ObjectId) {
  const _id = new mongoose.Types.ObjectId();
  await mongoose.connection
    .db!.collection('events')
    .insertOne({ _id, name: 'Sunburn Arena', organizer, status: 'approved' });
  return _id;
}

/** netPayable 9000 for the event, via one success Payment and one Payout. */
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

const SETTLED_AT = new Date('2024-05-04T00:00:00.000Z');

/**
 * The target entry, seeded straight into the store rather than through
 * recordEntry, so the audit and notification counts this test asserts on are
 * about the reversal and nothing else.
 */
async function seedEntry(
  listing: mongoose.Types.ObjectId,
  recordedBy: mongoose.Types.ObjectId,
  recipient: mongoose.Types.ObjectId,
  over: Record<string, any> = {},
) {
  return await Settlement.create({
    listingKind: 'event',
    listing,
    listingModel: 'Event',
    recipient,
    settledAmount: 5000,
    settlementReference: 'UTR-4411',
    settledAt: SETTLED_AT,
    method: 'manual',
    adminNotes: 'first tranche',
    recordedBy,
    idempotencyKey: 'key-1',
    ...over,
  });
}

let organizer: mongoose.Types.ObjectId;
let eventId: mongoose.Types.ObjectId;
let adminId: mongoose.Types.ObjectId;
let admin: { _id: mongoose.Types.ObjectId; name: string; adminRole: string };
let target: any;

beforeEach(async () => {
  // The unique (listingKind, listing, idempotencyKey) index must exist for the
  // E11000 backstop to be under test rather than assumed.
  await Settlement.init();
  organizer = await makeUser('Olive Organizer');
  adminId = await makeUser('Ada Admin');
  admin = { _id: adminId, name: 'Ada Admin', adminRole: 'admin' };
  eventId = await makeEvent(organizer);
  await seedEventMoney(eventId);
  target = await seedEntry(eventId, adminId, organizer);
});

const reverse = (entryId: any, reason: any = 'wrong listing, funds recalled') =>
  settlementService.recordReversal({ kind: 'event', listingId: String(eventId), entryId: String(entryId), reason, admin });

describe('recordReversal — the accepted path (Req 7.1, 7.2, 7.3, 8.2, 10.2)', () => {
  it('appends a negating row, leaves the target untouched, and nets the pair out', async () => {
    const before = await Settlement.findById(target._id).lean();

    const result = await reverse(target._id, 'duplicate transfer, funds recalled');

    const rows = await Settlement.find({ listing: eventId }).sort({ createdAt: 1 }).lean();
    expect(rows).toHaveLength(2);

    // Req 7.3 — the reversed entry is preserved exactly as it was recorded.
    expect(rows[0]).toEqual(before);

    // Req 7.1 — the reversal negates the target, carries its reference and date,
    // names the target, carries the reason, and records the acting admin.
    const reversal = rows[1];
    expect(reversal.settledAmount).toBe(-5000);
    expect(reversal.settlementReference).toBe('UTR-4411');
    expect(reversal.settledAt).toEqual(SETTLED_AT);
    expect(String(reversal.isReversalOf)).toBe(String(target._id));
    expect(reversal.reversalReason).toBe('duplicate transfer, funds recalled');
    expect(String(reversal.recordedBy)).toBe(String(adminId));
    expect(String(reversal.recipient)).toBe(String(organizer));
    // Derived, so a second reversal is impossible at the store as well.
    expect(reversal.idempotencyKey).toBe(`reversal:${String(target._id)}`);

    // Req 7.2 — the pair contributes zero: 9000 net payable, nothing settled.
    expect(result.ledger).toEqual({
      settledToDate: 0,
      outstandingAmount: 9000,
      excessAmount: 0,
      state: 'not_settled',
    });
    expect(result.state).toBe('not_settled');
    expect(result.entry).toMatchObject({
      _id: String(reversal._id),
      settledAmount: -5000,
      isReversalOf: String(target._id),
      reversalReason: 'duplicate transfer, funds recalled',
      recordedBy: { _id: String(adminId), name: 'Ada Admin' },
    });

    // Req 8.2 — one audit record naming the actor, the reversed entry and the reason.
    const audits = await AuditLog.find({}).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'reverse', entityType: 'event' });
    expect(String(audits[0].adminUser)).toBe(String(adminId));
    expect(String(audits[0].entityId)).toBe(String(eventId));
    expect(audits[0].metadata).toMatchObject({
      reversedEntryId: String(target._id),
      reversalReason: 'duplicate transfer, funds recalled',
      settledAmount: -5000,
    });

    // Req 10.2, 10.3 — the owner is told a settlement was reversed and what
    // Settled_To_Date is now; the reason and the admin identity stay behind.
    expect(result.notified).toBe(true);
    expect(result.recipientMissing).toBeUndefined();
    const notes = await Notification.find({}).lean();
    expect(notes).toHaveLength(1);
    expect(String(notes[0].user)).toBe(String(organizer));
    expect(notes[0].type).toBe('settlement_reversed');
    expect(notes[0].message).toContain('reversed');
    expect(notes[0].message).toContain('₹0.00'); // the updated Settled_To_Date
    const payload = JSON.stringify(notes[0]);
    for (const leak of ['duplicate transfer', 'first tranche', String(adminId), 'Ada Admin']) {
      expect(payload).not.toContain(leak);
    }
  });

  it('leaves the other entries settled when only one of two is reversed', async () => {
    await seedEntry(eventId, adminId, organizer, {
      settledAmount: 3000,
      settlementReference: 'UTR-9002',
      idempotencyKey: 'key-2',
    });

    const result = await reverse(target._id);
    expect(result.ledger).toMatchObject({ settledToDate: 3000, outstandingAmount: 6000, state: 'partially_settled' });
  });
});

describe('recordReversal — rejections create no Reversal_Entry (Req 7.5-7.8)', () => {
  const onlyTheTarget = async () => {
    expect(await Settlement.countDocuments({ listing: eventId })).toBe(1);
    expect(await Settlement.countDocuments({ isReversalOf: { $ne: null } })).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
    expect(await Notification.countDocuments({})).toBe(0);
  };

  it('rejects an unknown, malformed, or cross-listing target with a 404 (Req 7.6)', async () => {
    const otherEvent = await makeEvent(organizer);
    const foreign = await seedEntry(otherEvent, adminId, organizer, { idempotencyKey: 'key-other' });

    for (const entryId of [String(new mongoose.Types.ObjectId()), 'not-an-id', String(foreign._id)]) {
      const err = await reverse(entryId).then(() => null, (e: any) => e);
      expect(err.status).toBe(404);
    }
    // The foreign entry is untouched too.
    expect(await Settlement.countDocuments({ isReversalOf: { $ne: null } })).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('rejects a blank or absent reason, naming the field (Req 7.7)', async () => {
    // Called directly rather than through the helper, so an absent `reason` is
    // absent rather than defaulted.
    for (const reason of [undefined, '', '   ', null]) {
      const err = await settlementService
        .recordReversal({ kind: 'event', listingId: String(eventId), entryId: String(target._id), reason, admin })
        .then(() => null, (e: any) => e);
      expect(err.status).toBe(400);
      expect(err.field).toBe('reason');
    }
    await onlyTheTarget();
  });

  it('rejects reversing an entry that is itself a reversal with a 400 (Req 7.8)', async () => {
    const { entry } = await reverse(target._id);

    const err = await reverse(entry._id).then(() => null, (e: any) => e);
    expect(err.status).toBe(400);
    expect(err.code).toBe('not_reversible');
    expect(await Settlement.countDocuments({ listing: eventId })).toBe(2); // target + its one reversal
  });

  it('rejects a second reversal of the same entry with a 409 (Req 7.5)', async () => {
    await reverse(target._id);

    const err = await reverse(target._id, 'changed my mind again').then(() => null, (e: any) => e);
    expect(err.status).toBe(409);
    expect(err.code).toBe('already_reversed');
    expect(await Settlement.countDocuments({ isReversalOf: target._id })).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(1); // the first reversal's record only
  });

  it('answers the losing half of a race from the unique index, still as already_reversed (Req 7.5)', async () => {
    await reverse(target._id);

    // Both concurrent requests miss the guard; the derived key settles it.
    const realExists = Settlement.exists;
    Settlement.exists = async () => null;
    try {
      const err = await reverse(target._id, 'raced').then(() => null, (e: any) => e);
      expect(err.status).toBe(409);
      expect(err.code).toBe('already_reversed');
    } finally {
      Settlement.exists = realExists;
    }

    expect(await Settlement.countDocuments({ isReversalOf: target._id })).toBe(1);
  });
});

describe('recordReversal — the audit invariant (Req 8.4)', () => {
  const realAuditCreate = AuditLog.create;
  const realNotify = notificationService.createNotification;

  afterEach(() => {
    AuditLog.create = realAuditCreate;
    notificationService.createNotification = realNotify;
  });

  it('creates no reversal when the audit write fails', async () => {
    AuditLog.create = async () => {
      throw new Error('audit sink down');
    };

    const err = await reverse(target._id).then(() => null, (e: any) => e);
    expect(err.status).toBe(500);
    expect(await Settlement.countDocuments({ listing: eventId })).toBe(1);
  });

  it('keeps the reversal when notification delivery fails (Req 10.4)', async () => {
    notificationService.createNotification = async () => {
      throw new Error('sse exploded');
    };

    const result = await reverse(target._id);
    expect(result.notified).toBe(false);
    expect(result.ledger.settledToDate).toBe(0);
    expect(await Settlement.countDocuments({ isReversalOf: target._id })).toBe(1);
  });
});

describe('settlementService — no mutation capability (Req 7.3)', () => {
  it('exposes no update or delete method', () => {
    const mutators = Object.keys(settlementService).filter((key) => /update|delete|remove|edit/i.test(key));
    expect(mutators).toEqual([]);
  });
});
