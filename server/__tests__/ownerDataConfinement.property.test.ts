/**
 * Feature: per-listing-settlement-tracking, Property 12: No admin-internal data reaches an owner.
 *
 * For any listing ledger, no owner-facing settlement response and no
 * Settlement_Notification payload contains `adminNotes`, an override reason, the
 * recording administrator's identity (name or id), or Recipient_Party bank
 * details, at any depth.
 *
 * Validates: Requirements 9.3, 10.3
 *
 * The property has two halves, one per surface a settlement fact reaches an
 * owner through, and both are exercised over generated ledgers:
 *
 *  A. The HTTP owner response — `GET /events/:id/settlement` and
 *     `GET /venues/:id/settlement` through the real routers, in-memory Mongo, no
 *     mocked service. A ledger is seeded directly with sentinel `adminNotes`, a
 *     sentinel override reason, a sentinel reversal reason, the recording admin's
 *     sentinel name and real ObjectId, and sentinel bank details on the
 *     recipient User. The serialized response body is then searched for every
 *     sentinel at any depth. `toOwnerRow` is a whitelist, so this is the
 *     regression wall: a field added to the schema (or to the projection) that
 *     started copying the row wholesale would surface one of these sentinels.
 *
 *  B. The Settlement_Notification payload — produced by `recordEntry` and
 *     `recordReversal`. The listing has no `Payout` (Net_Payable ₹0), so a
 *     positive amount is an over-settlement that a `super_admin` records with a
 *     sentinel override reason and sentinel notes; the entry is then reversed
 *     with a sentinel reason. Both stored Notification documents are read back
 *     out of the store and searched for every sentinel and the admin id — the
 *     message legitimately carries the amount, date and reference, none of which
 *     are admin-internal, but nothing else may leak.
 *
 * Deep search: every string value at any depth is collected (ObjectIds rendered
 * by hex, Dates by ISO) into one blob and each forbidden sentinel is a substring
 * search against it, so a leak nested under any key at any depth is caught. The
 * sentinels are distinct random-tagged strings per run, so a hit is proof of a
 * leak and never a coincidence with normal content.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
// The in-memory Mongo server and its connection are owned by the shared setup
// file — do NOT spin up a second MongoMemoryServer here.
import './setup';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
delete process.env.REDIS_HOST; // skip the Redis blocklist path in auth

const eventRoutes = require('../routes/event');
const venueRoutes = require('../routes/venue');
const settlementService = require('../services/settlementService');
const Settlement = require('../models/Settlement');
const Notification = require('../models/Notification');
const User = require('../models/User');
// Registered so the reads inside getListingFigures resolve their models.
require('../models/Payment');
require('../models/Payout');

const { ObjectId } = mongoose.Types;

const app = express();
app.use(express.json());
app.use('/api/events', eventRoutes);
app.use('/api/venues', venueRoutes);

const tokenFor = (id: any) => jwt.sign({ userId: String(id) }, process.env.JWT_SECRET as string);

// 100 runs of a real HTTP round trip / a real record+reverse against a real
// in-memory Mongo comfortably outrun vitest's 5s default.
const PROPERTY_TIMEOUT_MS = 300000;

// --- generators ------------------------------------------------------------

// A per-run tag with no separators, so the sentinels built from it are single
// distinctive tokens (fast-check v4 dropped `hexaString`; a uuid is just as good).
const tag = fc.uuid().map((u) => u.replace(/-/g, ''));

/** One run's inputs: the listing kind, a unique tag the sentinels are built from, and an amount. */
const runInput = fc.record({
    kind: fc.constantFrom<'event' | 'venue'>('event', 'venue'),
    tag,
    amount: fc.integer({ min: 1, max: 500000 }),
});

/**
 * The admin-internal values that must never reach an owner, built from a
 * per-run tag so each is distinct and a substring hit is unambiguous.
 */
function sentinelsFor(tag: string) {
    return {
        adminNotes: `SENTINEL_NOTES_${tag}`,
        overrideReason: `SENTINEL_OVERRIDE_${tag}`,
        reversalReason: `SENTINEL_REVERSAL_${tag}`,
        adminName: `SENTINEL_ADMINNAME_${tag}`,
        accountName: `SENTINEL_ACCTNAME_${tag}`,
        accountNumber: `SENTINEL_ACCTNUM_${tag}`,
        ifscCode: `SENTINEL_IFSC_${tag}`,
        bankName: `SENTINEL_BANK_${tag}`,
    };
}

// --- deep search -----------------------------------------------------------

/** Every string, at any depth, that a leak could hide in — ObjectIds by hex, Dates by ISO. */
function collectStrings(value: any, into: string[] = []): string[] {
    if (value == null) return into;
    if (typeof value === 'string') { into.push(value); return into; }
    if (value instanceof Date) { into.push(value.toISOString()); return into; }
    if (typeof value === 'object' && typeof value.toHexString === 'function') { into.push(value.toHexString()); return into; }
    if (Array.isArray(value)) { value.forEach((v) => collectStrings(v, into)); return into; }
    if (typeof value === 'object') { for (const v of Object.values(value)) collectStrings(v, into); return into; }
    into.push(String(value));
    return into;
}

function expectNoLeak(value: any, forbidden: string[], label: string) {
    const blob = collectStrings(value).join('\u0000');
    for (const secret of forbidden) {
        expect(blob.includes(secret), `${label} leaked "${secret}"`).toBe(false);
    }
}

// --- fixtures --------------------------------------------------------------

/** A recipient User carrying sentinel bank details on both the mirror and the accounts array. */
async function makeOwner(s: ReturnType<typeof sentinelsFor>) {
    return User.create({
        email: `${new ObjectId()}@owner.test`,
        password: 'x',
        name: 'Olive Owner',
        bankDetails: { accountName: s.accountName, accountNumber: s.accountNumber, ifscCode: s.ifscCode, bankName: s.bankName },
        bankAccounts: [{ accountName: s.accountName, accountNumber: s.accountNumber, ifscCode: s.ifscCode, bankName: s.bankName, isDefault: true }],
    });
}

/** Raw listing insert, as in the sibling settlement route tests: full required-field sets are fixture noise here. */
async function makeListing(kind: 'event' | 'venue', ownerId: any) {
    const _id = new ObjectId();
    const collection = kind === 'event' ? 'events' : 'venues';
    const ownerField = kind === 'event' ? 'organizer' : 'owner';
    await mongoose.connection.db!.collection(collection).insertOne({ _id, name: 'Sunburn Arena', [ownerField]: ownerId });
    return _id;
}

async function clean() {
    const db = mongoose.connection.db!;
    await Promise.all([
        Settlement.deleteMany({}),
        Notification.deleteMany({}),
        User.deleteMany({}),
        db.collection('events').deleteMany({}),
        db.collection('venues').deleteMany({}),
        db.collection('payments').deleteMany({}),
        db.collection('payouts').deleteMany({}),
    ]);
}

// --- Half A: the HTTP owner response ---------------------------------------

describe('Property 12 — no admin-internal data reaches an owner', () => {
    it('confines admin-internal data out of the owner HTTP settlement response, at any depth', async () => {
        await Settlement.init(); // the unique (listingKind, listing, idempotencyKey) index

        let checked = 0;

        await fc.assert(
            fc.asyncProperty(runInput, async ({ kind, tag, amount }) => {
                await clean();
                const s = sentinelsFor(tag);

                const admin = await User.create({ email: `${new ObjectId()}@admin.test`, password: 'x', name: s.adminName });
                const owner = await makeOwner(s);
                const listingId = await makeListing(kind, owner._id);
                const listingModel = kind === 'event' ? 'Event' : 'Venue';

                // A recorded transfer flagged as an over-settlement, carrying the
                // sentinel notes and override reason, recorded by the sentinel admin.
                const target = await Settlement.create({
                    listingKind: kind, listing: listingId, listingModel, recipient: owner._id,
                    settledAmount: amount, settlementReference: `UTR-${tag}`, settledAt: new Date('2024-05-02T00:00:00.000Z'),
                    method: 'manual', adminNotes: s.adminNotes, isOverSettlement: true, overrideReason: s.overrideReason,
                    recordedBy: admin._id, idempotencyKey: `key-${new ObjectId()}`,
                });
                // Its reversal, carrying the sentinel reversal reason.
                await Settlement.create({
                    listingKind: kind, listing: listingId, listingModel, recipient: owner._id,
                    settledAmount: -amount, settlementReference: `UTR-${tag}`, settledAt: new Date('2024-05-02T00:00:00.000Z'),
                    method: 'manual', isReversalOf: target._id, reversalReason: s.reversalReason,
                    recordedBy: admin._id, idempotencyKey: `reversal:${String(target._id)}`,
                });

                const base = kind === 'event' ? `/api/events/${listingId}/settlement` : `/api/venues/${listingId}/settlement`;
                const res = await request(app).get(base).set('Authorization', `Bearer ${tokenFor(owner._id)}`);

                expect(res.status, 'owner should see their own listing').toBe(200);
                // Non-vacuous: the owner really does receive the ledger, so
                // "nothing leaked" is a claim about a populated response.
                expect(Array.isArray(res.body.entries) && res.body.entries.length >= 1).toBe(true);

                expectNoLeak(res.body, [
                    s.adminNotes, s.overrideReason, s.reversalReason, s.adminName,
                    s.accountName, s.accountNumber, s.ifscCode, s.bankName,
                    String(admin._id),
                ], `owner ${kind} response`);

                checked += 1;
            }),
            { numRuns: 25 },
        );

        expect(checked).toBeGreaterThan(0);
    }, PROPERTY_TIMEOUT_MS);

    // --- Half B: the Settlement_Notification payload -----------------------

    it('confines admin-internal data out of the stored settlement and reversal notifications, at any depth', async () => {
        await Settlement.init();

        let notifiedRuns = 0;

        await fc.assert(
            fc.asyncProperty(runInput, async ({ kind, tag, amount }) => {
                await clean();
                const s = sentinelsFor(tag);

                const owner = await makeOwner(s);
                const listingId = await makeListing(kind, owner._id);
                // A fresh id for the acting admin — its hex must not surface in any payload.
                const admin = { _id: new ObjectId(), name: s.adminName, adminRole: 'super_admin' };

                // Net_Payable is ₹0 (no Payout), so any positive amount over-settles;
                // a super_admin records it with the sentinel override reason and notes.
                const recorded = await settlementService.recordEntry({
                    kind, listingId,
                    input: {
                        settledAmount: amount,
                        settlementReference: `UTR-${tag}`,
                        settledAt: '2024-05-02T00:00:00.000Z',
                        idempotencyKey: `key-${new ObjectId()}`,
                        adminNotes: s.adminNotes,
                        override: true,
                        overrideReason: s.overrideReason,
                    },
                    admin,
                });
                expect(recorded.notified, 'the owner should have been notified of the settlement').toBe(true);

                // ...then reversed, carrying the sentinel reversal reason.
                const reversed = await settlementService.recordReversal({
                    kind, listingId, entryId: recorded.entry._id, reason: s.reversalReason, admin,
                });
                expect(reversed.notified, 'the owner should have been notified of the reversal').toBe(true);

                const notifications = await Notification.find({}).lean();
                // Both actions produced a notification — the payloads under test exist.
                expect(notifications.length).toBe(2);

                expectNoLeak(notifications, [
                    s.adminNotes, s.overrideReason, s.reversalReason, s.adminName,
                    s.accountName, s.accountNumber, s.ifscCode, s.bankName,
                    admin._id.toHexString(),
                ], `${kind} notifications`);

                notifiedRuns += 1;
            }),
            { numRuns: 25 },
        );

        expect(notifiedRuns).toBeGreaterThan(0);
    }, PROPERTY_TIMEOUT_MS);
});
