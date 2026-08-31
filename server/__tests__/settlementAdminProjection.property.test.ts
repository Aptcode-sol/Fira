/**
 * Feature: per-listing-settlement-tracking, Property 11: The admin ledger
 * projection is complete and ordered.
 *
 * For any listing ledger, the admin read returns one row per stored entry, each
 * carrying `settledAmount`, `settlementReference`, `settledAt`, `method`,
 * `adminNotes`, the recording administrator's display name, and its reversal
 * linkage, ordered by `settledAt` descending.
 *
 * Under test: `settlementService.getListingSettlement({ kind, listingId })` and
 * the pure `toAdminRow` projection it maps every row through, against a real
 * (in-memory) Mongo. The stored rows are what "one row per stored entry" is
 * measured against, and the `settledAt: -1` read order is part of the claim, so
 * neither the store nor the sort is stubbed.
 *
 * Ledgers are seeded directly through `Settlement.create` rather than through
 * `recordEntry`, so the generator can reach ledger shapes a sequence of accepted
 * requests cannot: an over-settlement row without walking a super admin through
 * the guard, and a reversal pair without a second round trip. What is under test
 * here is the projection of stored rows, not how they came to be stored.
 *
 * Two clauses need stating precisely:
 *
 *  - "every named field present" is asserted as key presence, not truthiness.
 *    `adminNotes` is legitimately `null` on an entry recorded without notes, and
 *    a projection that dropped the key would be a missing field the panel reads
 *    as `undefined`. So presence is checked with `toHaveProperty` and the value
 *    is compared separately.
 *  - "ordered by `settledAt` descending" is asserted as non-increasing, not
 *    strictly decreasing. A reversal row mirrors its target's `settledAt` — that
 *    is the design's shape, so a ledger with a reversal pair legitimately holds
 *    two rows on the same instant and their relative order is the store's
 *    choice. The multiset of returned dates is additionally held equal to the
 *    stored dates sorted descending, which is the part a broken sort would fail.
 *
 * Validates: Requirements 1.2, 1.3, 7.4
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import mongoose from 'mongoose';
// The in-memory Mongo server and its connection are owned by the shared setup
// file (registered as vitest `setupFiles`). Connecting a second one here throws
// "openUri() on an active connection with different connection strings".
import './setup';

const settlementService = require('../services/settlementService');
const Settlement = require('../models/Settlement');
const AuditLog = require('../models/AuditLog');
const Payment = require('../models/Payment');
// Registered so the payout read inside getListingFigures resolves its model.
require('../models/Payout');

// Every key the property names, plus the two admin-internal flags toAdminRow is
// the only projection allowed to carry — a row missing any of them is an
// incomplete projection whatever its values are (Requirement 1.2).
const REQUIRED_KEYS = [
    '_id',
    'settledAmount',
    'settlementReference',
    'settledAt',
    'method',
    'adminNotes',
    'recordedBy',
    'isOverSettlement',
    'overrideReason',
    'isReversalOf',
    'reversalReason',
    'reversedBy',
] as const;

// --- generators ------------------------------------------------------------

type EntrySpec = {
    /** Distinct across the ledger, so the expected order is unambiguous. */
    dayOffset: number;
    amount: number;
    reference: string;
    /** null is the Requirement 1.2 boundary: an entry recorded without notes. */
    notes: string | null;
    method: 'manual' | 'gateway';
    /** An over-settlement row carries its override reason (Requirement 5.3). */
    over: boolean;
    /** Reversed by an appended Reversal_Entry (Requirements 7.2, 7.4). */
    reversed: boolean;
    /** Which of the two seeded administrators recorded it. */
    recordedByIndex: 0 | 1;
    /** Which one reversed it, when it is reversed. */
    reverserIndex: 0 | 1;
};

const entrySpec: fc.Arbitrary<EntrySpec> = fc.record({
    dayOffset: fc.integer({ min: 0, max: 400 }),
    amount: fc.integer({ min: 1, max: 20000 }),
    reference: fc.string({ minLength: 1, maxLength: 16 }).map((s) => `UTR-${s}`),
    notes: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 30 })),
    method: fc.constantFrom<'manual' | 'gateway'>('manual', 'gateway'),
    over: fc.boolean(),
    reversed: fc.boolean(),
    recordedByIndex: fc.constantFrom<0 | 1>(0, 1),
    reverserIndex: fc.constantFrom<0 | 1>(0, 1),
});

// `minLength: 0` keeps the empty ledger — the Requirement 1.6 boundary — inside
// the domain: it must project to no rows at all rather than to a placeholder.
// Distinct `dayOffset` values give every base entry its own instant, so the
// expected descending order is a fact about the generated ledger rather than a
// tie the store breaks for us.
const ledgerSpec: fc.Arbitrary<{ netPayable: number; entries: EntrySpec[] }> = fc.record({
    netPayable: fc.integer({ min: 1, max: 40000 }),
    entries: fc.uniqueArray(entrySpec, { selector: (e) => e.dayOffset, minLength: 0, maxLength: 6 }),
});

// --- fixtures --------------------------------------------------------------

const NOW = Date.now();
const DAY_MS = 24 * 3600 * 1000;
const ADMIN_NAMES = ['Ada Admin', 'Sam Superadmin'] as const;

async function makeUser(name: string) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('users').insertOne({ _id, name, email: `${_id}@x.test` });
    return _id;
}

async function makeEvent(organizer: mongoose.Types.ObjectId) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection
        .db!.collection('events')
        .insertOne({ _id, name: 'Property 11 Event', organizer, status: 'approved' });
    return _id;
}

/** Net_Payable for the listing is Σ Payout.netAmount — seeded to exactly `netPayable`. */
async function seedMoney(eventId: mongoose.Types.ObjectId, netPayable: number) {
    await Payment.create({
        user: new mongoose.Types.ObjectId(),
        type: 'ticket_purchase',
        referenceId: eventId,
        referenceModel: 'Event',
        amount: netPayable,
        platformFee: 0,
        gstAmount: 0,
        totalAmount: netPayable,
        status: 'success',
        paidAt: new Date(NOW - 500 * DAY_MS),
    });
    await mongoose.connection.db!.collection('payouts').insertOne({
        _id: new mongoose.Types.ObjectId(),
        recipient: new mongoose.Types.ObjectId(),
        type: 'event_tickets',
        referenceId: eventId,
        referenceModel: 'Event',
        grossAmount: netPayable,
        platformCommission: 0,
        netAmount: netPayable,
        status: 'completed',
        createdAt: new Date(NOW - 490 * DAY_MS),
    });
}

async function clearRecords() {
    await Promise.all([
        Settlement.deleteMany({}),
        Payment.deleteMany({}),
        AuditLog.deleteMany({}),
        mongoose.connection.db!.collection('payouts').deleteMany({}),
        mongoose.connection.db!.collection('events').deleteMany({}),
        mongoose.connection.db!.collection('users').deleteMany({}),
    ]);
}

/**
 * Seed one generated ledger. Rows are inserted in generated order rather than in
 * date order, so a projection that happened to return insertion order would not
 * pass the descending-order assertion by luck.
 *
 * A reversal row is shaped exactly as `recordReversal` writes it: the target's
 * reference, the target's date, the negated amount, the linkage and the derived
 * idempotency key.
 */
async function seedLedger(
    eventId: mongoose.Types.ObjectId,
    admins: mongoose.Types.ObjectId[],
    specs: EntrySpec[]
) {
    /** Stored row → the spec it came from, plus its reversal when it has one. */
    const seeded: Array<{ spec: EntrySpec; row: any; reversal: any | null }> = [];

    for (const [index, spec] of specs.entries()) {
        const row = await Settlement.create({
            listingKind: 'event',
            listing: eventId,
            listingModel: 'Event',
            settledAmount: spec.amount,
            settlementReference: spec.reference,
            settledAt: new Date(NOW - spec.dayOffset * DAY_MS),
            method: spec.method,
            adminNotes: spec.notes,
            isOverSettlement: spec.over,
            overrideReason: spec.over ? `override-${index}` : null,
            recordedBy: admins[spec.recordedByIndex],
            idempotencyKey: `key-${index}`,
        });

        let reversal = null;
        if (spec.reversed) {
            reversal = await Settlement.create({
                listingKind: 'event',
                listing: eventId,
                listingModel: 'Event',
                settledAmount: -spec.amount,
                settlementReference: spec.reference,
                settledAt: row.settledAt,
                method: spec.method,
                isReversalOf: row._id,
                reversalReason: `reversal-${index}`,
                recordedBy: admins[spec.reverserIndex],
                idempotencyKey: `reversal:${String(row._id)}`,
            });
        }

        seeded.push({ spec, row: row.toObject(), reversal: reversal ? reversal.toObject() : null });
    }

    return seeded;
}

// 100 runs, each seeding up to a dozen rows and reading them back through the
// real store, comfortably outrun vitest's 5s default — and a timed-out run keeps
// clearing records in the background, wiping the next test's fixtures. So the
// test carries an explicit timeout.
const PROPERTY_TIMEOUT_MS = 180000;

describe('Property 11 — the admin ledger projection is complete and ordered', () => {
    beforeAll(async () => {
        // The unique (listingKind, listing, idempotencyKey) index and the
        // (listingKind, listing, settledAt: -1) read index must exist for the read
        // to behave the way it does in production.
        await Settlement.init();
    });

    it('returns one complete row per stored entry, newest first', async () => {
        await fc.assert(
            fc.asyncProperty(ledgerSpec, async ({ netPayable, entries: specs }) => {
                // At the start, not only at the end: a run that fails mid-assertion
                // must not leave rows behind for the shrinking runs that follow.
                await clearRecords();

                const organizer = await makeUser('Olive Organizer');
                const admins = [await makeUser(ADMIN_NAMES[0]), await makeUser(ADMIN_NAMES[1])];
                const eventId = await makeEvent(organizer);
                await seedMoney(eventId, netPayable);

                const seeded = await seedLedger(eventId, admins, specs);

                const dto = await settlementService.getListingSettlement({
                    kind: 'event',
                    listingId: String(eventId),
                });

                const stored = await Settlement.find({ listing: eventId }).lean();

                // --- one row per stored entry, reversal rows included (Req 1.2) ---
                expect(dto.entries).toHaveLength(stored.length);
                expect([...dto.entries].map((e: any) => e._id).sort()).toEqual(
                    stored.map((r: any) => String(r._id)).sort()
                );

                const projectedById = new Map(dto.entries.map((e: any) => [e._id, e]));

                for (const row of stored) {
                    const projected = projectedById.get(String(row._id));

                    // --- every named field present, presence not truthiness (Req 1.2) ---
                    for (const key of REQUIRED_KEYS) {
                        expect(projected).toHaveProperty(key);
                    }

                    // --- and carrying the stored value ---
                    expect(projected.settledAmount).toBe(row.settledAmount);
                    expect(projected.settlementReference).toBe(row.settlementReference);
                    expect(new Date(projected.settledAt).getTime()).toBe(row.settledAt.getTime());
                    expect(projected.method).toBe(row.method);
                    expect(projected.adminNotes).toBe(row.adminNotes ?? null);
                    expect(projected.isOverSettlement).toBe(row.isOverSettlement);
                    expect(projected.overrideReason).toBe(row.overrideReason ?? null);

                    // --- the recording administrator's display name resolves (Req 1.2) ---
                    expect(projected.recordedBy._id).toBe(String(row.recordedBy));
                    expect(ADMIN_NAMES).toContain(projected.recordedBy.name);
                    expect(
                        projected.recordedBy.name === ADMIN_NAMES[admins.findIndex((a) => String(a) === String(row.recordedBy))]
                    ).toBe(true);
                }

                // --- the reversal linkage, populated exactly for reversed entries (Req 7.4) ---
                for (const { row, reversal } of seeded) {
                    const projected = projectedById.get(String(row._id));

                    if (reversal) {
                        expect(projected.reversedBy).not.toBeNull();
                        expect(projected.reversedBy._id).toBe(String(reversal._id));
                        expect(projected.reversedBy.reason).toBe(reversal.reversalReason);
                        expect(projected.reversedBy.recordedBy.name).toBe(
                            ADMIN_NAMES[admins.findIndex((a) => String(a) === String(reversal.recordedBy))]
                        );
                        expect(projected.reversedBy.createdAt).not.toBeNull();

                        // The reversal row itself is not reversed by anything, and it
                        // names its target rather than the other way round.
                        const projectedReversal = projectedById.get(String(reversal._id));
                        expect(projectedReversal.reversedBy).toBeNull();
                        expect(projectedReversal.isReversalOf).toBe(String(row._id));
                        expect(projectedReversal.reversalReason).toBe(reversal.reversalReason);
                    } else {
                        expect(projected.reversedBy).toBeNull();
                        expect(projected.isReversalOf).toBeNull();
                    }
                }

                // --- ordered by settledAt descending (Req 1.3) ---
                const dates = dto.entries.map((e: any) => new Date(e.settledAt).getTime());
                for (let i = 1; i < dates.length; i += 1) {
                    // Non-increasing: a reversal row mirrors its target's date, so a
                    // pair legitimately sits on the same instant.
                    expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
                }
                // The part a broken sort fails: the same dates the store holds, in
                // descending order.
                expect(dates).toEqual(stored.map((r: any) => r.settledAt.getTime()).sort((a, b) => b - a));

                await clearRecords();
            }),
            { numRuns: 25 }
        );
    }, PROPERTY_TIMEOUT_MS);
});
