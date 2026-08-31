/**
 * Feature: per-listing-settlement-tracking, Property 10: Money figures are
 * reproduced verbatim from Earnings_Service.
 *
 * For any set of figures Earnings_Service returns for a listing, every money
 * figure the Settlement_Service reports other than Settled_To_Date,
 * Outstanding_Amount and the excess equals the Earnings_Service value exactly,
 * with no arithmetic re-derivation; and when Earnings_Service cannot produce
 * figures for a listing, the service returns an error naming that listing,
 * reports no money figures, and rejects any settlement recording request for it.
 *
 * Under test: `settlementService.getListingSettlement`, `getOwnerSettlement`
 * and `recordEntry`.
 *
 * `earningsService.getListingFigures` is stubbed with generated figure sets —
 * that stub is what makes "verbatim" checkable at all: the generated values are
 * independent of one another (netPayable is not ownerGross − platformCommission,
 * grossCollected is not the sum of the buyer-side parts), so a service that
 * re-derived any figure instead of passing it through cannot agree by accident.
 * Fractional values are generated on purpose: a rounding pass over a
 * pass-through figure is itself a re-derivation.
 *
 * Validates: Requirements 2.1, 2.4, 12.1, 12.5
 */
import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import mongoose from 'mongoose';
// The in-memory Mongo server and its connection belong to the shared setup file
// (registered as vitest `setupFiles`). Creating a second MongoMemoryServer here
// throws "openUri() on an active connection with different connection strings".
import './setup';

const settlementService = require('../services/settlementService');
const earningsService = require('../services/earningsService');
const Settlement = require('../models/Settlement');
const AuditLog = require('../models/AuditLog');

// Every money figure the money path owns. None of these may be recomputed
// anywhere in settlementService (Requirements 2.4, 12.1).
const VERBATIM_MONEY_KEYS = [
    'grossCollected',
    'platformFeeCollected',
    'gstRetained',
    'ownerGross',
    'platformCommission',
    'netPayable',
    'refundedTotal',
] as const;

// The only three figures the settlement service is allowed to derive.
const DERIVED_MONEY_KEYS = ['settledToDate', 'outstandingAmount', 'excessAmount'] as const;

// The owner surface carries the owner-side figures only; the buyer-side
// breakdown is the platform's own accounting.
const OWNER_VERBATIM_MONEY_KEYS = ['ownerGross', 'platformCommission', 'netPayable', 'refundedTotal'] as const;

// --- generators ------------------------------------------------------------

// Fractional and zero amounts both in range: zero is the "no payout raised yet"
// boundary, and a fraction catches a rounding pass applied to a pass-through.
const amount = fc.double({ min: 0, max: 5_000_000, noNaN: true });

const moneyFigures = fc.record({
    grossCollected: amount,
    platformFeeCollected: amount,
    gstRetained: amount,
    ownerGross: amount,
    platformCommission: amount,
    netPayable: amount,
    refundedTotal: amount,
});

const activityFigures = fc.record({
    successfulPayments: fc.integer({ min: 0, max: 500 }),
    unitsSold: fc.integer({ min: 0, max: 5000 }),
    confirmed: fc.integer({ min: 0, max: 5000 }),
    cancelled: fc.integer({ min: 0, max: 5000 }),
    refundedPayments: fc.integer({ min: 0, max: 500 }),
    lastPaymentAt: fc.option(fc.date({ min: new Date('2020-01-01T00:00:00.000Z'), max: new Date('2024-01-01T00:00:00.000Z') }), { nil: null }),
});

const payoutSummary = fc.option(
    fc.record({
        payoutId: fc.uuid(),
        status: fc.constantFrom('pending', 'processing', 'completed', 'failed'),
        netAmount: amount,
    }),
    { nil: null },
);

const figureSets = fc.record({ money: moneyFigures, activity: activityFigures, payout: payoutSummary });

// The stored ledger the service folds alongside the figures. minLength 0 — the
// empty ledger is part of the domain.
const ledgerRows = fc.array(fc.integer({ min: 1, max: 200_000 }), { minLength: 0, maxLength: 4 });

// --- fixtures --------------------------------------------------------------

// Raw inserts: the figures are stubbed, so the full Event/User required fields
// would be fixture noise. resolveListing reads `name` + the owner field, and
// resolveRecipient only asks whether the user row exists.
async function makeUser(name: string) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('users').insertOne({ _id, name, email: `${_id}@x.test` });
    return _id;
}

async function makeEvent(organizer: mongoose.Types.ObjectId) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('events').insertOne({ _id, name: 'Generated Event', organizer });
    return _id;
}

async function seedLedger(listing: mongoose.Types.ObjectId, recordedBy: mongoose.Types.ObjectId, amounts: number[]) {
    for (const [index, settledAmount] of amounts.entries()) {
        await Settlement.create({
            listingKind: 'event',
            listing,
            listingModel: 'Event',
            settledAmount,
            settlementReference: `UTR-${index}`,
            settledAt: new Date(Date.UTC(2024, 4, index + 1)),
            recordedBy,
            idempotencyKey: `key-${index}`,
        });
    }
}

async function clearRecords() {
    await Promise.all([
        Settlement.deleteMany({}),
        AuditLog.deleteMany({}),
        mongoose.connection.db!.collection('events').deleteMany({}),
        mongoose.connection.db!.collection('users').deleteMany({}),
    ]);
}

// 100 property runs, each doing several real DB round-trips, outrun vitest's 5s
// default when the whole suite runs in parallel.
const PROPERTY_TIMEOUT_MS = 60000;

const original = earningsService.getListingFigures;
afterEach(() => {
    earningsService.getListingFigures = original;
});

describe('Property 10 — money figures are reproduced verbatim from Earnings_Service', () => {
    it('reports every non-derived money figure, the activity and the payout exactly as the money path returned them', async () => {
        await fc.assert(
            fc.asyncProperty(figureSets, ledgerRows, async (figures: any, amounts: number[]) => {
                const organizer = await makeUser('Olive Organizer');
                const admin = await makeUser('Ada Admin');
                const eventId = await makeEvent(organizer);
                await seedLedger(eventId, admin, amounts);

                earningsService.getListingFigures = async () => figures;

                try {
                    const adminDto = await settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) });
                    const ownerDto = await settlementService.getOwnerSettlement({
                        kind: 'event',
                        listingId: String(eventId),
                        requesterId: String(organizer),
                    });

                    // Verbatim, and by identity: `toBe` on a generated double
                    // fails on any rounding, scaling or re-derivation.
                    for (const key of VERBATIM_MONEY_KEYS) {
                        expect(adminDto.money[key]).toBe(figures.money[key]);
                    }
                    for (const key of OWNER_VERBATIM_MONEY_KEYS) {
                        expect(ownerDto.money[key]).toBe(figures.money[key]);
                    }

                    // Exactly the money path's figures plus the three derived
                    // ones — no fourth figure invented here.
                    expect(new Set(Object.keys(adminDto.money))).toEqual(
                        new Set([...VERBATIM_MONEY_KEYS, ...DERIVED_MONEY_KEYS]),
                    );

                    // Activity and the payout summary pass through untouched too
                    // (Requirements 2.1, 3.1).
                    expect(adminDto.activity).toEqual(figures.activity);
                    expect(ownerDto.activity).toEqual(figures.activity);
                    expect(adminDto.payout).toEqual(figures.payout);
                } finally {
                    earningsService.getListingFigures = original;
                    await clearRecords();
                }
            }),
            { numRuns: 25 },
        );
    }, PROPERTY_TIMEOUT_MS);

    it('rejects every read and every recording request with a 502 naming the listing and carrying no money figures when the money path cannot produce them', async () => {
        await fc.assert(
            fc.asyncProperty(ledgerRows, fc.integer({ min: 1, max: 50_000 }), async (amounts: number[], settledAmount: number) => {
                const organizer = await makeUser('Olive Organizer');
                const admin = await makeUser('Ada Admin');
                const eventId = await makeEvent(organizer);
                await seedLedger(eventId, admin, amounts);
                const before = await Settlement.countDocuments({ listing: eventId });

                earningsService.getListingFigures = async () => {
                    throw new Error('aggregation exploded');
                };

                try {
                    const attempts = [
                        () => settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) }),
                        () => settlementService.getOwnerSettlement({ kind: 'event', listingId: String(eventId), requesterId: String(organizer) }),
                        // A request that is valid in every other respect, so it
                        // reaches the money path and is refused by it alone
                        // (Requirement 12.5).
                        () => settlementService.recordEntry({
                            kind: 'event',
                            listingId: String(eventId),
                            input: {
                                settledAmount,
                                settlementReference: 'UTR-NEW',
                                settledAt: new Date('2024-05-20T00:00:00.000Z'),
                                idempotencyKey: `fresh-${Math.random()}`,
                            },
                            admin: { _id: admin, name: 'Ada Admin', adminRole: 'super_admin' },
                        }),
                    ];

                    for (const attempt of attempts) {
                        const err = await attempt().then(() => null, (e: any) => e);
                        expect(err).toBeInstanceOf(Error);
                        expect(err.status).toBe(502);
                        expect(err.message).toBe(`Earnings figures unavailable for listing ${String(eventId)}`);
                        // Nothing money-shaped rides on the rejection, so no
                        // surface can render a figure from it.
                        for (const key of [...VERBATIM_MONEY_KEYS, ...DERIVED_MONEY_KEYS, 'money', 'ledger', 'state']) {
                            expect(err).not.toHaveProperty(key);
                        }
                    }

                    // The refused recording wrote neither an entry nor an audit row.
                    expect(await Settlement.countDocuments({ listing: eventId })).toBe(before);
                    expect(await AuditLog.countDocuments({})).toBe(0);
                } finally {
                    earningsService.getListingFigures = original;
                    await clearRecords();
                }
            }),
            { numRuns: 25 },
        );
    }, PROPERTY_TIMEOUT_MS);
});
