/**
 * Feature: per-listing-settlement-tracking, Property 14: No settlement exists
 * without its audit record.
 *
 * For any sequence of accepted settlement and reversal operations, including
 * ones whose audit write fails, every stored Settlement_Entry has exactly one
 * matching Audit_Log record carrying the acting administrator, the action, the
 * listing kind and identifier, the amount, the settlement reference or reversed
 * entry identifier with its reason, any override reason, and the action
 * timestamp; and no entry exists whose audit record is missing.
 *
 * Under test: `settlementService.recordEntry` and `settlementService.recordReversal`.
 *
 * The audit sink is the one thing stubbed: `AuditLog.create` is made to throw on
 * a generated subset of the operations, which is the only way to reach
 * Requirement 8.4's branch. Everything else is real records in a real
 * (in-memory) Mongo, because "no row exists without its record" is a claim about
 * what is actually stored.
 *
 * The invariant asserted here is deliberately one-directional: every stored row
 * must have its audit record, but NOT every audit record has a row. The service
 * writes the audit record *before* the insert, on purpose — an audit row for an
 * attempt that then failed to insert (or was refused by the unique idempotency
 * index) is strictly better for an auditor than an unaudited transfer. So the
 * converse would be a false property, and asserting it would be asserting the
 * wrong ordering.
 *
 * Rejected operations are part of the generated space and are swallowed: a
 * validation rejection, an over-settlement refusal, a double reversal and an
 * audit failure all write nothing, so they can only ever help the invariant —
 * what matters is that whatever *did* get stored is accounted for.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */
import { describe, it, expect, afterAll } from 'vitest';
import fc from 'fast-check';
import mongoose from 'mongoose';
// The in-memory Mongo server and its connection are owned by the shared setup
// file; creating a second MongoMemoryServer here would fight it for the connection.
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
// Well above anything the generators can settle, so the over-settlement guard is
// not what shapes this run: the subject here is the audit write, not the limit.
const NET_PAYABLE = 1_000_000;

// --- the audit sink, made to fail on demand -------------------------------

const realAuditCreate = AuditLog.create.bind(AuditLog);
let failAudit = false;
AuditLog.create = async (...args: any[]) => {
    if (failAudit) throw new Error('audit sink down');
    return realAuditCreate(...args);
};
afterAll(() => {
    AuditLog.create = realAuditCreate;
});

// --- generators ------------------------------------------------------------

/** A string that survives trimming — the same reading `isFilled` gives. */
const FILLED = fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0);

type SettleOp = {
    type: 'settle';
    amount: number;
    reference: string;
    // A small key pool, so repeated submissions of the same transfer happen
    // often: a replay answered from the pre-read must not add a second audit
    // record for the one row, which is what "exactly one" is about.
    key: string;
    daysAgo: number;
    overrideReason: string | null;
    actor: 'admin' | 'super';
    auditFails: boolean;
};

type ReverseOp = {
    type: 'reverse';
    // An index into the entries stored so far, resolved at run time.
    pick: number;
    // A whitespace-only reason is as absent as a missing one, so it stands for
    // the rejected reversal in the generated space.
    reason: string;
    actor: 'admin' | 'super';
    auditFails: boolean;
};

type Op = SettleOp | ReverseOp;

const settleOp: fc.Arbitrary<SettleOp> = fc.record({
    type: fc.constant<'settle'>('settle'),
    amount: fc.integer({ min: 1, max: 5000 }),
    reference: FILLED.map((s) => `UTR-${s}`),
    key: fc.constantFrom('k1', 'k2', 'k3'),
    daysAgo: fc.integer({ min: 0, max: 300 }),
    // An override with a reason from a super admin is the Requirement 8.3 path:
    // the reason must reach the audit record, not only the row. From a plain
    // admin the same flag is a 403, which writes nothing at all.
    overrideReason: fc.option(FILLED, { nil: null, freq: 3 }),
    actor: fc.constantFrom<'admin' | 'super'>('admin', 'super'),
    auditFails: fc.boolean(),
});

const reverseOp: fc.Arbitrary<ReverseOp> = fc.record({
    type: fc.constant<'reverse'>('reverse'),
    pick: fc.nat({ max: 8 }),
    reason: fc.oneof({ weight: 4, arbitrary: FILLED }, { weight: 1, arbitrary: fc.constant('   ') }),
    actor: fc.constantFrom<'admin' | 'super'>('admin', 'super'),
    auditFails: fc.boolean(),
});

// Settles are weighted above reversals so most runs have something to reverse.
const ops: fc.Arbitrary<Op[]> = fc.array(
    fc.oneof({ weight: 3, arbitrary: settleOp }, { weight: 2, arbitrary: reverseOp }),
    { minLength: 1, maxLength: 5 }
);

// --- fixtures --------------------------------------------------------------

/**
 * Raw collection inserts, as in the sibling settlement property tests: the
 * service reads the listing by id and the money by listing scope, so the full
 * Event/Payment required-field sets would be fixture noise. One success Payment
 * and one Payout pin Net_Payable.
 */
async function seedListing(ownerId: any) {
    const db = mongoose.connection.db!;
    const listingId = new ObjectId();

    await db.collection('events').insertOne({ _id: listingId, name: 'Generated Event', organizer: ownerId });
    await db.collection('payments').insertOne({
        _id: new ObjectId(),
        user: ownerId,
        type: 'ticket_purchase',
        referenceId: listingId,
        referenceModel: 'Event',
        amount: NET_PAYABLE,
        totalAmount: NET_PAYABLE,
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
        grossAmount: NET_PAYABLE,
        platformCommission: 0,
        netAmount: NET_PAYABLE,
        status: 'completed',
        createdAt: new Date(NOW - DAY),
    });

    return listingId;
}

/** Run one generated sequence against a fresh listing. */
async function runSequence(sequence: Op[], listingId: any, actors: Record<'admin' | 'super', any>) {
    for (const op of sequence) {
        failAudit = op.auditFails;
        try {
            if (op.type === 'settle') {
                await settlementService.recordEntry({
                    kind: 'event',
                    listingId: String(listingId),
                    input: {
                        settledAmount: op.amount,
                        settlementReference: op.reference,
                        settledAt: new Date(NOW - op.daysAgo * DAY),
                        idempotencyKey: op.key,
                        ...(op.overrideReason === null ? {} : { override: true, overrideReason: op.overrideReason }),
                    },
                    admin: actors[op.actor],
                });
            } else {
                const targets = await Settlement.find({ listing: listingId, isReversalOf: null }).lean();
                const entryId = targets.length
                    ? String(targets[op.pick % targets.length]._id)
                    : String(new ObjectId());
                await settlementService.recordReversal({
                    kind: 'event',
                    listingId: String(listingId),
                    entryId,
                    reason: op.reason,
                    admin: actors[op.actor],
                });
            }
        } catch (err: any) {
            // Every rejection in this service writes nothing — a rejected
            // operation cannot be the one that breaks the invariant, so the run
            // simply carries on to the next operation.
            if (op.auditFails && /audit write failed/.test(String(err?.message))) seen.auditFailures++;
        } finally {
            failAudit = false;
        }
    }
}

// A generated sequence can end up storing nothing at all (every operation
// rejected), and "every stored row has its record" is trivially true of no rows.
// These counters make the run's own coverage assertable, so the property cannot
// pass vacuously.
const seen = { settlements: 0, reversals: 0, auditFailures: 0 };

/** The invariant itself. */
async function assertNoUnauditedEntry(listingId: any) {
    const rows = await Settlement.find({ listing: listingId }).lean();
    const audits = await AuditLog.find({}).lean();

    for (const row of rows) {
        const action = row.isReversalOf == null ? 'settle' : 'reverse';
        if (action === 'settle') seen.settlements++;
        else seen.reversals++;
        // The idempotency key identifies the operation the row came from, and it
        // is unique per (listing, key) — so it is what makes "exactly one
        // matching record" a decidable question rather than a fuzzy match.
        const matching = audits.filter(
            (audit: any) => audit.action === action && audit.metadata?.idempotencyKey === row.idempotencyKey
        );
        expect(matching).toHaveLength(1);
        const audit: any = matching[0];

        // The acting administrator, the action, the listing kind and identifier
        // (Requirements 8.1, 8.2).
        expect(String(audit.adminUser)).toBe(String(row.recordedBy));
        expect(audit.entityType).toBe('event');
        expect(String(audit.entityId)).toBe(String(listingId));
        expect(audit.metadata.listingKind).toBe('event');

        // The amount, and the action timestamp.
        expect(audit.metadata.settledAmount).toBe(row.settledAmount);
        expect(audit.timestamp instanceof Date).toBe(true);

        if (action === 'settle') {
            // The settlement reference, and the override reason when the entry
            // was waved through as an over-settlement (Requirements 8.1, 8.3).
            expect(audit.metadata.settlementReference).toBe(row.settlementReference);
            expect(audit.metadata.overrideReason ?? null).toBe(row.overrideReason ?? null);
            if (row.isOverSettlement) expect(audit.metadata.overrideReason).toBeTruthy();
        } else {
            // The reversed entry identifier and the reversal reason (Req 8.2).
            expect(audit.metadata.reversedEntryId).toBe(String(row.isReversalOf));
            expect(audit.metadata.reversalReason).toBe(row.reversalReason);
        }
    }

    // The other direction is NOT asserted, by design: the audit write precedes
    // the insert, so `audits.length >= rows.length` is all that can be claimed —
    // an audit record may describe an attempt whose insert then failed or was
    // refused by the unique idempotency index.
    expect(audits.length).toBeGreaterThanOrEqual(rows.length);
}

// 100 runs, each doing several real DB round-trips per operation plus a money
// read, comfortably outrun vitest's 5s default.
const PROPERTY_TIMEOUT_MS = 300000;

describe('Property 14 — no settlement exists without its audit record', () => {
    it('accounts for every stored entry with exactly one audit record, however the audit sink behaves', async () => {
        // The unique (listingKind, listing, idempotencyKey) index must exist, or
        // the replay path under test is not the one that runs in production.
        await Settlement.init();

        const db = mongoose.connection.db!;
        const ownerId = new ObjectId();
        const adminId = new ObjectId();
        const superId = new ObjectId();
        await db.collection('users').insertMany([
            { _id: ownerId, name: 'Olive Organizer', email: `${ownerId}@x.test` },
            { _id: adminId, name: 'Ada Admin', email: `${adminId}@x.test` },
            { _id: superId, name: 'Sam Super', email: `${superId}@x.test` },
        ]);
        // Two acting administrators, so "the audit record carries the acting
        // administrator" is checkable against the row's own `recordedBy` rather
        // than against the only id in the database.
        const actors = {
            admin: { _id: adminId, name: 'Ada Admin', adminRole: 'admin' },
            super: { _id: superId, name: 'Sam Super', adminRole: 'super_admin' },
        };

        await fc.assert(
            fc.asyncProperty(ops, async (sequence) => {
                await Promise.all([
                    Settlement.deleteMany({}),
                    AuditLog.deleteMany({}),
                    Notification.deleteMany({}),
                ]);
                const listingId = await seedListing(ownerId);

                await runSequence(sequence, listingId, actors);
                await assertNoUnauditedEntry(listingId);
            }),
            { numRuns: 25 }
        );

        // The property is only worth anything if the runs actually stored
        // settlements and reversals and did hit Requirement 8.4's branch.
        expect(seen.settlements).toBeGreaterThan(0);
        expect(seen.reversals).toBeGreaterThan(0);
        expect(seen.auditFailures).toBeGreaterThan(0);
    }, PROPERTY_TIMEOUT_MS);
});
