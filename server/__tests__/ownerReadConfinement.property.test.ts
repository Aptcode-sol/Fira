/**
 * Feature: per-listing-settlement-tracking, Property 17: Owner reads are
 * confined to owned listings.
 *
 * For any authenticated user and any listing, the owner settlement response
 * returns figures if and only if that user is the listing's Recipient_Party;
 * every other pairing is rejected with no money or settlement figures.
 *
 * Under test: `GET /api/events/:id/settlement` and `GET /api/venues/:id/settlement`
 * through `supertest` over the real routers, with real signed tokens and a real
 * (in-memory) Mongo. The claim is about who the HTTP surface answers, so neither
 * the auth middleware nor the service nor the store is stubbed — a test that
 * called `getOwnerSettlement` directly would not notice a route mounted without
 * `auth`, or a handler that answered before the ownership check.
 *
 * The "if and only if" is the whole point, and a single owner/stranger pair does
 * not test it. Each run generates a population of users and a population of
 * listings of both kinds with generated ownership, then walks the full cross
 * product: every (user, listing) pairing is asserted, so a handler that answered
 * the wrong owner, or refused the right one, fails on some pairing rather than
 * escaping because the fixture only ever asked about one listing.
 *
 * Two probe listings ride along in every run, per kind:
 *   - an id that is a well-formed ObjectId no listing carries, and
 *   - an id that is not an ObjectId at all.
 * The design answers both with the same 403 and the same message as "this exists
 * but is not yours", so existence is not leaked. Asserting the message is byte
 * identical across all three rejection causes is what makes that checkable — a
 * distinct "not found" for the absent id would let a prober enumerate listings.
 *
 * Each generated listing carries a distinct sentinel settled amount so the
 * negative half of the biconditional can be asserted on content and not only on
 * status: a rejected body must not contain that number anywhere, nor any of the
 * figure-bearing keys.
 *
 * Validates: Requirements 11.5, 9.1
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
// The in-memory Mongo server and its connection are owned by the shared setup
// file (registered as vitest `setupFiles`); connecting a second one here throws.
import './setup';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
delete process.env.REDIS_HOST; // skip the Redis blocklist path in auth

const eventRoutes = require('../routes/event');
const venueRoutes = require('../routes/venue');
const User = require('../models/User');
const Settlement = require('../models/Settlement');
// Registered so the payout read inside getListingFigures resolves its model.
require('../models/Payout');

const app = express();
app.use(express.json());
app.use('/api/events', eventRoutes);
app.use('/api/venues', venueRoutes);

/** Every money figure Requirement 9.1 names on the owner read. */
const MONEY_KEYS = [
    'ownerGross',
    'platformCommission',
    'netPayable',
    'settledToDate',
    'outstandingAmount',
    'refundedTotal',
] as const;

/** Nothing figure-bearing may appear in a rejected body (Requirement 11.5). */
const FIGURE_BEARING_KEYS = ['money', 'activity', 'state', 'entries', 'payout'] as const;

const deniedMessage = (kind: 'event' | 'venue') => `Not authorized to view settlement for this ${kind}`;

// --- generators ------------------------------------------------------------

type ListingSpec = {
    kind: 'event' | 'venue';
    /** Taken modulo the user population, so ownership always lands on a real user. */
    ownerSeed: number;
    /** Distinct per listing; the sentinel a rejected body must never carry. */
    settledAmount: number;
};

const listingSpec: fc.Arbitrary<ListingSpec> = fc.record({
    kind: fc.constantFrom<'event' | 'venue'>('event', 'venue'),
    ownerSeed: fc.integer({ min: 0, max: 11 }),
    settledAmount: fc.integer({ min: 1, max: 9 }).map((n) => n * 100000 + 7), // 100007..900007
});

/**
 * A path segment that is not an ObjectId. Constrained to url-safe characters and
 * away from the 24-hex shape on purpose: the interesting case is "the service
 * cannot cast this", not "supertest built a broken URL".
 */
const malformedId: fc.Arbitrary<string> = fc
    .string({
        unit: fc.constantFrom(...'ghijklmnopqrstuvwxyz-_'.split('')),
        minLength: 1,
        maxLength: 14,
    })
    .filter((s) => !/^[0-9a-fA-F]{24}$/.test(s));

const scenario = fc.record({
    // At least two users, so every listing has both an owner and a non-owner in
    // the population and the biconditional has both halves to exercise.
    userCount: fc.integer({ min: 2, max: 3 }),
    listings: fc.uniqueArray(listingSpec, {
        selector: (l) => l.settledAmount,
        minLength: 1,
        maxLength: 3,
    }),
    malformed: malformedId,
});

// --- fixtures --------------------------------------------------------------

/** Raw inserts, as in the sibling settlement tests: the full required field sets are fixture noise here. */
async function makeListing(kind: 'event' | 'venue', ownerId: mongoose.Types.ObjectId) {
    const _id = new mongoose.Types.ObjectId();
    const collection = kind === 'event' ? 'events' : 'venues';
    const ownerField = kind === 'event' ? 'organizer' : 'owner';
    await mongoose.connection
        .db!.collection(collection)
        .insertOne({ _id, name: `Property 17 ${kind}`, [ownerField]: ownerId, status: 'approved' });
    return _id;
}

const tokenFor = (userId: mongoose.Types.ObjectId) =>
    jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET as string);

async function clearRecords() {
    await Promise.all([
        Settlement.deleteMany({}),
        User.deleteMany({}),
        mongoose.connection.db!.collection('events').deleteMany({}),
        mongoose.connection.db!.collection('venues').deleteMany({}),
    ]);
}

// Each run seeds a population and then walks a cross product of HTTP requests
// through the real routers, which comfortably outruns vitest's 5s default — and
// a timed-out run keeps clearing records in the background, wiping the next
// test's fixtures. So the test carries an explicit generous timeout.
const PROPERTY_TIMEOUT_MS = 600000;

describe('Property 17 — owner reads are confined to owned listings', () => {
    it('answers with figures exactly when the requester owns the listing, and refuses every other pairing identically', async () => {
        // Guards the biconditional against being vacuous: "refuses every other
        // pairing" is trivially true if no pairing ever owned, and "answers the
        // owner" is trivially true if no pairing ever failed to own. Both halves
        // must be shown to have actually run across the generated populations.
        let ownedBranch = 0;
        let refusedBranch = 0;

        await fc.assert(
            fc.asyncProperty(scenario, async ({ userCount, listings: specs, malformed }) => {
                // At the start, not only at the end: a run that fails mid-assertion
                // must not leave records behind for the shrinking runs that follow.
                await clearRecords();

                const users: mongoose.Types.ObjectId[] = [];
                for (let i = 0; i < userCount; i += 1) {
                    const user = await User.create({
                        email: `p17_${i}_${Math.random().toString(36).slice(2)}@test.com`,
                        password: 'x',
                        name: `User ${i}`,
                    });
                    users.push(user._id);
                }

                /** The real listings, each with its owner and its sentinel amount. */
                const listings = [];
                for (const [index, spec] of specs.entries()) {
                    const ownerId = users[spec.ownerSeed % userCount];
                    const listingId = await makeListing(spec.kind, ownerId);
                    await Settlement.create({
                        listingKind: spec.kind,
                        listing: listingId,
                        listingModel: spec.kind === 'event' ? 'Event' : 'Venue',
                        settledAmount: spec.settledAmount,
                        settlementReference: `UTR-${index}`,
                        settledAt: new Date('2024-05-02T00:00:00.000Z'),
                        method: 'manual',
                        recordedBy: new mongoose.Types.ObjectId(),
                        idempotencyKey: `key-${index}`,
                    });
                    listings.push({ kind: spec.kind, id: String(listingId), ownerId, sentinel: spec.settledAmount });
                }

                // The probe listings: no user owns either, for either kind.
                const probes = (['event', 'venue'] as const).flatMap((kind) => [
                    { kind, id: String(new mongoose.Types.ObjectId()) },
                    { kind, id: malformed },
                ]);

                const get = (kind: 'event' | 'venue', id: string, requester: mongoose.Types.ObjectId) =>
                    request(app)
                        .get(`/api/${kind === 'event' ? 'events' : 'venues'}/${id}/settlement`)
                        .set('Authorization', `Bearer ${tokenFor(requester)}`);

                /** The negative half, shared by non-owner, absent and malformed. */
                const expectRefused = (res: any, kind: 'event' | 'venue', label: string, sentinels: number[]) => {
                    expect(res.status, label).toBe(403);
                    // Byte identical across all three causes: existence is not leaked.
                    expect(res.body, label).toEqual({ error: deniedMessage(kind) });
                    for (const key of FIGURE_BEARING_KEYS) {
                        expect(res.body, `${label} — ${key}`).not.toHaveProperty(key);
                    }
                    const serialized = JSON.stringify(res.body);
                    for (const sentinel of sentinels) {
                        expect(serialized, `${label} — sentinel ${sentinel}`).not.toContain(String(sentinel));
                    }
                };

                const sentinels = listings.map((l) => l.sentinel);

                // --- the cross product: every (user, listing) pairing ---
                for (const requester of users) {
                    for (const listing of listings) {
                        const label = `user ${requester} → ${listing.kind} ${listing.id}`;
                        const res = await get(listing.kind, listing.id, requester);
                        const owns = String(listing.ownerId) === String(requester);

                        if (owns) {
                            expect(res.status, label).toBe(200);
                            expect(res.body.listing, label).toMatchObject({ kind: listing.kind, id: listing.id });
                            // Requirement 9.1 — every named figure comes back.
                            for (const key of MONEY_KEYS) {
                                expect(res.body.money, `${label} — ${key}`).toHaveProperty(key);
                                expect(typeof res.body.money[key], `${label} — ${key}`).toBe('number');
                            }
                            expect(res.body.money.settledToDate, label).toBe(listing.sentinel);
                            expect(res.body).toHaveProperty('state');
                            expect(res.body).toHaveProperty('activity');
                            expect(res.body.entries, label).toHaveLength(1);
                            ownedBranch += 1;
                        } else {
                            expectRefused(res, listing.kind, label, sentinels);
                            refusedBranch += 1;
                        }
                    }

                    // --- and the two probe ids per kind, owned by nobody ---
                    for (const probe of probes) {
                        const res = await get(probe.kind, probe.id, requester);
                        expectRefused(res, probe.kind, `user ${requester} → probe ${probe.kind} ${probe.id}`, sentinels);
                        refusedBranch += 1;
                    }
                }

                await clearRecords();
            }),
            { numRuns: 25 },
        );

        // Both halves of the biconditional actually ran.
        expect(ownedBranch).toBeGreaterThan(0);
        expect(refusedBranch).toBeGreaterThan(0);
    }, PROPERTY_TIMEOUT_MS);
});
