/**
 * Task 5.2 — settlementService.recordEntry.
 *
 * The runnable check for the write path, in-memory Mongo, no mocks except where
 * a sink has to be made to fail:
 *   1. An accepted submission stores the fact verbatim, defaults `method` to
 *      `manual`, resolves the recipient, and returns the ledger refolded to
 *      include the new entry (Requirements 4.1, 4.2, 4.4, 4.5, 4.6, 12.4).
 *   2. The audit record is written before the entry and carries the amount, the
 *      reference and any override reason (Requirements 8.1, 8.3).
 *   3. An audit failure creates no entry (Requirement 8.4).
 *   4. A resubmitted key records once, both through the pre-read and through the
 *      unique index (Requirements 6.1, 6.2).
 *   5. A rejected submission writes nothing at all (Requirements 4.7–4.10, 5.2, 5.4).
 *   6. Notification is best-effort: a delivery failure and an unresolvable
 *      recipient both keep the entry (Requirements 10.1, 10.3, 10.4, 10.5).
 *
 * Feature: per-listing-settlement-tracking, Task 5.2
 * Validates: Requirements 4.1, 4.2, 4.4, 4.5, 4.6, 4.10, 4.11, 5.2, 5.3, 5.4,
 *            6.1, 6.2, 8.1, 8.3, 8.4, 10.1, 10.3, 10.4, 10.5, 12.4
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

function submission(over: Record<string, any> = {}) {
  return {
    settledAmount: 5000,
    settlementReference: 'UTR-4411',
    settledAt: SETTLED_AT,
    idempotencyKey: 'key-1',
    ...over,
  };
}

let organizer: mongoose.Types.ObjectId;
let eventId: mongoose.Types.ObjectId;
let adminId: mongoose.Types.ObjectId;
let admin: { _id: mongoose.Types.ObjectId; name: string; adminRole: string };

beforeEach(async () => {
  // The unique (listingKind, listing, idempotencyKey) index must exist for the
  // E11000 backstop to be under test rather than assumed.
  await Settlement.init();
  organizer = await makeUser('Olive Organizer');
  adminId = await makeUser('Ada Admin');
  admin = { _id: adminId, name: 'Ada Admin', adminRole: 'admin' };
  eventId = await makeEvent(organizer);
  await seedEventMoney(eventId);
});

const record = (input: Record<string, any>, actor = admin) =>
  settlementService.recordEntry({ kind: 'event', listingId: String(eventId), input, admin: actor });

describe('recordEntry — the accepted path (Req 4, 8, 10)', () => {
  it('stores the submission verbatim, defaults method to manual, and returns the refolded ledger', async () => {
    const result = await record(submission({ adminNotes: 'first tranche' }));

    const stored = await Settlement.find({ listing: eventId }).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      listingKind: 'event',
      listingModel: 'Event',
      settledAmount: 5000,
      settlementReference: 'UTR-4411',
      method: 'manual', // Req 4.5 — absent from the submission
      adminNotes: 'first tranche', // Req 4.4
      isOverSettlement: false,
      overrideReason: null,
      idempotencyKey: 'key-1',
    });
    expect(stored[0].settledAt).toEqual(SETTLED_AT);
    expect(String(stored[0].recordedBy)).toBe(String(adminId));
    expect(String(stored[0].recipient)).toBe(String(organizer)); // resolved at record time

    // Req 4.2 — the returned ledger includes the entry just created.
    expect(result.ledger).toEqual({
      settledToDate: 5000,
      outstandingAmount: 4000, // 9000 net payable − 5000
      excessAmount: 0,
      state: 'partially_settled',
    });
    expect(result.state).toBe('partially_settled');
    expect(result.entry).toMatchObject({
      _id: String(stored[0]._id),
      settledAmount: 5000,
      recordedBy: { _id: String(adminId), name: 'Ada Admin' },
      reversedBy: null,
    });
    expect(result.alreadyRecorded).toBeUndefined();

    // Req 8.1 — one audit record naming the actor, the listing, the amount and the reference.
    const audits = await AuditLog.find({}).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'settle', entityType: 'event' });
    expect(String(audits[0].adminUser)).toBe(String(adminId));
    expect(String(audits[0].entityId)).toBe(String(eventId));
    expect(audits[0].metadata).toMatchObject({ settledAmount: 5000, settlementReference: 'UTR-4411' });

    // Req 10.1, 10.3 — the owner is told, and nothing admin-internal travels.
    expect(result.notified).toBe(true);
    expect(result.recipientMissing).toBeUndefined();
    const notes = await Notification.find({}).lean();
    expect(notes).toHaveLength(1);
    expect(String(notes[0].user)).toBe(String(organizer));
    expect(notes[0].type).toBe('settlement_recorded');
    expect(notes[0].message).toContain('UTR-4411');
    expect(notes[0].message).toContain('2024-05-04');
    const payload = JSON.stringify(notes[0]);
    for (const leak of ['first tranche', String(adminId), 'Ada Admin']) {
      expect(payload).not.toContain(leak);
    }
  });

  it('accepts an exact-to-the-rupee settlement without an override and reports fully_settled (Req 5.7)', async () => {
    const result = await record(submission({ settledAmount: 9000 }));
    expect(result.state).toBe('fully_settled');
    expect(result.ledger.outstandingAmount).toBe(0);
  });
});

describe('recordEntry — idempotency (Req 6.1, 6.2)', () => {
  it('records once for a resubmitted key and answers from the pre-read without a second audit record', async () => {
    const first = await record(submission());
    const second = await record(submission({ adminNotes: 'retry' }));

    expect(second.alreadyRecorded).toBe(true);
    expect(second.entry._id).toBe(first.entry._id);
    expect(second.ledger.settledToDate).toBe(5000);
    expect(await Settlement.countDocuments({ listing: eventId })).toBe(1);
    // A retry must leave no spurious audit record and must not notify twice.
    expect(await AuditLog.countDocuments({})).toBe(1);
    expect(await Notification.countDocuments({})).toBe(1);
    expect(second.notified).toBe(false);
  });

  it('answers the losing half of a race from the unique index rather than double-recording', async () => {
    await record(submission());

    // Both concurrent submissions miss the pre-read; the index settles it.
    const realExists = Settlement.exists;
    Settlement.exists = async () => null;
    try {
      const raced = await record(submission({ settledAmount: 4000, adminNotes: 'raced' }));
      expect(raced.alreadyRecorded).toBe(true);
      expect(raced.entry.adminNotes).toBeNull(); // the winner's row, not the loser's
    } finally {
      Settlement.exists = realExists;
    }

    expect(await Settlement.countDocuments({ listing: eventId })).toBe(1);
  });
});

describe('recordEntry — rejections write nothing (Req 4.7-4.11, 5.2, 5.4)', () => {
  const nothingWritten = async () => {
    expect(await Settlement.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
    expect(await Notification.countDocuments({})).toBe(0);
  };

  it('rejects an invalid field, naming it, before the audit write', async () => {
    const cases: Array<[Record<string, any>, string]> = [
      [{ settledAmount: 0 }, 'settledAmount'],
      [{ settledAmount: 12.5 }, 'settledAmount'],
      [{ settlementReference: '   ' }, 'settlementReference'],
      [{ settledAt: new Date(Date.now() + 86_400_000) }, 'settledAt'],
      [{ idempotencyKey: '' }, 'idempotencyKey'],
    ];
    for (const [patch, field] of cases) {
      const err = await record(submission(patch)).then(() => null, (e: any) => e);
      expect(err.status).toBe(400);
      expect(err.field).toBe(field);
    }
    await nothingWritten();
  });

  it('rejects an over-settlement with the figures the admin needs, and creates nothing', async () => {
    const err = await record(submission({ settledAmount: 9001 })).then(() => null, (e: any) => e);
    expect(err).toMatchObject({ status: 409, code: 'over_settlement', netPayable: 9000, settledToDate: 0, maxRecordable: 9000 });
    await nothingWritten();
  });

  it('rejects an override from a non-super_admin (Req 5.4)', async () => {
    const err = await record(
      submission({ settledAmount: 9001, override: true, overrideReason: 'bank sent extra' }),
    ).then(() => null, (e: any) => e);
    expect(err.status).toBe(403);
    await nothingWritten();
  });

  it('rejects an absent listing with a 404 (Req 4.10)', async () => {
    const err = await settlementService
      .recordEntry({ kind: 'event', listingId: String(new mongoose.Types.ObjectId()), input: submission(), admin })
      .then(() => null, (e: any) => e);
    expect(err.status).toBe(404);
    await nothingWritten();
  });
});

describe('recordEntry — a super admin override (Req 5.3, 8.3)', () => {
  it('flags the entry, stores the reason, and repeats it in the audit record', async () => {
    const result = await record(
      submission({ settledAmount: 9500, override: true, overrideReason: 'bank sent extra, recovering next cycle' }),
      { ...admin, adminRole: 'super_admin' },
    );

    expect(result.state).toBe('over_settled');
    expect(result.ledger).toMatchObject({ settledToDate: 9500, outstandingAmount: 0, excessAmount: 500 });

    const stored = await Settlement.findOne({ listing: eventId }).lean();
    expect(stored.isOverSettlement).toBe(true);
    expect(stored.overrideReason).toBe('bank sent extra, recovering next cycle');

    const audit = await AuditLog.findOne({}).lean();
    expect(audit.metadata).toMatchObject({
      isOverSettlement: true,
      overrideReason: 'bank sent extra, recovering next cycle',
    });
  });
});

describe('recordEntry — the two exception branches (Req 8.4, 10.4, 10.5)', () => {
  const realAuditCreate = AuditLog.create;
  const realNotify = notificationService.createNotification;

  afterEach(() => {
    AuditLog.create = realAuditCreate;
    notificationService.createNotification = realNotify;
  });

  it('creates no entry when the audit write fails (Req 8.4)', async () => {
    AuditLog.create = async () => {
      throw new Error('audit sink down');
    };

    const err = await record(submission()).then(() => null, (e: any) => e);
    expect(err.status).toBe(500);
    expect(err.message).toBe('Settlement not recorded: audit write failed');
    expect(await Settlement.countDocuments({})).toBe(0);
  });

  it('keeps the entry when notification delivery fails (Req 10.4)', async () => {
    notificationService.createNotification = async () => {
      throw new Error('sse exploded');
    };

    const result = await record(submission());
    expect(result.notified).toBe(false);
    expect(result.recipientMissing).toBeUndefined();
    expect(result.ledger.settledToDate).toBe(5000);
    expect(await Settlement.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(1);
  });

  it('records the entry with a null recipient and skips delivery when the owner is unresolvable (Req 10.5)', async () => {
    const orphan = await makeEvent(new mongoose.Types.ObjectId()); // organizer has no user record
    await seedEventMoney(orphan);
    const result = await settlementService.recordEntry({
      kind: 'event',
      listingId: String(orphan),
      input: submission(),
      admin,
    });

    expect(result.notified).toBe(false);
    expect(result.recipientMissing).toBe(true);
    const stored = await Settlement.findOne({ listing: orphan }).lean();
    expect(stored.recipient).toBeNull();
    expect(await Notification.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(1);
  });
});

/**
 * Task 5.13 — the insert failing *after* the audit write.
 *
 * The other exception branches of this ordering are covered above (audit
 * failure, delivery failure, unresolvable recipient). What is left is the window
 * between the audit record and the row it describes: a non-duplicate insert
 * failure. The design's Error Handling table fixes the outcome — a 500, the
 * ledger unchanged, and the audit record left standing as evidence that the
 * attempt was made. The same branch exists on `recordReversal`, with its own
 * message.
 *
 * Validates: Requirements 4.11, 10.5
 */
describe('recordEntry / recordReversal — the insert fails after the audit write (Req 4.11)', () => {
  const realCreate = Settlement.create.bind(Settlement);

  afterEach(() => {
    Settlement.create = realCreate;
  });

  /** A storage failure that is not the idempotency backstop. */
  const breakInsert = () => {
    Settlement.create = async () => {
      throw new Error('not primary and secondaryOk=false');
    };
  };

  it('rejects with a 500, leaves the ledger unchanged, and lets the audit record stand', async () => {
    breakInsert();

    const err = await record(submission()).then(() => null, (e: any) => e);
    expect(err.status).toBe(500);
    expect(err.message).toBe('Settlement was not recorded');

    // The ledger is untouched — no row, and the reader still reports nothing settled.
    expect(await Settlement.countDocuments({})).toBe(0);
    const view = await settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) });
    expect(view.money).toMatchObject({ settledToDate: 0, outstandingAmount: 9000 });
    expect(view.state).toBe('not_settled');
    expect(view.entries).toEqual([]);

    // The attempt is still on the record (Req 8.1 ordering, Req 4.11 outcome).
    const audits = await AuditLog.find({}).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'settle', entityType: 'event' });
    expect(audits[0].metadata).toMatchObject({ settledAmount: 5000, settlementReference: 'UTR-4411' });

    // Nothing was told to the owner about a settlement that does not exist.
    expect(await Notification.countDocuments({})).toBe(0);
  });

  it('does the same for a reversal — the target entry survives untouched and unreversed', async () => {
    const first = await record(submission());
    breakInsert();

    const err = await settlementService
      .recordReversal({
        kind: 'event',
        listingId: String(eventId),
        entryId: first.entry._id,
        reason: 'wrong listing',
        admin,
      })
      .then(() => null, (e: any) => e);
    expect(err.status).toBe(500);
    expect(err.message).toBe('Reversal was not recorded');

    // Append-only: the one original row, unchanged and unreversed.
    const stored = await Settlement.find({}).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0].settledAmount).toBe(5000);
    expect(stored[0].isReversalOf).toBeNull();
    const view = await settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) });
    expect(view.money.settledToDate).toBe(5000);
    expect(view.entries[0].reversedBy).toBeNull();

    // Two audit records: the settle that succeeded and the reverse that did not.
    const actions = (await AuditLog.find({}).lean()).map((a: any) => a.action).sort();
    expect(actions).toEqual(['reverse', 'settle']);
  });
});
