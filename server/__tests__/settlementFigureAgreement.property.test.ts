/**
 * Feature: per-listing-settlement-tracking, Property 13: Admin and owner agree
 * on every shared figure.
 *
 * For any listing, every money figure present in both the admin and the owner
 * response holds the same value, and the owner response carries the owner-side
 * figures and all six activity counts.
 *
 * Under test:
 *   settlementService.getListingSettlement({ kind, listingId })
 *   settlementService.getOwnerSettlement({ kind, listingId, requesterId })
 *
 * Real records in a real (in-memory) Mongo, no stubs: the two reads agreeing is
 * a claim about the same fold reaching two projections, so replacing the store
 * or the money path with a stub would test the stub instead.
 *
 * The one deliberate asymmetry the design records is asserted rather than
 * treated as a mismatch: the admin `entries` carries one row per stored entry,
 * while the owner `entries` carries the effective entries only — the negative
 * reversal rows are filtered out and the reversed original is flagged
 * `reversed: true`.
 *
 * Validates: Requirements 9.1, 9.2, 9.9
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import mongoose from 'mongoose';
// The in-memory Mongo server and its connection are owned by the shared setup
// file. Creating a second MongoMemoryServer here throws "openUri() on an active
// connection with different connection strings".
import './setup';

const settlementService = require('../services/settlementService');

const { ObjectId } = mongoose.Types;

// The owner-side money figures named in Requirement 9.1 — exactly what the owner
// response must carry, and nothing else.
const OWNER_MONEY_KEYS = [
    'ownerGross',
    'platformCommission',
    'netPayable',
    'settledToDate',
    'outstandingAmount',
    'refundedTotal',
];

// The six activity counts of Requirement 3 criterion 1, carried through to the
// owner response by Requirement 9.1.
const ACTIVITY_KEYS = [
    'successfulPayments',
    'unitsSold',
    'confirmed',
    'cancelled',
    'refundedPayments',
    'lastPaymentAt',
];

const TICKET_STATUSES = ['active', 'used', 'cancelled', 'expired'];
const BOOKING_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];

// --- generators ------------------------------------------------------------

type EntrySpec = { amount: number; reverse: boolean };
type PaymentSpec = { status: string; totalAmount: number; platformFee: number; gstAmount: number; daysAgo: number };
type UnitSpec = { statusIndex: number; quantity: number };
type PayoutSpec = { grossAmount: number; platformCommission: number; netAmount: number; status: string } | null;

type ListingSpec = {
    kind: 'event' | 'venue';
    entries: EntrySpec[];
    payments: PaymentSpec[];
    units: UnitSpec[];
    payout: PayoutSpec;
};

// maxLength with no minLength: the empty ledger, the listing with no payments
// and the listing with no units are all inside the generated domain.
const entrySpec = fc.record({
    amount: fc.integer({ min: 1, max: 10000 }),
    reverse: fc.boolean(),
});

const paymentSpec = fc.record({
    status: fc.constantFrom('success', 'refunded', 'pending'),
    totalAmount: fc.integer({ min: 100, max: 9000 }),
    platformFee: fc.integer({ min: 0, max: 500 }),
    gstAmount: fc.integer({ min: 0, max: 900 }),
    daysAgo: fc.integer({ min: 1, max: 300 }),
});

const unitSpec = fc.record({
    statusIndex: fc.nat({ max: 4 }),
    quantity: fc.integer({ min: 1, max: 3 }),
});

// netAmount spans both sides of the generated settlement totals, so the runs
// cover not_settled, partially_settled, fully_settled and over_settled. `null`
// is the "payments but no payout raised" boundary: netPayable 0, payout null.
const payoutSpec = fc.option(
    fc.record({
        grossAmount: fc.integer({ min: 0, max: 25000 }),
        platformCommission: fc.integer({ min: 0, max: 3000 }),
        netAmount: fc.integer({ min: 0, max: 25000 }),
        status: fc.constantFrom('pending', 'processing', 'completed', 'failed'),
    }),
    { nil: null }
);

const listingSpec: fc.Arbitrary<ListingSpec> = fc.record({
    kind: fc.constantFrom<'event' | 'venue'>('event', 'venue'),
    entries: fc.array(entrySpec, { maxLength: 4 }),
    payments: fc.array(paymentSpec, { maxLength: 3 }),
    units: fc.array(unitSpec, { maxLength: 3 }),
    payout: payoutSpec,
});

// --- fixtures --------------------------------------------------------------

const NOW = Date.now();
const DAY = 24 * 3600 * 1000;

/**
 * Raw collection inserts: the reads under test query by listing scope only, so
 * the full Event/Venue/Payment required-field sets would be fixture noise. Every
 * run uses fresh ids, so runs never see each other's records and no per-run
 * cleanup is needed.
 */
async function seed(spec: ListingSpec, ownerId: any, adminId: any) {
    const db = mongoose.connection.db!;
    const listingId = new ObjectId();

    let referenceModel: 'Event' | 'Booking';
    let referenceIds: any[];

    if (spec.kind === 'event') {
        await db.collection('events').insertOne({ _id: listingId, name: 'Generated Event', organizer: ownerId });
        referenceModel = 'Event';
        referenceIds = [listingId];
        if (spec.units.length) {
            await db.collection('tickets').insertMany(
                spec.units.map((u, i) => ({
                    _id: new ObjectId(),
                    ticketId: `T_${listingId}_${i}`,
                    user: ownerId,
                    event: listingId,
                    quantity: u.quantity,
                    status: TICKET_STATUSES[u.statusIndex % TICKET_STATUSES.length],
                }))
            );
        }
    } else {
        await db.collection('venues').insertOne({ _id: listingId, name: 'Generated Venue', owner: ownerId });
        referenceModel = 'Booking';
        const bookings = spec.units.map((u) => ({
            _id: new ObjectId(),
            user: ownerId,
            venue: listingId,
            status: BOOKING_STATUSES[u.statusIndex % BOOKING_STATUSES.length],
            totalAmount: 5000,
        }));
        if (bookings.length) await db.collection('bookings').insertMany(bookings);
        // A venue with no booking has no reference to hang a payment on — the
        // service's own short-circuit, and a boundary both surfaces must agree on.
        referenceIds = bookings.map((b) => b._id);
    }

    if (spec.payments.length && referenceIds.length) {
        await db.collection('payments').insertMany(
            spec.payments.map((p, i) => ({
                _id: new ObjectId(),
                user: ownerId,
                type: referenceModel === 'Event' ? 'ticket_purchase' : 'venue_booking',
                referenceId: referenceIds[i % referenceIds.length],
                referenceModel,
                amount: p.totalAmount,
                totalAmount: p.totalAmount,
                platformFee: p.platformFee,
                gstAmount: p.gstAmount,
                status: p.status,
                paidAt: new Date(NOW - p.daysAgo * DAY),
            }))
        );
    }

    if (spec.payout && referenceIds.length) {
        await db.collection('payouts').insertOne({
            _id: new ObjectId(),
            recipient: ownerId,
            type: referenceModel === 'Event' ? 'event_tickets' : 'venue_booking',
            referenceId: referenceIds[0],
            referenceModel,
            grossAmount: spec.payout.grossAmount,
            platformCommission: spec.payout.platformCommission,
            netAmount: spec.payout.netAmount,
            status: spec.payout.status,
            createdAt: new Date(NOW - DAY),
        });
    }

    // Distinct settledAt per entry so the newest-first read order is total; a
    // reversal row carries its target's reference and date, as recordReversal does.
    const rows: any[] = [];
    spec.entries.forEach((e, i) => {
        const _id = new ObjectId();
        const settledAt = new Date(NOW - (spec.entries.length - i) * DAY);
        rows.push({
            _id,
            listingKind: spec.kind,
            listing: listingId,
            listingModel: spec.kind === 'event' ? 'Event' : 'Venue',
            recipient: ownerId,
            settledAmount: e.amount,
            settlementReference: `UTR-${i}`,
            settledAt,
            method: 'manual',
            adminNotes: `note-${i}`,
            recordedBy: adminId,
            idempotencyKey: `key-${listingId}-${i}`,
            createdAt: settledAt,
        });
        if (e.reverse) {
            rows.push({
                _id: new ObjectId(),
                listingKind: spec.kind,
                listing: listingId,
                listingModel: spec.kind === 'event' ? 'Event' : 'Venue',
                recipient: ownerId,
                settledAmount: -e.amount,
                settlementReference: `UTR-${i}`,
                settledAt,
                method: 'manual',
                recordedBy: adminId,
                isReversalOf: _id,
                reversalReason: `wrong account ${i}`,
                idempotencyKey: `reversal:${_id}`,
                createdAt: settledAt,
            });
        }
    });
    if (rows.length) await mongoose.connection.db!.collection('settlements').insertMany(rows);

    return { listingId: String(listingId), storedRows: rows.length };
}

/** The owner row shape, as a comparable key, so the two sides compare as multisets. */
const ownerRowKey = (row: any) =>
    [row.settledAmount, row.settlementReference, new Date(row.settledAt).getTime(), row.reversed].join('|');

// 100 runs, each doing a dozen real DB round-trips plus two full service reads,
// comfortably outrun vitest's 5s default.
const PROPERTY_TIMEOUT_MS = 180000;

describe('Property 13 — admin and owner agree on every shared figure', () => {
    it('holds for generated ledgers, reversal pairs, empty ledgers and generated money figures', async () => {
        const db = mongoose.connection.db!;
        const ownerId = new ObjectId();
        const adminId = new ObjectId();
        await db.collection('users').insertMany([
            { _id: ownerId, name: 'Olive Owner', email: `${ownerId}@x.test` },
            { _id: adminId, name: 'Ada Admin', email: `${adminId}@x.test` },
        ]);

        await fc.assert(
            fc.asyncProperty(listingSpec, async (spec) => {
                const { listingId, storedRows } = await seed(spec, ownerId, adminId);

                const adminDto = await settlementService.getListingSettlement({ kind: spec.kind, listingId });
                const ownerDto = await settlementService.getOwnerSettlement({
                    kind: spec.kind,
                    listingId,
                    requesterId: String(ownerId),
                });

                // Requirement 9.9 — every figure present in both holds the same value.
                const shared = Object.keys(ownerDto.money).filter((key) =>
                    Object.prototype.hasOwnProperty.call(adminDto.money, key)
                );
                for (const key of shared) {
                    expect(ownerDto.money[key]).toBe(adminDto.money[key]);
                }

                // Requirement 9.1 — the owner-side figures, and only those.
                expect(Object.keys(ownerDto.money).sort()).toEqual([...OWNER_MONEY_KEYS].sort());
                // Every owner figure is a shared one, so the agreement above is total.
                expect(shared.sort()).toEqual([...OWNER_MONEY_KEYS].sort());

                expect(ownerDto.state).toBe(adminDto.state);
                expect(ownerDto.listing).toEqual(adminDto.listing);

                // Requirement 9.1 — the same activity, carrying all six counts.
                expect(Object.keys(ownerDto.activity).sort()).toEqual([...ACTIVITY_KEYS].sort());
                expect(ownerDto.activity).toEqual(adminDto.activity);

                // The design's deliberate asymmetry (Requirement 9.2): one admin row
                // per stored entry; effective entries only for the owner, with the
                // reversed original flagged.
                const reversals = adminDto.entries.filter((row: any) => row.isReversalOf != null);
                const effective = adminDto.entries.filter((row: any) => row.isReversalOf == null);
                expect(adminDto.entries).toHaveLength(storedRows);
                expect(reversals).toHaveLength(spec.entries.filter((e) => e.reverse).length);
                expect(ownerDto.entries).toHaveLength(effective.length);

                // Each owner row is its admin row projected through the whitelist,
                // reversed exactly when the admin row carries a reversal.
                expect(ownerDto.entries.map(ownerRowKey).sort()).toEqual(
                    effective
                        .map((row: any) => ownerRowKey({ ...row, reversed: row.reversedBy != null }))
                        .sort()
                );
            }),
            { numRuns: 25 }
        );
    }, PROPERTY_TIMEOUT_MS);
});
