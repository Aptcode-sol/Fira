/**
 * Feature: per-listing-settlement-tracking, Property 8: An invalid reversal
 * changes nothing.
 *
 * For any reversal request naming an entry that is already reversed, does not
 * exist, belongs to a different listing, or is itself a Reversal_Entry, or
 * carrying a blank reason, the request is rejected and the listing's ledger is
 * byte-identical to its state before the request.
 *
 * Under test: `settlementService.recordReversal({ kind, listingId, entryId, reason, admin })`.
 *
 * "Byte-identical" is the strong half of the claim, so it is asserted strongly:
 * every stored row of every listing is snapshotted whole before the request —
 * all fields, `createdAt` and `updatedAt` included — and compared afterwards
 * both structurally and as serialized bytes. A rejection that quietly bumped
 * `updatedAt`, re-ordered rows, or touched the *other* listing's entries fails
 * here. `AuditLog` and `Notification` are counted too: a rejected reversal is
 * not an action, so it leaves no record and tells nobody (Req 7.5-7.8, each
 * ending in "SHALL create no Reversal_Entry").
 *
 * Real records in a real (in-memory) Mongo — the already-reversed class is
 * partly enforced by the unique `(listingKind, listing, idempotencyKey)` index
 * on the derived `reversal:<targetId>` key, so stubbing the store would test the
 * stub. `Settlement.init()` is awaited so that index provably exists.
 *
 * All five rejection classes named by the property are generated, with the
 * malformed id split out from the merely absent one:
 *   - `alreadyReversed`  → 409, and again with the pre-read stubbed to miss, so
 *                          the index backstop is under test as well;
 *   - `nonexistent`      → 404 (a well-formed id naming no row);
 *   - `malformed`        → 404 (a CastError must not surface as a 500);
 *   - `crossListing`     → 404 (an entry that exists, on another listing);
 *   - `reversalTarget`   → 400 `not_reversible`;
 *   - `blankReason`      → 400 naming `reason` (absent, empty, whitespace-only).
 *
 * Validates: Requirements 7.5, 7.6, 7.7, 7.8
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import mongoose from 'mongoose';
// The in-memory Mongo server and its connection belong to the shared setup file
// (registered as vitest `setupFiles`). A second MongoMemoryServer here throws
// "openUri() on an active connection with different connection strings".
import './setup';

const settlementService = require('../services/settlementService');
const Settlement = require('../models/Settlement');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
// Registered so any read inside the money path resolves its models.
require('../models/Payment');
require('../models/Payout');

const { ObjectId } = mongoose.Types;

const NOW = Date.now();
const DAY = 24 * 3600 * 1000;

// 100 runs, each re-seeding a four-row ledger across two listings and taking two
// full snapshots, comfortably outrun vitest's 5s default.
const PROPERTY_TIMEOUT_MS = 240000;

// --- generators ------------------------------------------------------------

/** A string that survives trimming — the same reading `isFilled` gives. */
const FILLED = fc.string({ minLength: 1, maxLength: 16 }).filter((s) => s.trim().length > 0);

/** Whitespace-only, empty, and absent all mean "no reason given" (Req 7.7). */
const BLANK: fc.Arbitrary<string | null | undefined> = fc.oneof(
    fc.constant(undefined),
    fc.constant(null),
    fc.constant(''),
    fc
        .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 6 })
        .map((chars) => chars.join(''))
);

/**
 * Ids that could never name a row. `''` and `undefined` are here for the same
 * reason `'not-an-id'` is: `mongoose.isValidObjectId` has to answer all three
 * before a query is built, or a CastError becomes a 500 instead of a 404.
 */
const MALFORMED: fc.Arbitrary<any> = fc.oneof(
    fc.constant('not-an-id'),
    fc.constant(''),
    fc.constant(undefined),
    fc.constant('   '),
    fc.constant('0'.repeat(23)), // one hex digit short of an ObjectId
    fc.constant('zzzzzzzzzzzzzzzzzzzzzzzz'), // right length, not hex
    fc.string({ minLength: 1, maxLength: 8 }).filter((s) => !mongoose.isValidObjectId(s))
);

type RejectionClass = 'alreadyReversed' | 'nonexistent' | 'malformed' | 'crossListing' | 'reversalTarget' | 'blankReason';

type Request = { rejection: RejectionClass; malformedId: any; reason: string | null | undefined };

/** The ledger this run is seeded with, before anything is asked of it. */
type Fixture = {
    plain: number; // the untouched entry's amount
    reversed: number; // the already-reversed entry's amount
    foreign: number; // the other listing's entry
    reference: string;
    daysAgo: number;
};

const fixture: fc.Arbitrary<Fixture> = fc.record({
    plain: fc.integer({ min: 1, max: 9000 }),
    reversed: fc.integer({ min: 1, max: 9000 }),
    foreign: fc.integer({ min: 1, max: 9000 }),
    reference: FILLED.map((s) => `UTR-${s}`),
    daysAgo: fc.integer({ min: 0, max: 300 }),
});

const request: fc.Arbitrary<Request> = fc.record({
    rejection: fc.constantFrom<RejectionClass>(
        'alreadyReversed',
        'nonexistent',
        'malformed',
        'crossListing',
        'reversalTarget',
        'blankReason'
    ),
    malformedId: MALFORMED,
    // Only read for the `blankReason` class; every other class carries a real
    // reason, so its rejection is provably about the entry and not the reason.
    reason: BLANK,
});

// --- fixtures --------------------------------------------------------------

/**
 * Raw collection inserts for the two listings and the two users. recordReversal
 * reads the listing by id and the owner by id, so the full Event required-field
 * set would be fixture noise; the Payment/Payout pair pins Net_Payable for the
 * money path, which no rejection reaches but which must not be the reason a
 * request fails.
 */
async function seedWorld() {
    const db = mongoose.connection.db!;
    const ownerId = new ObjectId();
    const adminId = new ObjectId();
    const listingId = new ObjectId();
    const otherListingId = new ObjectId();

    await db.collection('users').insertMany([
        { _id: ownerId, name: 'Olive Organizer', email: `${ownerId}@x.test` },
        { _id: adminId, name: 'Ada Admin', email: `${adminId}@x.test` },
    ]);
    await db.collection('events').insertMany([
        { _id: listingId, name: 'Generated Event', organizer: ownerId },
        { _id: otherListingId, name: 'Other Event', organizer: ownerId },
    ]);
    for (const id of [listingId, otherListingId]) {
        await db.collection('payments').insertOne({
            _id: new ObjectId(),
            user: ownerId,
            type: 'ticket_purchase',
            referenceId: id,
            referenceModel: 'Event',
            amount: 50000,
            totalAmount: 50000,
            platformFee: 0,
            gstAmount: 0,
            status: 'success',
            paidAt: new Date(NOW - DAY),
        });
        await db.collection('payouts').insertOne({
            _id: new ObjectId(),
            recipient: ownerId,
            type: 'event_tickets',
            referenceId: id,
            referenceModel: 'Event',
            grossAmount: 50000,
            platformCommission: 0,
            netAmount: 50000,
            status: 'completed',
            createdAt: new Date(NOW - DAY),
        });
    }

    return {
        ownerId,
        adminId,
        listingId,
        otherListingId,
        admin: { _id: adminId, name: 'Ada Admin', adminRole: 'admin' },
    };
}

type World = Awaited<ReturnType<typeof seedWorld>>;

/**
 * A fresh four-row ledger: on the listing under test an untouched entry, an
 * already-reversed entry, and the Reversal_Entry that reversed it; on the other
 * listing one entry, which is the cross-listing target and also the witness that
 * a rejection touches nothing anywhere.
 *
 * Audit and notification collections are cleared with it, so their counts are
 * about this run's one request.
 */
async function seedLedger(f: Fixture, w: World) {
    await Promise.all([Settlement.deleteMany({}), AuditLog.deleteMany({}), Notification.deleteMany({})]);

    const base = {
        listingKind: 'event' as const,
        listingModel: 'Event' as const,
        recipient: w.ownerId,
        method: 'manual' as const,
        recordedBy: w.adminId,
        settledAt: new Date(NOW - f.daysAgo * DAY),
    };

    const plain = await Settlement.create({
        ...base,
        listing: w.listingId,
        settledAmount: f.plain,
        settlementReference: `${f.reference}-A`,
        adminNotes: 'first tranche',
        idempotencyKey: 'key-plain',
    });
    const reversed = await Settlement.create({
        ...base,
        listing: w.listingId,
        settledAmount: f.reversed,
        settlementReference: `${f.reference}-B`,
        idempotencyKey: 'key-reversed',
    });
    const reversal = await Settlement.create({
        ...base,
        listing: w.listingId,
        settledAmount: -f.reversed,
        settlementReference: `${f.reference}-B`,
        isReversalOf: reversed._id,
        reversalReason: 'recorded against the wrong listing',
        idempotencyKey: `reversal:${String(reversed._id)}`,
    });
    const foreign = await Settlement.create({
        ...base,
        listing: w.otherListingId,
        settledAmount: f.foreign,
        settlementReference: `${f.reference}-C`,
        idempotencyKey: 'key-foreign',
    });

    return { plain, reversed, reversal, foreign };
}

type Ledger = Awaited<ReturnType<typeof seedLedger>>;

/**
 * Every stored row of every listing, whole and in a fixed order, plus the two
 * side-effect counts. Sorted by `_id` rather than by `settledAt`, because the
 * generated rows can share a `settledAt` to the millisecond and the comparison
 * must be about the rows, not about a tie-break.
 */
async function snapshot() {
    const rows = await Settlement.find({}).sort({ _id: 1 }).lean();
    return {
        rows,
        bytes: JSON.stringify(rows),
        audits: await AuditLog.countDocuments({}),
        notifications: await Notification.countDocuments({}),
    };
}

/** What each rejection class asks for, and what it must be answered with. */
function requestFor(r: Request, w: World, l: Ledger) {
    const good = 'the transfer was recalled by the bank';
    switch (r.rejection) {
        case 'alreadyReversed':
            return { entryId: String(l.reversed._id), reason: good, status: 409, code: 'already_reversed' };
        case 'nonexistent':
            return { entryId: String(new ObjectId()), reason: good, status: 404 };
        case 'malformed':
            return { entryId: r.malformedId, reason: good, status: 404 };
        case 'crossListing':
            return { entryId: String(l.foreign._id), reason: good, status: 404 };
        case 'reversalTarget':
            return { entryId: String(l.reversal._id), reason: good, status: 400, code: 'not_reversible' };
        case 'blankReason':
            // A real, reversible, not-yet-reversed target: the only thing wrong
            // with this request is the reason.
            return { entryId: String(l.plain._id), reason: r.reason, status: 400, field: 'reason' };
    }
}

/**
 * The property: the request is rejected as its class dictates, and the store is
 * byte-identical to the snapshot taken before it.
 *
 * `expectedAudits` is 0 for every rejection the service decides before it writes
 * anything, which is all five classes on the normal path. It is 1 only for the
 * race backstop, where the audit record is written before the insert the unique
 * index then refuses — by design, an audit row for an attempted reversal is
 * better for an auditor than an unaudited one, and Requirement 8.4 only runs the
 * other way. The Settlement collection is byte-identical either way, which is
 * what the property claims.
 */
async function assertChangesNothing(r: Request, w: World, l: Ledger, expectedAudits = 0) {
    const expected = requestFor(r, w, l);
    const before = await snapshot();

    const error = await settlementService
        .recordReversal({
            kind: 'event',
            listingId: String(w.listingId),
            entryId: expected.entryId,
            reason: expected.reason,
            admin: w.admin,
        })
        .then(
            () => null,
            (e: any) => e
        );

    // Rejected — never resolved, and with the status its class dictates.
    expect(error, `${r.rejection} was accepted`).not.toBeNull();
    expect(error.status).toBe(expected.status);
    if (expected.code) expect(error.code).toBe(expected.code);
    if (expected.field) expect(error.field).toBe(expected.field);
    // Nothing money-shaped rides along on a rejection.
    expect(error.settledToDate).toBeUndefined();

    // Byte-identical: same rows, same fields, same timestamps, same bytes.
    const after = await snapshot();
    expect(after.rows).toEqual(before.rows);
    expect(after.bytes).toBe(before.bytes);
    expect(after.rows).toHaveLength(4);

    // No Reversal_Entry was created: still exactly the one seeded reversal,
    // and none of it hanging off the entry this request named.
    expect(await Settlement.countDocuments({ isReversalOf: { $ne: null } })).toBe(1);
    if (mongoose.isValidObjectId(expected.entryId)) {
        expect(await Settlement.countDocuments({ isReversalOf: expected.entryId })).toBe(
            r.rejection === 'alreadyReversed' ? 1 : 0
        );
    }

    // A rejected reversal notified nobody, and left no audit record beyond the
    // one the race backstop writes before the insert it never lands.
    expect(before.audits).toBe(0);
    expect(after.audits).toBe(expectedAudits);
    expect(after.notifications).toBe(before.notifications);
    expect(after.notifications).toBe(0);

    // The ledger the surfaces read is unchanged too — the reversed pair still
    // nets out, the untouched entry still counts.
    const read = await settlementService.getListingSettlement({ kind: 'event', listingId: String(w.listingId) });
    expect(read.money.settledToDate).toBe(l.plain.settledAmount);
    expect(read.entries).toHaveLength(3);
}

// --- the property ----------------------------------------------------------

describe('Property 8 — an invalid reversal changes nothing', () => {
    it('rejects every invalid reversal class and leaves the stored ledger byte-identical', async () => {
        // The unique (listingKind, listing, idempotencyKey) index must exist for
        // the store-level half of the already-reversed guarantee to be real.
        await Settlement.init();
        const w = await seedWorld();

        await fc.assert(
            fc.asyncProperty(fixture, request, async (f, r) => {
                const l = await seedLedger(f, w);
                await assertChangesNothing(r, w, l);
            }),
            { numRuns: 25 }
        );
    }, PROPERTY_TIMEOUT_MS);

    it('still changes nothing when a second reversal misses the pre-read and reaches the unique index', async () => {
        await Settlement.init();
        const w = await seedWorld();

        // Both halves of a real race miss the `already reversed` pre-read, which
        // leaves the derived idempotency key as the only thing refusing the
        // second reversal. Its E11000 must read as the same 409 the guard gives,
        // and must leave the ledger exactly as the guard would have.
        const realExists = Settlement.exists;
        Settlement.exists = async () => null;
        try {
            await fc.assert(
                fc.asyncProperty(fixture, async (f) => {
                    const l = await seedLedger(f, w);
                    await assertChangesNothing(
                        { rejection: 'alreadyReversed', malformedId: undefined, reason: undefined },
                        w,
                        l,
                        1
                    );
                }),
                { numRuns: 25 }
            );
        } finally {
            Settlement.exists = realExists;
        }
    }, PROPERTY_TIMEOUT_MS);
});
