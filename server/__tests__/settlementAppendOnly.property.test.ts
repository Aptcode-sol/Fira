/**
 * Feature: per-listing-settlement-tracking, Property 9: The ledger is append-only.
 *
 * For any listing and any sequence of settlement, reversal, and read operations,
 * every previously stored Settlement_Entry is unchanged afterward, and the
 * service exposes no operation that edits or deletes a Settlement_Entry.
 *
 * Under test: `settlementService.recordEntry`, `recordReversal`,
 * `getListingSettlement`, `getOwnerSettlement`.
 *
 * Both clauses are asserted, and they need different kinds of evidence:
 *
 *  1. *Behavioural* — a generated sequence mixing accepted records, records the
 *     validator/guard/index refuses, accepted reversals, reversals refused for
 *     each of the four reasons, and both reads. After every single step the raw
 *     `settlements` documents are snapshotted straight out of the driver (not
 *     through the model, so nothing in the schema layer can normalise a
 *     difference away) and every row seen in any earlier snapshot must still be
 *     byte-identical — every field, including `createdAt`/`updatedAt`, which is
 *     what would move first if anything were doing a `findOneAndUpdate` behind
 *     the projection. Row count may only grow, and no id may disappear.
 *
 *  2. *Structural* — "the service exposes no operation that edits or deletes"
 *     is a claim about the surface, not about one run. A sequence of operations
 *     can only ever show that the mutating method was not reached; the absence
 *     of the method is checked by inspecting the service object and the model's
 *     own helpers. Mongoose's built-in `Model.updateOne`/`deleteOne` are not in
 *     scope here — they exist on every model — the claim is that neither this
 *     service nor this model adds a settlement-editing capability of its own.
 *
 * Rejections are deliberately generated, not avoided: a rejected write is the
 * most likely place for a half-applied mutation to hide, since it is the path
 * where the service has already read, folded, and in some cases audited before
 * deciding not to insert.
 *
 * Real records in a real (in-memory) Mongo, no stubs: "nothing that is stored
 * ever changes" is a claim about the store, so a stubbed store would test the
 * stub. `Settlement.init()` is awaited so the unique index — one of the things
 * that turns a generated duplicate key into a rejection rather than a second
 * row — provably exists.
 *
 * Validates: Requirements 7.3
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
// Fixed Net_Payable for every generated listing. Amounts are generated up to
// half of it, so a sequence of two or three records straddles the
// over-settlement boundary on its own — accepted writes and guard rejections
// both appear without the generator having to aim for either.
const NET_PAYABLE = 10000;

// --- generators ------------------------------------------------------------

/** A string that survives trimming — the same reading `isFilled` gives. */
const FILLED = fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0);

type Op =
    | {
        t: 'record';
        amount: number;
        ref: string;
        key: string;
        notes: string | null;
        daysAgo: number;
        method: 'manual' | 'gateway' | null;
        override: boolean;
        superAdmin: boolean;
    }
    // Each variant is one field the validator must refuse (Req 4.7-4.9, 6.3).
    | { t: 'badRecord'; variant: 0 | 1 | 2 | 3 | 4 }
    // `pick` indexes into the rows stored so far, so a reversal lands on a real
    // entry, on an already-reversed one, or on a reversal row itself.
    | { t: 'reverse'; pick: number; reason: string; blankReason: boolean; strayId: boolean }
    | { t: 'read' }
    | { t: 'readOwner'; asOwner: boolean };

const op: fc.Arbitrary<Op> = fc.oneof(
    { weight: 4, arbitrary: fc.record({
        t: fc.constant('record' as const),
        amount: fc.integer({ min: 1, max: NET_PAYABLE / 2 }),
        ref: FILLED.map((s) => `UTR-${s}`),
        // A small key pool, so a generated sequence resubmits a key often enough
        // for the idempotent answer to be part of what is under test.
        key: fc.constantFrom('k1', 'k2', 'k3'),
        notes: fc.option(FILLED, { nil: null }),
        daysAgo: fc.integer({ min: 0, max: 60 }),
        method: fc.option(fc.constantFrom<'manual' | 'gateway'>('manual', 'gateway'), { nil: null }),
        override: fc.boolean(),
        superAdmin: fc.boolean(),
    }) },
    { weight: 2, arbitrary: fc.record({
        t: fc.constant('badRecord' as const),
        variant: fc.constantFrom<0 | 1 | 2 | 3 | 4>(0, 1, 2, 3, 4),
    }) },
    { weight: 3, arbitrary: fc.record({
        t: fc.constant('reverse' as const),
        pick: fc.nat({ max: 6 }),
        reason: FILLED.map((s) => `reason ${s}`),
        blankReason: fc.boolean(),
        strayId: fc.boolean(),
    }) },
    { weight: 1, arbitrary: fc.record({ t: fc.constant('read' as const) }) },
    { weight: 1, arbitrary: fc.record({
        t: fc.constant('readOwner' as const),
        asOwner: fc.boolean(),
    }) },
);

const sequence = fc.array(op, { minLength: 2, maxLength: 7 });

// --- fixtures --------------------------------------------------------------

/**
 * Raw collection inserts: the service reads the listing by id and the money by
 * listing scope, so the full Event/Payment required-field sets would be fixture
 * noise. One success Payment and one Payout pin Net_Payable, which is what the
 * over-settlement guard decides against.
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

// --- the snapshot ----------------------------------------------------------

/**
 * A stable serialization of one stored document. Keys are sorted so a driver
 * field order change is not read as a mutation, Dates and ObjectIds are
 * rendered by value, and everything else carries its type — so `5000` and
 * `'5000'` are different strings, which is the point of comparing this way
 * rather than with a loose deep-equal.
 */
function canonical(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (value instanceof Date) return `date:${value.toISOString()}`;
    if (typeof value === 'object' && typeof value.toHexString === 'function') return `oid:${value.toHexString()}`;
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (typeof value === 'object') {
        return `{${Object.keys(value).sort().map((k) => `${k}=${canonical(value[k])}`).join(',')}}`;
    }
    return `${typeof value}:${String(value)}`;
}

/**
 * Every stored settlement document, read straight out of the driver rather than
 * through the model, so no schema-level cast or default can paper over a
 * difference between what was written and what is there now.
 */
async function snapshot(): Promise<Map<string, string>> {
    const rows = await mongoose.connection.db!.collection('settlements').find({}).toArray();
    return new Map(rows.map((row) => [String(row._id), canonical(row)]));
}

// --- the operations --------------------------------------------------------

const BAD_RECORDS: Array<Record<string, any>> = [
    { settledAmount: 0 }, // Req 4.7 — not positive
    { settledAmount: 12.5 }, // Req 4.7 — not whole rupees
    { settlementReference: '   ' }, // Req 4.8 — blank
    { settledAt: new Date(NOW + 30 * DAY) }, // Req 4.9 — future
    { idempotencyKey: '' }, // Req 6.3 — absent
];

/**
 * Run one generated operation. Every rejection is swallowed: what a rejection
 * *says* is Properties 7 and 8's job, and what matters here is only that the
 * stored rows are the same afterwards either way.
 */
async function apply(step: Op, ctx: { listingId: any; ownerId: any; adminId: any; adminName: string }) {
    const { listingId, ownerId, adminId, adminName } = ctx;
    const kind = 'event' as const;

    try {
        switch (step.t) {
            case 'record':
                return await settlementService.recordEntry({
                    kind,
                    listingId: String(listingId),
                    input: {
                        settledAmount: step.amount,
                        settlementReference: step.ref,
                        settledAt: new Date(NOW - step.daysAgo * DAY),
                        idempotencyKey: step.key,
                        ...(step.method === null ? {} : { method: step.method }),
                        ...(step.notes === null ? {} : { adminNotes: step.notes }),
                        // An override from a plain admin is refused outright, and
                        // one with no reason is refused too — both are generated,
                        // both must leave the stored rows alone.
                        ...(step.override ? { override: true, overrideReason: step.notes } : {}),
                    },
                    admin: { _id: adminId, name: adminName, adminRole: step.superAdmin ? 'super_admin' : 'admin' },
                });

            case 'badRecord':
                return await settlementService.recordEntry({
                    kind,
                    listingId: String(listingId),
                    input: {
                        settledAmount: 1000,
                        settlementReference: 'UTR-bad',
                        settledAt: new Date(NOW - DAY),
                        idempotencyKey: `bad-${step.variant}`,
                        ...BAD_RECORDS[step.variant],
                    },
                    admin: { _id: adminId, name: adminName, adminRole: 'admin' },
                });

            case 'reverse': {
                const ids = [...(await snapshot()).keys()];
                // A stray id, or no rows yet, means a target that does not exist
                // (Req 7.6). Otherwise the pick may land on a live entry, on one
                // already reversed (Req 7.5), or on a reversal row (Req 7.8).
                const entryId = step.strayId || ids.length === 0
                    ? String(new ObjectId())
                    : ids[step.pick % ids.length];
                return await settlementService.recordReversal({
                    kind,
                    listingId: String(listingId),
                    entryId,
                    reason: step.blankReason ? '  ' : step.reason, // Req 7.7
                    admin: { _id: adminId, name: adminName, adminRole: 'admin' },
                });
            }

            case 'read':
                return await settlementService.getListingSettlement({ kind, listingId: String(listingId) });

            case 'readOwner':
                return await settlementService.getOwnerSettlement({
                    kind,
                    listingId: String(listingId),
                    // A non-owner read is a 403 — also a read, also forbidden
                    // from touching a row (Req 11.6).
                    requesterId: String(step.asOwner ? ownerId : new ObjectId()),
                });
        }
    } catch {
        return null;
    }
}

// 100 runs, each replaying a whole operation sequence of real service calls with
// a full raw snapshot between every step, comfortably outrun vitest's 5s default.
const PROPERTY_TIMEOUT_MS = 300000;

describe('Property 9 — the ledger is append-only', () => {
    it('leaves every previously stored entry byte-identical across any sequence of records, reversals and reads', async () => {
        // The unique (listingKind, listing, idempotencyKey) index must actually
        // exist, or a resubmitted key would insert a second row instead of being
        // answered from the store.
        await Settlement.init();

        const db = mongoose.connection.db!;
        const ownerId = new ObjectId();
        const adminId = new ObjectId();
        await db.collection('users').insertMany([
            { _id: ownerId, name: 'Olive Organizer', email: `${ownerId}@x.test` },
            { _id: adminId, name: 'Ada Admin', email: `${adminId}@x.test` },
        ]);
        const adminName = 'Ada Admin';

        // Guards the property against being vacuous: "nothing changed" is
        // trivially true over sequences that never stored anything, so the runs
        // must be shown to have produced both kinds of row.
        let entriesWritten = 0;
        let reversalsWritten = 0;

        await fc.assert(
            fc.asyncProperty(sequence, async (steps) => {
                await Promise.all([Settlement.deleteMany({}), AuditLog.deleteMany({}), Notification.deleteMany({})]);
                const listingId = await seedListing(ownerId);
                const ctx = { listingId, ownerId, adminId, adminName };

                // Every row ever seen, by id, with the bytes it was first seen as.
                const seen = new Map<string, string>();
                let previousCount = 0;

                for (const step of steps) {
                    await apply(step, ctx);
                    const now = await snapshot();

                    // Nothing already written may differ, and nothing may vanish.
                    for (const [id, bytes] of seen) {
                        expect(now.has(id), `entry ${id} disappeared after a ${step.t} operation`).toBe(true);
                        expect(now.get(id), `entry ${id} changed after a ${step.t} operation`).toBe(bytes);
                    }

                    // Row count may only grow.
                    expect(now.size).toBeGreaterThanOrEqual(previousCount);
                    previousCount = now.size;

                    for (const [id, bytes] of now) if (!seen.has(id)) seen.set(id, bytes);
                }

                // No row was lost anywhere in the sequence.
                expect(previousCount).toBe(seen.size);

                entriesWritten += seen.size;
                reversalsWritten += await Settlement.countDocuments({ isReversalOf: { $ne: null } });
            }),
            { numRuns: 25 },
        );

        expect(entriesWritten).toBeGreaterThan(0);
        expect(reversalsWritten).toBeGreaterThan(0);
    }, PROPERTY_TIMEOUT_MS);

    it('exposes no operation that edits or deletes a settlement entry', () => {
        // The second clause of the property: a sequence of calls can only show
        // that a mutating method was not reached, so the absence of one is
        // checked on the surface itself.
        const MUTATING = /update|delete|edit|remove|destroy|drop|modify|replace|patch|overwrite|unset|save/i;

        const serviceMethods = Object.getOwnPropertyNames(settlementService).filter(
            (name) => typeof settlementService[name] === 'function',
        );
        expect(serviceMethods.filter((name) => MUTATING.test(name))).toEqual([]);
        // And the surface is exactly the four reads/appends plus the pure helpers,
        // so a mutating method added under an innocent name still shows up here.
        expect(serviceMethods.sort()).toEqual([
            'buildLedger',
            'checkOverSettlement',
            'getListingSettlement',
            'getOwnerSettlement',
            'recordEntry',
            'recordReversal',
            'toAdminRow',
            'toOwnerRow',
            'validateEntry',
        ]);

        // The model carries no editing helper of its own either. Mongoose's own
        // Model.updateOne/deleteOne are out of scope — every model has them —
        // what is asserted is that Settlement adds none.
        const schema = Settlement.schema;
        for (const bag of [schema.statics, schema.methods, schema.query]) {
            expect(Object.keys(bag || {}).filter((name) => MUTATING.test(name))).toEqual([]);
        }
        expect(Object.keys(schema.statics || {})).toEqual([]);
        // `initializeTimestamps` is mongoose's own, installed by `timestamps: true`
        // — the schema adds no instance helper beyond it.
        expect(Object.keys(schema.methods || {}).filter((name) => name !== 'initializeTimestamps')).toEqual([]);
    });
});
