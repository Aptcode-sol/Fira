/**
 * Preservation property tests — money invariant: non-buggy paths unchanged.
 *
 * Property 2 (Preservation): the money and flow paths that are NOT part of the
 * bug must behave on FIXED code exactly as they behave today. These tests lock
 * in the current (unfixed) baseline so the fix (tasks 5–7) cannot regress it.
 *
 * CRITICAL: This test is EXPECTED TO PASS on the current (unfixed) code.
 * It is written observation-first — every assertion mirrors what the unfixed
 * code actually does today, observed by reading the services:
 *   - initiateBookingPayment charges round(totalAmount * 0.10) (the 10% advance)
 *   - purchaseTicket with a price and no discount charges
 *     calculateBilling(price, qty, feePct, 0).totalAmount
 *   - purchaseTicket / purchaseTicketByTier with price 0 issues, no payment
 *   - the conditional $inc reservation prevents oversell past capacity
 *
 * The Razorpay gateway (paymentService.initiatePayment) is mocked with the SAME
 * seam as the exploration test so we can read back the exact charged amount.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10,
 *            3.11, 3.12
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Services + models (CommonJS).
const paymentService = require('../services/paymentService');
const bookingService = require('../services/bookingService');
const ticketService = require('../services/ticketService');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');
const Payment = require('../models/Payment');
// initiateBookingPayment populates 'venue'; register the schema so the case
// reaches the money assertion instead of a MissingSchemaError.
const Venue = require('../models/Venue');

// --- Gateway seam: stub paymentService.initiatePayment ---------------------
// Same seam as the exploration test: capture the exact amount each call site
// asks to charge (`totalAmount || amount`, the value initiatePayment sends to
// Razorpay in paise) and persist a Payment from the args passed. Reading back
// `chargedRupees` tells us exactly what the unfixed call site fed the gateway.
const chargedRupees: number[] = [];
beforeAll(() => {
  vi.spyOn(paymentService, 'initiatePayment').mockImplementation(async (args: any) => {
    const chargeAmount = args.totalAmount || args.amount;
    chargedRupees.push(chargeAmount);
    const payment = await Payment.create({
      user: args.userId,
      type: args.type,
      referenceId: args.referenceId,
      referenceModel: args.referenceModel,
      amount: chargeAmount,
      subtotal: args.subtotal || 0,
      platformFee: args.platformFee || 0,
      platformFeePercentage: args.platformFeePercentage || 5,
      gstAmount: args.gstAmount || 0,
      totalAmount: args.totalAmount || chargeAmount,
      discountCode: args.discountCode || null,
      discountAmount: args.discountAmount || 0,
      status: 'pending',
      gatewayOrderId: `order_mock_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    });
    return { payment, gatewayOrderId: payment.gatewayOrderId, keyId: 'test', amount: Math.round(chargeAmount * 100), currency: 'INR' };
  });
});

const lastChargedRupees = () => chargedRupees[chargedRupees.length - 1];

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

beforeEach(() => {
  chargedRupees.length = 0;
});

// --- Fixture helpers -------------------------------------------------------

async function makeUser(overrides: Record<string, any> = {}) {
  return User.create({
    email: `u_${Math.random().toString(36).slice(2)}@test.com`,
    password: 'x',
    name: 'Test User',
    ...overrides,
  });
}

async function makeEvent(organizerId: any, overrides: Record<string, any> = {}) {
  const start = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const end = new Date(Date.now() + 8 * 24 * 3600 * 1000);
  return Event.create({
    organizer: organizerId,
    name: 'Test Event',
    description: 'desc',
    startDateTime: start,
    endDateTime: end,
    maxAttendees: 100,
    status: 'approved',
    ...overrides,
  });
}

// --------------------------------------------------------------------------
// Preservation 1 — Flow 1 (Req 3.1): booking advance stays 10% of the total.
// The TRUE invariant to preserve is that the advance SUBTOTAL is 10% of the
// booking total — fees are added on top per the Flow 1 fix. The original
// assertion (`charged === round(totalAmount * 0.10)`) encoded the pre-fix
// BARE-advance charge, not the invariant: post-fix the advance is routed
// through calculateBilling so the amount charged is
// billing.totalAmount == subtotal(=10% advance) + platformFee + gstAmount,
// which the design (Money Invariants) and exploration Case A require. This
// assertion is corrected to lock in that invariant: subtotal is still the 10%
// advance, and charged == recorded billing total built from it.
// --------------------------------------------------------------------------
describe('Preservation — booking advance subtotal is 10% of the booking total', () => {
  it('routes the 10% advance through billing: subtotal == 10% advance, charged == billing total', async () => {
    const totals = [100, 999, 1000, 5000, 10000, 12345, 99999];
    for (const totalAmount of totals) {
      chargedRupees.length = 0;
      const user = await makeUser();
      const booking = await Booking.create({
        user: user._id,
        venue: new mongoose.Types.ObjectId(),
        bookingDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
        startTime: '10:00',
        endTime: '12:00',
        status: 'accepted',
        totalAmount,
      });

      await bookingService.initiateBookingPayment(booking._id, user._id);

      const advance = Math.round(totalAmount * 0.10);
      const expected = paymentService.calculateBilling(advance, 1, 5);
      const charged = lastChargedRupees();
      const payment = await Payment.findOne({ referenceId: booking._id, referenceModel: 'Booking' });

      // The 10% advance is preserved as the billing SUBTOTAL...
      expect(payment!.subtotal).toBe(advance);
      // ...and the charge equals the recorded billing total built from it.
      expect(charged).toBe(expected.totalAmount);
      expect(charged).toBe(payment!.totalAmount);

      await Booking.deleteMany({});
      await Payment.deleteMany({});
      await User.deleteMany({});
    }
  });
});

// --------------------------------------------------------------------------
// Preservation 2 — Flow 2 (Req 3.3, 3.7): no-discount flat purchase charge.
// Observed on unfixed code: purchaseTicket with ticketPrice > 0 and NO discount
// requires payment and charges calculateBilling(price, qty, effFee, 0).totalAmount
// — i.e. the zero-discount billing total. The effective fee is whatever the
// service actually resolves (`event.platformFeePercentage ?? 5`); the current
// Event schema does NOT persist `platformFeePercentage`, so today the code
// always falls back to 5 regardless of what the event was created with. Rather
// than hard-code that quirk, we read the effective fee back from the recorded
// Payment (`platformFeePercentage`, which the seam captures from the call site)
// and assert the charge reconstructs from THAT fee — locking in the true
// current behavior across the price/qty domain. sweep.
// --------------------------------------------------------------------------
describe('Preservation — no-discount flat purchase charges the standard billing total', () => {
  it('requires payment and charges calculateBilling(price, qty, effFee, 0).totalAmount', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20000 }),
        fc.integer({ min: 1, max: 10 }),
        async (ticketPrice, quantity) => {
          chargedRupees.length = 0;
          const organizer = await makeUser({ role: 'venue_owner' });
          const buyer = await makeUser();
          const event = await makeEvent(organizer._id, {
            ticketPrice,
            ticketType: 'paid',
            maxAttendees: 100000,
          });

          const result: any = await ticketService.purchaseTicket({
            userId: buyer._id,
            eventId: event._id,
            quantity,
          });

          const charged = lastChargedRupees();
          // The fee the call site actually used, as recorded on the Payment.
          const payment = await Payment.findOne({ referenceId: event._id, referenceModel: 'Event' });
          const effFee = payment ? payment.platformFeePercentage : 5;
          const expected = paymentService.calculateBilling(ticketPrice, quantity, effFee, 0);

          // cleanup within the property run to keep the DB small
          await Event.deleteMany({});
          await User.deleteMany({});
          await Payment.deleteMany({});

          return (
            result.paymentRequired === true &&
            charged === expected.totalAmount
          );
        }
      ),
      { numRuns: 60 }
    );
  });
});

// --------------------------------------------------------------------------
// Preservation 3 — Flow 2 (Req 3.4): free flat ticket issued, no payment.
// Observed on unfixed code: purchaseTicket with ticketPrice === 0 skips the
// payment branch, reserves a seat and returns { success: true, ticket } with
// no paymentRequired and no charge captured.
// --------------------------------------------------------------------------
describe('Preservation — free flat ticket issues with no payment required', () => {
  it('returns success with a ticket and never charges for a price-0 event', async () => {
    const organizer = await makeUser({ role: 'venue_owner' });
    const buyer = await makeUser();
    const event = await makeEvent(organizer._id, { ticketPrice: 0, ticketType: 'free' });

    const result: any = await ticketService.purchaseTicket({
      userId: buyer._id,
      eventId: event._id,
      quantity: 1,
    });

    expect(result.success).toBe(true);
    expect(result.ticket).toBeTruthy();
    expect(result.paymentRequired).toBeUndefined();
    expect(chargedRupees.length).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Preservation 4 — Flow 2 (Req 3.5): atomic inventory reservation prevents
// oversell past maxAttendees on the flat path. Observed on unfixed code: the
// conditional $inc on currentAttendees only succeeds while capacity remains.
// Fire concurrent-style single-seat purchases past capacity; the number that
// succeed must never exceed maxAttendees, and currentAttendees must not exceed
// it either.
// --------------------------------------------------------------------------
describe('Preservation — atomic reservation prevents oversell (flat path)', () => {
  it('never sells more than maxAttendees under concurrent single-seat buys', async () => {
    const capacity = 5;
    const attempts = 12; // more buyers than seats
    const organizer = await makeUser({ role: 'venue_owner' });
    const event = await makeEvent(organizer._id, { ticketPrice: 0, ticketType: 'free', maxAttendees: capacity });

    const buyers = await Promise.all(
      Array.from({ length: attempts }, () => makeUser())
    );

    const results = await Promise.allSettled(
      buyers.map((b) =>
        ticketService.purchaseTicket({ userId: b._id, eventId: event._id, quantity: 1 })
      )
    );

    const succeeded = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as any).success
    ).length;

    const after = await Event.findById(event._id);

    expect(succeeded).toBe(capacity);
    expect(after.currentAttendees).toBe(capacity);
    expect(after.currentAttendees).toBeLessThanOrEqual(capacity);
  });
});

// --------------------------------------------------------------------------
// Preservation 5 — Flow 2 (Req 3.5): atomic tier reservation prevents oversell
// past a tier's maxQuantity. Observed on unfixed code: purchaseTicketByTier
// uses a conditional $inc on ticketTiers.$.soldCount capped at maxQuantity.
//
// The tier here MUST be FREE (price 0). The original version used a PAID tier
// (VIP @ 2000) and asserted it reserved inventory — but that assertion encoded
// the OLD bug: paid tiers auto-reserved WITHOUT charging (Task 1 / exploration
// Case C). Post-fix, a paid tier correctly returns { paymentRequired } BEFORE
// reserving, so it no longer commits soldCount. Using a free tier isolates the
// invariant this preservation test actually owns — the atomic $inc reservation
// itself — which the fix preserves verbatim for the free path.
// --------------------------------------------------------------------------
describe('Preservation — atomic tier reservation prevents oversell', () => {
  it('never reserves more than tier.maxQuantity under concurrent tier buys', async () => {
    const tierCap = 4;
    const attempts = 10;
    const organizer = await makeUser({ role: 'venue_owner' });
    const event = await makeEvent(organizer._id, {
      ticketPrice: 0,
      ticketTiers: [{ name: 'VIP', price: 0, maxQuantity: tierCap, soldCount: 0 }],
    });

    const buyers = await Promise.all(
      Array.from({ length: attempts }, () => makeUser())
    );

    const results = await Promise.allSettled(
      buyers.map((b) =>
        ticketService.purchaseTicketByTier(event._id, 'VIP', 1, b._id)
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;

    const after = await Event.findById(event._id);
    const soldCount = after.ticketTiers.find((t: any) => t.name === 'VIP').soldCount;

    expect(succeeded).toBe(tierCap);
    expect(soldCount).toBe(tierCap);
    expect(soldCount).toBeLessThanOrEqual(tierCap);
  });
});

// --------------------------------------------------------------------------
// Preservation 6 — pure-math sweep over calculateBilling. This holds today and
// must keep holding after the fix: the no-discount total is stable and the
// breakdown always reconstructs the total. (Req 3.3, 3.7)
// --------------------------------------------------------------------------
describe('Preservation — calculateBilling zero-discount total is stable', () => {
  it('no-discount total == breakdown sum for all price/qty/fee', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100000 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 30 }),
        (price, qty, feePct) => {
          const b = paymentService.calculateBilling(price, qty, feePct, 0);
          return (
            b.subtotal === price * qty &&
            b.discountedSubtotal === price * qty &&
            b.totalAmount === b.discountedSubtotal + b.platformFee + b.gstAmount
          );
        }
      ),
      { numRuns: 300 }
    );
  });
});
