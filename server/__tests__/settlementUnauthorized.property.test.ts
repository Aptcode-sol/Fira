/**
 * Feature: per-listing-settlement-tracking, Property 16: Unauthorized requests are rejected and write nothing.
 *
 * For any settlement read or write request whose session is absent or whose
 * Admin_Role is `moderator`, the request is rejected, no money or settlement
 * figures appear in the response, and every `Payment`, `Payout`, and
 * Settlement_Entry record is unchanged.
 *
 * Under test: the three admin settlement routes on `server/routes/admin.js`
 * through the real router — `adminAuth`, the local `settlementRoleGuard`, the
 * zod `validate` middleware and the error mapping all run as they ship. The
 * guard is the point of the property: the shared `roleGuard` deliberately calls
 * `next()` when `adminRole` is falsy, so these routes name the two accepted
 * roles themselves. A property over generated role pairings is what shows the
 * accept/reject split is exactly Requirement 11's, rather than three examples
 * that happen to pass.
 *
 * The generator pairs every session shape against every route:
 *   session  — `super_admin`, `admin` (accepted), `moderator`, an admin user
 *              carrying no `adminRole`, a plain non-admin user, and no token at
 *              all (all rejected)
 *   route    — the GET read, the record POST, the reversal POST
 *
 * Three clauses, three kinds of assertion:
 *
 *  1. *Rejected* — the expected status (401 with no session, 403 otherwise), so
 *     the property pins which failure it is and not merely that one happened.
 *     Both accepted roles must come back neither 401 nor 403, which is what
 *     stops "reject everything" from satisfying the property.
 *
 *  2. *No figures* — the rejected body is checked two ways. Every money and
 *     settlement key is searched for at any depth (a nested `money` object would
 *     leak just as well as a top-level one), and the serialized body is searched
 *     for the seeded sentinel values — a distinctive Net_Payable, an equally
 *     distinctive Settled_To_Date, and sentinel reference/notes strings. A key
 *     rename cannot slip past the value check, and a value rendered under an
 *     unexpected key cannot slip past the key check.
 *
 *  3. *Nothing written* — the raw `payments`, `payouts` and `settlements`
 *     documents are snapshotted straight out of the driver before and after each
 *     rejected request and compared byte-for-byte, including `updatedAt`, which
 *     is what moves first if anything writes behind the rejection.
 *
 * The listing is seeded with real money records and one real Settlement_Entry,
 * so "unchanged" is a claim about non-empty collections and the reversal route
 * gets a target that genuinely exists — a rejection has to come from the role,
 * not from a missing row.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.6
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
// The in-memory Mongo server and its connection are owned by the shared setup
// file (registered as vitest `setupFiles`).
import './setup';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
delete process.env.REDIS_HOST; // skip the Redis blocklist path in auth

const adminRoutes = require('../routes/admin');
const User = require('../models/User');
const Settlement = require('../models/Settlement');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
// Registered so the reads inside getListingFigures resolve their models.
require('../models/Payment');
require('../models/Payout');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

const { ObjectId } = mongoose.Types;

// Sentinel figures: deliberately odd numbers that appear nowhere else, so
// finding either of them anywhere in a rejected response body is proof a figure
// leaked rather than a coincidence.
const NET_PAYABLE = 918273;
const SEEDED_SETTLED = 556677;
const SENTINEL_REFERENCE = 'UTR-SENT-556677';
const SENTINEL_NOTES = 'SENTINEL-ADMIN-NOTES-918273';

// --- generators ------------------------------------------------------------

type Session =
    | 'super_admin'
    | 'admin'
    | 'moderator'
    | 'missingAdminRole'
    | 'nonAdmin'
    | 'noToken';

type Route = 'read' | 'record' | 'reversal';

/** Requirement 11.1/11.2: exactly these two roles get through. */
const ACCEPTED: Session[] = ['super_admin', 'admin'];

const session = fc.constantFrom<Session>(
    'super_admin',
    'admin',
    'moderator',
    'missingAdminRole',
    'nonAdmin',
    'noToken',
);

const route = fc.constantFrom<Route>('read', 'record', 'reversal');

// --- fixtures --------------------------------------------------------------

const tokenFor = (id: any) => jwt.sign({ userId: String(id) }, process.env.JWT_SECRET as string);

/**
 * Raw collection inserts for the money records: the service reads the listing by
 * id and the money by listing scope, so the full Event/Payment required-field
 * sets would be fixture noise. One success Payment and one Payout pin the
 * sentinel Net_Payable.
 */
async function seedListing(ownerId: any) {
    const db = mongoose.connection.db!;
    const listingId = new ObjectId();

    await db.collection('events').insertOne({ _id: listingId, name: 'Sentinel Arena', organizer: ownerId, status: 'approved' });
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
        paidAt: new Date('2024-05-01T10:00:00.000Z'),
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
        createdAt: new Date('2024-05-03T00:00:00.000Z'),
    });

    return listingId;
}

// --- the snapshot ----------------------------------------------------------

/**
 * A stable serialization of one stored document. Keys are sorted so a driver
 * field order change is not read as a mutation, Dates and ObjectIds are rendered
 * by value, and everything else carries its type — so `5000` and `'5000'` are
 * different strings, which is the point of comparing this way rather than with a
 * loose deep-equal.
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
 * Every `Payment`, `Payout` and Settlement_Entry document, read straight out of
 * the driver rather than through the models, so no schema-level cast or default
 * can paper over a difference.
 */
async function moneySnapshot(): Promise<string> {
    const db = mongoose.connection.db!;
    const parts: string[] = [];
    for (const name of ['payments', 'payouts', 'settlements']) {
        const rows = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
        parts.push(`${name}=${canonical(rows)}`);
    }
    return parts.join('|');
}

// --- the "no figures" check ------------------------------------------------

// Every key the settlement surface uses to carry money, a ledger, or a state.
const FORBIDDEN_KEYS = [
    'money', 'ledger', 'entries', 'entry', 'activity', 'payout', 'state',
    'netPayable', 'settledToDate', 'outstandingAmount', 'excessAmount',
    'settledAmount', 'settlementReference', 'settledAt', 'adminNotes',
    'grossCollected', 'platformFeeCollected', 'gstRetained', 'refundedTotal',
    'ownerGross', 'platformCommission', 'netAmount', 'maxRecordable',
];

/** Collect every key name appearing anywhere in the body, at any depth. */
function allKeys(value: any, into: Set<string> = new Set()): Set<string> {
    if (Array.isArray(value)) {
        value.forEach((v) => allKeys(v, into));
    } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            into.add(k);
            allKeys(v, into);
        }
    }
    return into;
}

function expectNoFigures(res: request.Response, label: string) {
    const leakedKeys = [...allKeys(res.body)].filter((k) => FORBIDDEN_KEYS.includes(k));
    expect(leakedKeys, `${label} leaked settlement keys`).toEqual([]);

    // A renamed key still carries the value, so the serialized body is searched
    // for the sentinels too.
    const text = typeof res.text === 'string' ? res.text : JSON.stringify(res.body ?? '');
    for (const sentinel of [String(NET_PAYABLE), String(SEEDED_SETTLED), SENTINEL_REFERENCE, SENTINEL_NOTES]) {
        expect(text.includes(sentinel), `${label} leaked the sentinel ${sentinel}`).toBe(false);
    }
}

// --- the request -----------------------------------------------------------

// A valid body for each write route, so a rejection can only come from the
// session and never from the payload.
const entryBody = () => ({
    settledAmount: 1000,
    settlementReference: 'UTR-4411',
    settledAt: '2024-05-04T00:00:00.000Z',
    idempotencyKey: `key-${new ObjectId()}`,
});

function send(kind: Route, base: string, entryId: string, token: string | null) {
    const req =
        kind === 'read'
            ? request(app).get(base)
            : kind === 'record'
                ? request(app).post(`${base}/entries`).send(entryBody())
                : request(app).post(`${base}/entries/${entryId}/reversal`).send({ reason: 'wrong beneficiary' });
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

// 100 runs of a real HTTP round trip against a real in-memory Mongo, each with
// three raw collection snapshots, comfortably outrun vitest's 5s default.
const PROPERTY_TIMEOUT_MS = 300000;

describe('Property 16 — unauthorized requests are rejected and write nothing', () => {
    it('rejects every session that is not super_admin or admin, returns no figures, and leaves every money record unchanged', async () => {
        // The unique (listingKind, listing, idempotencyKey) index must actually
        // exist — it is part of what the record route leans on.
        await Settlement.init();

        const mk = async (name: string, extra: Record<string, any>) =>
            User.create({ name, email: `${new ObjectId()}@x.test`, password: 'x', ...extra });

        const owner = await mk('Olive Organizer', {});
        const users: Record<Exclude<Session, 'noToken'>, any> = {
            super_admin: await mk('Sue Super', { role: 'admin', roles: ['admin'], adminRole: 'super_admin' }),
            admin: await mk('Ada Admin', { role: 'admin', roles: ['admin'], adminRole: 'admin' }),
            moderator: await mk('Mo Moderator', { role: 'admin', roles: ['admin'], adminRole: 'moderator' }),
            // roleGuard alone would call next() for this one — its documented
            // legacy fallback — which is exactly why the routes guard locally.
            missingAdminRole: await mk('Len Legacy', { role: 'admin', roles: ['admin'] }),
            nonAdmin: await mk('Ned Normal', {}),
        };
        expect(users.missingAdminRole.adminRole).toBeFalsy();

        const listingId = await seedListing(owner._id);
        const base = `/api/admin/listings/event/${listingId}/settlement`;

        // Guards the property against being vacuous: "nothing changed" is
        // trivially true if nothing was ever accepted, so both halves of the
        // split must be shown to have happened.
        let accepted = 0;
        let rejected = 0;

        await fc.assert(
            fc.asyncProperty(session, route, async (who, target) => {
                // Each run starts from the same ledger: one real entry, so the
                // snapshot is non-empty and the reversal route has a target that
                // genuinely exists.
                await Promise.all([Settlement.deleteMany({}), AuditLog.deleteMany({}), Notification.deleteMany({})]);
                const seed = await Settlement.create({
                    listingKind: 'event',
                    listing: listingId,
                    listingModel: 'Event',
                    recipient: owner._id,
                    settledAmount: SEEDED_SETTLED,
                    settlementReference: SENTINEL_REFERENCE,
                    settledAt: new Date('2024-05-02T00:00:00.000Z'),
                    method: 'manual',
                    adminNotes: SENTINEL_NOTES,
                    recordedBy: users.admin._id,
                    idempotencyKey: 'seed-key',
                });

                const before = await moneySnapshot();
                const token = who === 'noToken' ? null : tokenFor(users[who]._id);
                const res = await send(target, base, String(seed._id), token);
                const label = `${who} on ${target}`;

                if (ACCEPTED.includes(who)) {
                    // Req 11.1/11.2 — the two authorized roles get through and
                    // reach the service. Without this half, rejecting everything
                    // would satisfy the property.
                    expect(res.status, `${label} was refused`).toBe(200);
                    accepted += 1;
                    return;
                }

                // Req 11.3/11.4 — and which rejection it is, not merely that
                // there was one.
                expect(res.status, label).toBe(who === 'noToken' ? 401 : 403);
                expectNoFigures(res, label);
                // Req 11.6 — every Payment, Payout and Settlement_Entry byte-identical.
                expect(await moneySnapshot(), `${label} wrote to a money collection`).toBe(before);
                rejected += 1;
            }),
            { numRuns: 25 },
        );

        expect(accepted).toBeGreaterThan(0);
        expect(rejected).toBeGreaterThan(0);
    }, PROPERTY_TIMEOUT_MS);
});
