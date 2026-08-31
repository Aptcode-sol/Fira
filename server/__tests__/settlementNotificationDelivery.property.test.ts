/**
 * Feature: per-listing-settlement-tracking, Property 15: Every recorded action
 * notifies the owner, and delivery never rolls it back.
 *
 * For any accepted settlement or reversal on a listing with a resolvable
 * Recipient_Party, exactly one Settlement_Notification is sent to that party
 * naming the listing and, for a settlement, the amount, date, and reference, or,
 * for a reversal, the reversal and the updated Settled_To_Date; and for any
 * delivery failure the entry remains stored and the operation still reports
 * success.
 *
 * Under test: `settlementService.recordEntry` and `settlementService.recordReversal`
 * against a real (in-memory) Mongo.
 *
 * `notificationService.createNotification` is wrapped rather than replaced: the
 * wrapper records the payload and then either delegates to the real
 * implementation — so the delivered notification is a stored row the assertions
 * read back, not a promise the stub made — or throws, which is the generated
 * delivery failure. The failure is generated per action, so a run can fail the
 * settlement's delivery, the reversal's, both, or neither.
 *
 * Validates: Requirements 10.1, 10.2, 10.4
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import fc from 'fast-check';
import mongoose from 'mongoose';
// The in-memory Mongo server and its connection are owned by the shared setup
// file (registered as vitest `setupFiles`). Connecting a second one here throws
// "openUri() on an active connection with different connection strings".
import './setup';

const settlementService = require('../services/settlementService');
const notificationService = require('../services/notificationService');
const Settlement = require('../models/Settlement');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
// Registered so the payout read inside getListingFigures resolves its model.
require('../models/Payout');
const { formatInr } = require('../utils/formatInr');

// --- generators ------------------------------------------------------------

type Delivery = 'ok' | 'fail';

type Scenario = {
    netPayable: number;
    settledAmount: number;
    reference: string;
    listingName: string;
    daysAgo: number;
    settleDelivery: Delivery;
    reverseDelivery: Delivery;
    reason: string;
};

// Whole rupees, and `settledAmount` never past Net_Payable: an over-settlement
// is a rejection (Property 5's territory), and a rejected request never reaches
// the notification step this property is about.
const scenario: fc.Arbitrary<Scenario> = fc
    .integer({ min: 2, max: 20000 })
    .chain((netPayable) =>
        fc.record({
            netPayable: fc.constant(netPayable),
            settledAmount: fc.integer({ min: 1, max: netPayable }),
            // Prefixed so a whitespace-only draw cannot become a validation
            // rejection instead of a delivery case.
            reference: fc.string({ minLength: 1, maxLength: 20 }).map((s) => `UTR-${s}`),
            listingName: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `Listing ${s}`),
            daysAgo: fc.integer({ min: 0, max: 400 }),
            settleDelivery: fc.constantFrom<Delivery>('ok', 'fail'),
            reverseDelivery: fc.constantFrom<Delivery>('ok', 'fail'),
            reason: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `correction ${s}`),
        })
    );

// --- fixtures --------------------------------------------------------------

const NOW = Date.now();
const DAY_MS = 24 * 3600 * 1000;

async function makeUser(name: string) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('users').insertOne({ _id, name, email: `${_id}@x.test` });
    return _id;
}

async function makeEvent(organizer: mongoose.Types.ObjectId, name: string) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('events').insertOne({ _id, name, organizer, status: 'approved' });
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
        paidAt: new Date(NOW - 10 * DAY_MS),
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
        createdAt: new Date(NOW - 5 * DAY_MS),
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

/** The calendar date a settlement message carries, the same way the service builds it. */
const isoDate = (value: Date) => new Date(value).toISOString().slice(0, 10);

// --- the delivery sink -----------------------------------------------------

const realCreateNotification = notificationService.createNotification;

/**
 * Wrap the sink for one action: record the payload, then deliver for real or
 * fail. Returns the array the call is recorded into, so "exactly one
 * notification is sent" is checkable even on the runs where delivery fails.
 */
function armDelivery(mode: Delivery) {
    const calls: any[] = [];
    notificationService.createNotification = async (payload: any) => {
        calls.push(payload);
        if (mode === 'fail') throw new Error('notification sink down');
        return realCreateNotification.call(notificationService, payload);
    };
    return calls;
}

afterEach(() => {
    notificationService.createNotification = realCreateNotification;
});

// 100 runs, each doing two real write paths' worth of DB round-trips, outrun
// vitest's 5s default — and a timed-out run keeps clearing records in the
// background, wiping the next test's fixtures. So the timeout is explicit.
const PROPERTY_TIMEOUT_MS = 180000;

describe('Property 15 — every recorded action notifies the owner, and delivery never rolls it back', () => {
    beforeAll(async () => {
        // The unique (listingKind, listing, idempotencyKey) index must exist for
        // the write paths to behave the way they do in production.
        await Settlement.init();
    });

    it('sends exactly one notification per accepted settlement and reversal, and keeps the entry when delivery fails', async () => {
        await fc.assert(
            fc.asyncProperty(scenario, async (s: Scenario) => {
                const organizer = await makeUser('Olive Organizer');
                const adminId = await makeUser('Ada Admin');
                const admin = { _id: adminId, name: 'Ada Admin', adminRole: 'admin' };
                const eventId = await makeEvent(organizer, s.listingName);
                await seedMoney(eventId, s.netPayable);
                const settledAt = new Date(NOW - s.daysAgo * DAY_MS);

                try {
                    // --- the settlement (Requirements 10.1, 10.4) ---
                    const settleCalls = armDelivery(s.settleDelivery);
                    const recorded = await settlementService.recordEntry({
                        kind: 'event',
                        listingId: String(eventId),
                        input: {
                            settledAmount: s.settledAmount,
                            settlementReference: s.reference,
                            settledAt,
                            idempotencyKey: 'key-1',
                        },
                        admin,
                    });

                    // Delivery is attempted exactly once, at the resolvable
                    // Recipient_Party, whether or not it succeeds.
                    expect(settleCalls).toHaveLength(1);
                    expect(String(settleCalls[0].userId)).toBe(String(organizer));

                    // The entry is stored and the operation reports success in
                    // both modes — a delivery failure never rolls it back.
                    const storedEntry = await Settlement.findOne({ listing: eventId, isReversalOf: null }).lean();
                    expect(storedEntry.settledAmount).toBe(s.settledAmount);
                    expect(recorded.entry._id).toBe(String(storedEntry._id));
                    expect(recorded.ledger.settledToDate).toBe(s.settledAmount);
                    expect(recorded.recipientMissing).toBeUndefined();

                    const settleNotes = await Notification.find({ type: 'settlement_recorded' }).lean();
                    if (s.settleDelivery === 'ok') {
                        expect(recorded.notified).toBe(true);
                        // Exactly one, to the owner, naming the listing, the
                        // amount, the date and the reference (Requirement 10.1).
                        expect(settleNotes).toHaveLength(1);
                        expect(String(settleNotes[0].user)).toBe(String(organizer));
                        const text = `${settleNotes[0].title}\n${settleNotes[0].message}`;
                        expect(text).toContain(s.listingName);
                        expect(text).toContain(formatInr(s.settledAmount));
                        expect(text).toContain(isoDate(settledAt));
                        expect(text).toContain(s.reference);
                    } else {
                        // Requirement 10.4 — the failure is recorded as a flag,
                        // nothing was delivered, and the recording still stands.
                        expect(recorded.notified).toBe(false);
                        expect(settleNotes).toHaveLength(0);
                    }

                    // --- the reversal (Requirements 10.2, 10.4) ---
                    const reverseCalls = armDelivery(s.reverseDelivery);
                    const reversed = await settlementService.recordReversal({
                        kind: 'event',
                        listingId: String(eventId),
                        entryId: String(storedEntry._id),
                        reason: s.reason,
                        admin,
                    });

                    expect(reverseCalls).toHaveLength(1);
                    expect(String(reverseCalls[0].userId)).toBe(String(organizer));

                    // The pair nets out, and both rows survive a failed delivery.
                    expect(await Settlement.countDocuments({ listing: eventId })).toBe(2);
                    expect(reversed.ledger.settledToDate).toBe(0);
                    expect(reversed.recipientMissing).toBeUndefined();

                    const reverseNotes = await Notification.find({ type: 'settlement_reversed' }).lean();
                    if (s.reverseDelivery === 'ok') {
                        expect(reversed.notified).toBe(true);
                        // Exactly one, naming the listing, the reversal and the
                        // updated Settled_To_Date (Requirement 10.2).
                        expect(reverseNotes).toHaveLength(1);
                        expect(String(reverseNotes[0].user)).toBe(String(organizer));
                        const text = `${reverseNotes[0].title}\n${reverseNotes[0].message}`;
                        expect(text).toContain(s.listingName);
                        expect(text.toLowerCase()).toContain('revers');
                        expect(text).toContain(formatInr(reversed.ledger.settledToDate));
                    } else {
                        expect(reversed.notified).toBe(false);
                        expect(reverseNotes).toHaveLength(0);
                    }
                } finally {
                    notificationService.createNotification = realCreateNotification;
                    await clearRecords();
                }
            }),
            { numRuns: 25 }
        );
    }, PROPERTY_TIMEOUT_MS);
});
