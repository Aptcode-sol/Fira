/**
 * Bug condition exploration test — money invariant: charged == recorded.
 *
 * Property 1 (Bug Condition): every paid money path must charge Razorpay the
 * SAME amount it records on the Payment, and that amount must equal the billing
 * breakdown (subtotal + platformFee + gstAmount, minus discount).
 *
 * CRITICAL: This test is EXPECTED TO FAIL on the current (unfixed) code.
 * The failures confirm the bugs described in bugfix.md Flows 1–3 exist:
 *   Case A — booking advance charged with no breakdown (Flow 1)
 *   Case B — ticket discount never passed into billing (Flow 2)
 *   Case C — paid tier issued for free (Flow 2)
 *   Case D — payout commission hardcoded at 5% (Flow 3)
 *
 * Once the fix lands (tasks 5–7), the SAME assertions here must PASS (task 16).
 *
 * The Razorpay gateway is mocked so we can capture the exact amount charged
 * (in paise) and compare it to the recorded Payment.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// --- Gateway mock: capture the amount actually charged to Razorpay ---------
// initiatePayment does `new Razorpay(...)` then `razorpay.orders.create(opts)`
// where opts.amount is in paise. We record every charge so each case can read
// back the last charged rupee amount.
// Services + models (CommonJS).
const paymentService = require('../services/paymentService');
const bookingService = require('../services/bookingService');
const ticketService = require('../services/ticketService');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');
const Payment = require('../models/Payment');
const DiscountCode = require('../models/DiscountCode');
// initiateBookingPayment populates 'venue'; register the schema so the case
// reaches the money assertion instead of a MissingSchemaError.
const Venue = require('../models/Venue');

// --- Gateway seam: stub paymentService.initiatePayment ---------------------
// The Razorpay order-creation is the gateway. We stub initiatePayment to (a)
// capture the exact amount the CALL SITE asks to charge (`totalAmount || amount`,
// the same value initiatePayment sends to Razorpay in paise) and (b) persist a
// Payment record from the very args the call site passed — so assertions on the
// recorded Payment reflect exactly what each call site fed the gateway. This is
// the correct seam for these bugs: they are about what the call sites pass in,
// not about Razorpay itself.
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
// Case A — Flow 1: booking advance charged == recorded (with full breakdown)
// --------------------------------------------------------------------------
describe('Case A — booking advance: charged == recorded breakdown', () => {
  it('charges Razorpay the recorded Payment.totalAmount and its breakdown adds up', async () => {
    const user = await makeUser();
    const booking = await Booking.create({
      user: user._id,
      venue: new mongoose.Types.ObjectId(),
      bookingDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      startTime: '10:00',
      endTime: '12:00',
      status: 'accepted',
      totalAmount: 10000,
    });

    await bookingService.initiateBookingPayment(booking._id, user._id);

    const payment = await Payment.findOne({ referenceId: booking._id, referenceModel: 'Booking' });
    expect(payment).toBeTruthy();

    const charged = lastChargedRupees();

    // Invariant: charged == recorded total, and the breakdown reconstructs it.
    expect(charged).toBe(payment!.totalAmount);
    expect(payment!.subtotal + payment!.platformFee + payment!.gstAmount).toBe(charged);
  });
});

// --------------------------------------------------------------------------
// Case B — Flow 2: ticket discount applied to charge AND recorded
// --------------------------------------------------------------------------
describe('Case B — ticket discount: charged == discounted total, recorded on Payment', () => {
  it('charges the discounted total and records discountAmount == 200', async () => {
    const organizer = await makeUser({ role: 'venue_owner' });
    const buyer = await makeUser();
    const event = await makeEvent(organizer._id, { ticketPrice: 1000, ticketType: 'paid', platformFeePercentage: 5 });

    // Valid ₹200 flat discount code for this event.
    await DiscountCode.create({
      event: event._id,
      code: 'SAVE200',
      discountType: 'flat',
      discountValue: 200,
      validFrom: new Date(Date.now() - 3600 * 1000),
      validUntil: new Date(Date.now() + 24 * 3600 * 1000),
      createdBy: organizer._id,
      isActive: true,
    });

    const expected = paymentService.calculateBilling(1000, 1, 5, 200);

    await ticketService.purchaseTicket({
      userId: buyer._id,
      eventId: event._id,
      quantity: 1,
      discountCode: 'SAVE200',
    });

    const charged = lastChargedRupees();
    const payment = await Payment.findOne({ referenceId: event._id, referenceModel: 'Event' });
    expect(payment).toBeTruthy();

    expect(charged).toBe(expected.totalAmount);
    expect(payment!.discountAmount).toBe(200);
  });
});

// --------------------------------------------------------------------------
// Case C — Flow 2: paid tier requires payment (not issued free)
// --------------------------------------------------------------------------
describe('Case C — paid tier: payment required before entitlement', () => {
  it('requires payment for a VIP @ 2000 tier', async () => {
    const organizer = await makeUser({ role: 'venue_owner' });
    const buyer = await makeUser();
    const event = await makeEvent(organizer._id, {
      ticketPrice: 0,
      ticketTiers: [{ name: 'VIP', price: 2000, maxQuantity: 10, soldCount: 0 }],
    });

    const result: any = await ticketService.purchaseTicketByTier(event._id, 'VIP', 1, buyer._id);

    expect(result.paymentRequired).toBe(true);
    expect(result.paymentData?.amount).toBeGreaterThan(0);
  });
});

// --------------------------------------------------------------------------
// Case D — Flow 3: payout commission derived from config (8%), not hardcoded 5
// --------------------------------------------------------------------------
describe('Case D — payout commission from config', () => {
  it('uses the event-configured 8% commission', async () => {
    const owner = await makeUser({
      role: 'venue_owner',
      bankDetails: {
        accountName: 'Owner',
        accountNumber: '123456789012',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC',
      },
    });

    const payout: any = await paymentService.processPayout({
      recipientId: owner._id,
      type: 'event_tickets',
      referenceId: new mongoose.Types.ObjectId(),
      referenceModel: 'Event',
      grossAmount: 10000,
      platformFeePercentage: 8,
      bankDetails: owner.bankDetails,
    });

    expect(payout.platformCommissionPercentage).toBe(8);
  });
});

// --------------------------------------------------------------------------
// Pure-math sweep — broad property over calculateBilling (single source of
// money truth). This holds today and must keep holding after the fix.
// --------------------------------------------------------------------------
describe('calculateBilling — money math invariant (broad sweep)', () => {
  it('totalAmount reconstructs from the breakdown for all inputs', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100000 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 30 }),
        fc.nat({ max: 100000 }),
        (price, qty, feePct, rawDiscount) => {
          const subtotal = price * qty;
          const discount = Math.min(rawDiscount, subtotal);
          const b = paymentService.calculateBilling(price, qty, feePct, discount);
          const discountedSubtotal = Math.max(0, subtotal - discount);
          return (
            b.discountedSubtotal === discountedSubtotal &&
            b.totalAmount === b.discountedSubtotal + b.platformFee + b.gstAmount
          );
        }
      ),
      { numRuns: 300 }
    );
  });
});
