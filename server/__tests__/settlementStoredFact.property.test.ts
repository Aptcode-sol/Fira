/**
 * Feature: per-listing-settlement-tracking, Property 4: A recorded settlement is
 * an untouched whole-rupee fact.
 *
 * For any accepted settlement recording request, reading the ledger back yields
 * exactly one new entry whose `settledAmount` is the whole-rupee value
 * submitted, whose `settlementReference`, `settledAt`, `method` (defaulting to
 * `manual` when absent) and `adminNotes` match the submission, and whose
 * `recordedBy` is the submitting administrator — and that stored amount is never
 * adjusted toward Net_Payable by any later read or write.
 *
 * Under test: `settlementService.recordEntry({ kind, listingId, input, admin })`
 * against a real (in-memory) Mongo. Nothing is stubbed: the stored row IS what
 * is under test, so a stubbed store would test nothing.
 *
 * The "never adjusted" clause is what makes this more than a round-trip check.
 * Each run snapshots the whole stored row (every field, `createdAt`/`updatedAt`
 * included) immediately after the insert, then exercises the two things that
 * could plausibly nudge it toward Net_Payable — a later read
 * (`getListingSettlement`, which folds the ledger against Net_Payable) and a
 * later write (a second accepted entry, or a rejected over-settlement when the
 * listing is already settled to the rupee) — and asserts the snapshot still
 * matches byte for byte.
 *
 * Validates: Requirements 4.1, 4.4, 4.5, 4.6, 12.4
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
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
// Registered so the payout read inside getListingFigures resolves its model.
require('../models/Payout');

// --- generators ------------------------------------------------------------

type Scenario = {
    netPayable: number;
    first: number;
    second: number;
    method: 'manual' | 'gateway' | undefined;
    adminNotes: string | undefined;
    reference: string;
    daysAgo: number;
};

// `netPayable` is whole rupees, so is every generated amount: Requirement 4.6 is
// about what the store holds, and a fractional amount is a validation rejection
// (Property 7's territory), not an accepted request.
//
// `first` spans 1..netPayable, so settling a listing to the exact rupee — the
// boundary Requirement 5.7 accepts without an override — is inside the domain.
// `second` spans 0..remaining, so runs split between "a later accepted write"
// and "a later rejected write" (see the rejected branch below).
const scenario: fc.Arbitrary<Scenario> = fc
    .integer({ min: 2, max: 20000 })
    .chain((netPayable) =>
        fc.integer({ min: 1, max: netPayable }).chain((first) =>
            fc.record({
                netPayable: fc.constant(netPayable),
                first: fc.constant(first),
                second: fc.integer({ min: 0, max: netPayable - first }),
                // `undefined` is the Requirement 4.5 boundary: absent method → `manual`.
                method: fc.constantFrom<'manual' | 'gateway' | undefined>(undefined, 'manual', 'gateway'),
                // `undefined` and whitespace-only both mean "no notes" (stored as null);
                // anything else must come back verbatim (Requirement 4.4).
                adminNotes: fc.oneof(
                    fc.constant(undefined),
                    fc.constant('   '),
                    fc.string({ minLength: 1, maxLength: 40 })
                ),
                reference: fc.string({ minLength: 1, maxLength: 20 }).map((s) => `UTR-${s}`),
                daysAgo: fc.integer({ min: 0, max: 400 }),
            })
        )
    );

// --- fixtures --------------------------------------------------------------

const NOW = Date.now();

async function makeUser(name: string) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('users').insertOne({ _id, name, email: `${_id}@x.test` });
    return _id;
}

async function makeEvent(organizer: mongoose.Types.ObjectId) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection
        .db!.collection('events')
        .insertOne({ _id, name: 'Property 4 Event', organizer, status: 'approved' });
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
        paidAt: new Date(NOW - 10 * 24 * 3600 * 1000),
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
        createdAt: new Date(NOW - 5 * 24 * 3600 * 1000),
    });
}

async function clearRecords() {
    await Promise.all([
        Settlement.deleteMany({}),
        Payment.deleteMany({}),
        AuditLog.deleteMany({}),
        Notification.deleteMany({}),
        mongoose.connection.db!.collection('payouts').deleteMany({}),
        mongoose.connection.db!.collection('events').deleteMany({}),
        mongoose.connection.db!.collection('users').deleteMany({}),
    ]);
}

// 100 runs, each doing a dozen real DB round-trips, comfortably outrun vitest's
// 5s default — and a timed-out run keeps clearing records in the background,
// wiping the next test's fixtures. So the test carries an explicit timeout.
const PROPERTY_TIMEOUT_MS = 180000;

describe('Property 4 — a recorded settlement is an untouched whole-rupee fact', () => {
    beforeAll(async () => {
        // The unique (listingKind, listing, idempotencyKey) index must exist for a
        // second write to behave the way it does in production.
        await Settlement.init();
    });

    it('stores the submission verbatim and no later read or write moves it toward Net_Payable', async () => {
        await fc.assert(
            fc.asyncProperty(scenario, async (s: Scenario) => {
                const organizer = await makeUser('Olive Organizer');
                const adminId = await makeUser('Ada Admin');
                const admin = { _id: adminId, name: 'Ada Admin', adminRole: 'admin' };
                const eventId = await makeEvent(organizer);
                await seedMoney(eventId, s.netPayable);

                const settledAt = new Date(NOW - s.daysAgo * 24 * 3600 * 1000);
                const input: Record<string, any> = {
                    settledAmount: s.first,
                    settlementReference: s.reference,
                    settledAt,
                    idempotencyKey: 'key-first',
                };
                if (s.method !== undefined) input.method = s.method;
                if (s.adminNotes !== undefined) input.adminNotes = s.adminNotes;

                const before = await Settlement.countDocuments({ listing: eventId });
                const result = await settlementService.recordEntry({
                    kind: 'event',
                    listingId: String(eventId),
                    input,
                    admin,
                });

                // Exactly one new entry for the accepted request.
                const rows = await Settlement.find({ listing: eventId }).lean();
                expect(rows).toHaveLength(before + 1);
                const stored = rows[0];

                // The recorded fact, field by field (Requirements 4.1, 4.4, 4.5, 4.6).
                const expectedNotes =
                    typeof s.adminNotes === 'string' && s.adminNotes.trim().length > 0 ? s.adminNotes : null;
                expect(stored.settledAmount).toBe(s.first);
                expect(Number.isInteger(stored.settledAmount)).toBe(true);
                expect(stored.settlementReference).toBe(s.reference);
                expect(stored.settledAt.getTime()).toBe(settledAt.getTime());
                expect(stored.method).toBe(s.method ?? 'manual');
                expect(stored.adminNotes).toBe(expectedNotes);
                expect(String(stored.recordedBy)).toBe(String(adminId));
                expect(result.entry.settledAmount).toBe(s.first);

                // The whole row as recorded — the baseline every later step is held to.
                const snapshot = JSON.parse(JSON.stringify(stored));
                const readBackRow = async () =>
                    JSON.parse(JSON.stringify(await Settlement.findById(stored._id).lean()));

                // A later read folds the ledger against Net_Payable; the row must not move.
                const read = await settlementService.getListingSettlement({
                    kind: 'event',
                    listingId: String(eventId),
                });
                const projected = read.entries.find((e: any) => e._id === String(stored._id));
                expect(projected.settledAmount).toBe(s.first);
                expect(await readBackRow()).toEqual(snapshot);

                // A later write. Half the runs record a second accepted entry; the
                // other half attempt one rupee more than the listing can take, which
                // is rejected — equally a later write that must leave the stored fact
                // alone (Requirement 4.11 territory, asserted here as "untouched").
                if (s.second > 0) {
                    await settlementService.recordEntry({
                        kind: 'event',
                        listingId: String(eventId),
                        input: {
                            settledAmount: s.second,
                            settlementReference: `${s.reference}-2`,
                            settledAt,
                            idempotencyKey: 'key-second',
                        },
                        admin,
                    });
                } else {
                    const rejected = await settlementService
                        .recordEntry({
                            kind: 'event',
                            listingId: String(eventId),
                            input: {
                                // One rupee past what is left: always an over-settlement.
                                settledAmount: s.netPayable - s.first + 1,
                                settlementReference: `${s.reference}-2`,
                                settledAt,
                                idempotencyKey: 'key-second',
                            },
                            admin,
                        })
                        .then(() => null, (e: any) => e);
                    expect(rejected.code).toBe('over_settlement');
                }

                expect(await readBackRow()).toEqual(snapshot);
                // And once more through the read path, after the write.
                const after = await settlementService.getListingSettlement({
                    kind: 'event',
                    listingId: String(eventId),
                });
                expect(after.entries.find((e: any) => e._id === String(stored._id)).settledAmount).toBe(s.first);

                await clearRecords();
            }),
            { numRuns: 25 }
        );
    }, PROPERTY_TIMEOUT_MS);
});
