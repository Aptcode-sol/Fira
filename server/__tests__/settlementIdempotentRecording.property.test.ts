/**
 * Feature: per-listing-settlement-tracking, Property 6: Recording is idempotent
 * in the Idempotency_Key.
 *
 * For any settlement recording request and any number of repeated submissions of
 * it, exactly one Settlement_Entry exists for that listing and key, every
 * submission returns that same entry, and Settled_To_Date is identical to the
 * value after a single submission.
 *
 * Under test: `settlementService.recordEntry({ kind, listingId, input, admin })`.
 *
 * Two mechanisms carry the property and both are exercised, one per test:
 *   1. the idempotency pre-read (`Settlement.exists`), which answers a
 *      double-clicked or retried submission from the store before validation and
 *      before any write — so a retry also leaves no second audit record and
 *      sends no second notification (Requirement 6.1);
 *   2. the unique `(listingKind, listing, idempotencyKey)` index, the race
 *      backstop the pre-read cannot be. `Settlement.exists` is stubbed to miss,
 *      exactly as both halves of a real race do, so the retry reaches
 *      `Settlement.create` and its `E11000` is answered by re-reading and
 *      returning the winner (Requirement 6.2).
 *
 * Real records in a real (in-memory) Mongo, no stubs beyond that one pre-read:
 * "the store enforces uniqueness" is a claim about the index, so stubbing the
 * store would test the stub instead. `Settlement.init()` is awaited so the
 * unique index provably exists rather than being assumed.
 *
 * Retries carry a different `adminNotes` value from the first submission, so the
 * assertions can tell "returned the stored entry" from "quietly overwrote it".
 *
 * Validates: Requirements 6.1, 6.2
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import mongoose from 'mongoose';
// The in-memory Mongo server and its connection are owned by the shared setup
// file (registered as vitest `setupFiles`). Creating a second MongoMemoryServer
// here throws "openUri() on an active connection with different connection strings".
import './setup';

const settlementService = require('../services/settlementService');
const Settlement = require('../models/Settlement');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
// Registered so the reads inside getListingFigures resolve their models.
require('../models/Payment');
require('../models/Payout');

const { ObjectId } = mongoose.Types;

const NOW = Date.now();
const DAY = 24 * 3600 * 1000;

// --- generators ------------------------------------------------------------

type Spec = {
    amount: number;
    headroom: number;
    reference: string;
    key: string;
    notes: string | null;
    method: 'manual' | 'gateway' | null;
    daysAgo: number;
    repeats: number;
};

/** A string that survives trimming — the same reading `isFilled` gives. */
const FILLED = fc.string({ minLength: 1, maxLength: 16 }).filter((s) => s.trim().length > 0);

// `headroom` is the slack between the requested amount and Net_Payable, so the
// generated domain includes the exact-to-the-rupee submission (headroom 0), which
// the guard accepts without an override (Requirement 5.7).
// `method` and `notes` are optional on a submission, so `null` stands for absent.
// `repeats` is at least 2 — one submission cannot show idempotency.
const spec: fc.Arbitrary<Spec> = fc.record({
    amount: fc.integer({ min: 1, max: 9000 }),
    headroom: fc.integer({ min: 0, max: 5000 }),
    reference: FILLED.map((s) => `UTR-${s}`),
    key: FILLED.map((s) => `key-${s}`),
    notes: fc.option(FILLED, { nil: null }),
    method: fc.option(fc.constantFrom<'manual' | 'gateway'>('manual', 'gateway'), { nil: null }),
    daysAgo: fc.integer({ min: 0, max: 300 }),
    repeats: fc.integer({ min: 2, max: 4 }),
});

// --- fixtures --------------------------------------------------------------

/**
 * Raw collection inserts: recordEntry reads the listing by id and the money by
 * listing scope, so the full Event/Payment required-field sets would be fixture
 * noise. One success Payment and one Payout pin Net_Payable, which is what the
 * over-settlement guard decides against.
 */
async function seedListing(netPayable: number, ownerId: any) {
    const db = mongoose.connection.db!;
    const listingId = new ObjectId();

    await db.collection('events').insertOne({ _id: listingId, name: 'Generated Event', organizer: ownerId });
    await db.collection('payments').insertOne({
        _id: new ObjectId(),
        user: ownerId,
        type: 'ticket_purchase',
        referenceId: listingId,
        referenceModel: 'Event',
        amount: netPayable,
        totalAmount: netPayable,
        platformFee: 0,
        gstAmount: 0,
        status: 'success',
        paidAt: new Date(NOW - DAY),
    });
    await db.collection('payouts').insertOne({
        _id: new ObjectId(),
        recipient: ownerId,
        type: 'event_tickets',
        referenceId: listingId,
        referenceModel: 'Event',
        grossAmount: netPayable,
        platformCommission: 0,
        netAmount: netPayable,
        status: 'completed',
        createdAt: new Date(NOW - DAY),
    });

    return listingId;
}

/** The same request every time, except the notes, which mark the attempt. */
const submissionFor = (s: Spec, attempt: number) => ({
    settledAmount: s.amount,
    settlementReference: s.reference,
    settledAt: new Date(NOW - s.daysAgo * DAY),
    idempotencyKey: s.key,
    ...(s.method === null ? {} : { method: s.method }),
    ...(s.notes === null ? {} : { adminNotes: `${s.notes} #${attempt}` }),
});

/**
 * A fresh listing, then the same submission `repeats` times. The audit and
 * notification collections are cleared per run so their counts are about this
 * run's submissions only.
 */
async function submitRepeatedly(s: Spec, netPayable: number, ownerId: any, admin: any) {
    await Promise.all([Settlement.deleteMany({}), AuditLog.deleteMany({}), Notification.deleteMany({})]);
    const listingId = await seedListing(netPayable, ownerId);

    const results: any[] = [];
    for (let attempt = 0; attempt < s.repeats; attempt++) {
        results.push(
            await settlementService.recordEntry({
                kind: 'event',
                listingId: String(listingId),
                input: submissionFor(s, attempt),
                admin,
            })
        );
    }

    return { listingId, results };
}

/** The property itself, shared by both mechanisms. */
async function assertRecordedOnce(s: Spec, listingId: any, results: any[]) {
    // Exactly one Settlement_Entry for that listing and key.
    const stored = await Settlement.find({ listingKind: 'event', listing: listingId }).lean();
    expect(stored).toHaveLength(1);
    expect(
        await Settlement.countDocuments({ listingKind: 'event', listing: listingId, idempotencyKey: s.key })
    ).toBe(1);

    // It is the first submission's row, untouched by every retry — a retry
    // returns the recorded fact, it does not restate it.
    expect(stored[0].settledAmount).toBe(s.amount);
    expect(stored[0].settlementReference).toBe(s.reference);
    expect(stored[0].adminNotes).toBe(s.notes === null ? null : `${s.notes} #0`);

    // Every submission returned that same entry.
    for (const result of results) {
        expect(result.entry._id).toBe(String(stored[0]._id));
    }
    for (const retry of results.slice(1)) {
        expect(retry.alreadyRecorded).toBe(true);
        // The original submission notified the owner; re-sending would tell them
        // twice about one transfer.
        expect(retry.notified).toBe(false);
    }

    // Settled_To_Date is identical to the value after a single submission, both
    // in what each call returned and in what the ledger reads back as.
    expect(results[0].ledger.settledToDate).toBe(s.amount);
    for (const result of results) {
        expect(result.ledger.settledToDate).toBe(results[0].ledger.settledToDate);
        expect(result.state).toBe(results[0].state);
    }
    const read = await settlementService.getListingSettlement({ kind: 'event', listingId: String(listingId) });
    expect(read.money.settledToDate).toBe(s.amount);
    expect(read.state).toBe(results[0].state);
    expect(read.entries).toHaveLength(1);

    // One notification for one transfer, under either mechanism: delivery only
    // follows a successful insert (Requirement 10.1).
    expect(await Notification.countDocuments({})).toBe(1);
}

// 100 runs, each doing several real DB round-trips per submission plus a full
// service read, comfortably outrun vitest's 5s default.
const PROPERTY_TIMEOUT_MS = 240000;

describe('Property 6 — recording is idempotent in the Idempotency_Key', () => {
    it('answers repeated submissions from the pre-read, writing one entry, one audit record, one notification', async () => {
        // The unique (listingKind, listing, idempotencyKey) index must actually
        // exist for the store-level guarantee to be under test.
        await Settlement.init();

        const db = mongoose.connection.db!;
        const ownerId = new ObjectId();
        const adminId = new ObjectId();
        await db.collection('users').insertMany([
            { _id: ownerId, name: 'Olive Organizer', email: `${ownerId}@x.test` },
            { _id: adminId, name: 'Ada Admin', email: `${adminId}@x.test` },
        ]);
        const admin = { _id: adminId, name: 'Ada Admin', adminRole: 'admin' };

        await fc.assert(
            fc.asyncProperty(spec, async (s) => {
                // One amount fits under Net_Payable, so the first submission is
                // accepted; the retries never reach the guard at all.
                const { listingId, results } = await submitRepeatedly(s, s.amount + s.headroom, ownerId, admin);

                expect(results[0].alreadyRecorded).toBeUndefined();
                expect(results[0].notified).toBe(true);
                await assertRecordedOnce(s, listingId, results);

                // The pre-read sits before the audit write, so a retry leaves no
                // spurious audit record behind (Requirement 6.1).
                expect(await AuditLog.countDocuments({})).toBe(1);
            }),
            { numRuns: 25 }
        );
    }, PROPERTY_TIMEOUT_MS);

    it('answers repeated submissions that miss the pre-read from the unique index, still writing one entry', async () => {
        await Settlement.init();

        const db = mongoose.connection.db!;
        const ownerId = new ObjectId();
        const adminId = new ObjectId();
        await db.collection('users').insertMany([
            { _id: ownerId, name: 'Olive Organizer', email: `${ownerId}@x.test` },
            { _id: adminId, name: 'Ada Admin', email: `${adminId}@x.test` },
        ]);
        const admin = { _id: adminId, name: 'Ada Admin', adminRole: 'admin' };

        // Every submission misses the pre-read, which is what both halves of a
        // real race do, so the index is the only thing left holding the line.
        const realExists = Settlement.exists;
        Settlement.exists = async () => null;
        try {
            await fc.assert(
                fc.asyncProperty(spec, async (s) => {
                    // Twice the amount fits under Net_Payable here: a retry that
                    // misses the pre-read is folded against a ledger that already
                    // carries the first entry, and it has to clear the
                    // over-settlement guard to reach the insert where the index
                    // refuses it. A racing pair in production clears that guard
                    // for the same reason — both read Settled_To_Date before
                    // either insert lands.
                    const { listingId, results } = await submitRepeatedly(
                        s,
                        s.amount * 2 + s.headroom,
                        ownerId,
                        admin
                    );

                    await assertRecordedOnce(s, listingId, results);

                    // The audit write sits before the insert, so a submission that
                    // the index then refuses still leaves its record — by design,
                    // an audit row for an attempt is better for an auditor than an
                    // unaudited transfer, and no entry exists without one.
                    expect(await AuditLog.countDocuments({})).toBe(s.repeats);
                }),
                { numRuns: 25 }
            );
        } finally {
            Settlement.exists = realExists;
        }
    }, PROPERTY_TIMEOUT_MS);
});
