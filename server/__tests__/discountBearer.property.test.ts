/**
 * Task 7.2 — Discount bearer attribution + listed price (Flow 4).
 *
 * Property 5 (Bug Condition): an applied discount is attributed to whoever
 * created the code — a code whose createdBy user has an adminRole is absorbed
 * by the PLATFORM (owner keeps full listed price), otherwise by the OWNER
 * (settlement reduced). The full listed price is recorded on every Payment so
 * settlement can pay the owner correctly. No discount => bearer null, listed
 * price still recorded.
 *
 * This task adds ATTRIBUTION DATA only — it must not change the amount charged.
 *
 * Validates: Requirements 4.1, 4.2
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const paymentService = require('../services/paymentService');
const ticketService = require('../services/ticketService');
const Event = require('../models/Event');
const User = require('../models/User');
const Payment = require('../models/Payment');
const DiscountCode = require('../models/DiscountCode');

// Gateway seam: stub initiatePayment to persist a Payment from the exact args
// the call site passed — so we can assert discountBearer/listedPrice attribution.
beforeAll(() => {
  vi.spyOn(paymentService, 'initiatePayment').mockImplementation(async (args: any) => {
    const chargeAmount = args.totalAmount || args.amount;
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
      discountBearer: args.discountBearer || null,
      listedPrice: args.listedPrice != null ? args.listedPrice : (args.subtotal || 0),
      status: 'pending',
      gatewayOrderId: `order_mock_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    });
    return { payment, gatewayOrderId: payment.gatewayOrderId, keyId: 'test', amount: Math.round(chargeAmount * 100), currency: 'INR' };
  });
});

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

async function makeUser(overrides: Record<string, any> = {}) {
  return User.create({
    email: `u_${Math.random().toString(36).slice(2)}@test.com`,
    password: 'x',
    name: 'Test User',
    ...overrides,
  });
}

async function makeEvent(organizerId: any, overrides: Record<string, any> = {}) {
  return Event.create({
    organizer: organizerId,
    name: 'Test Event',
    description: 'desc',
    startDateTime: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    endDateTime: new Date(Date.now() + 8 * 24 * 3600 * 1000),
    maxAttendees: 100,
    status: 'approved',
    ticketPrice: 1000,
    ticketType: 'paid',
    platformFeePercentage: 5,
    ...overrides,
  });
}

async function makeCode(eventId: any, createdBy: any) {
  return DiscountCode.create({
    event: eventId,
    code: 'SAVE200',
    discountType: 'flat',
    discountValue: 200,
    validFrom: new Date(Date.now() - 3600 * 1000),
    validUntil: new Date(Date.now() + 24 * 3600 * 1000),
    createdBy,
    isActive: true,
  });
}

describe('discount bearer attribution (Flow 4)', () => {
  it('admin-created code => discountBearer "platform", listedPrice = full listed price', async () => {
    const admin = await makeUser({ role: 'admin', adminRole: 'admin' });
    const buyer = await makeUser();
    const event = await makeEvent(admin._id);
    await makeCode(event._id, admin._id);

    await ticketService.purchaseTicket({ userId: buyer._id, eventId: event._id, quantity: 1, discountCode: 'SAVE200' });

    const p = await Payment.findOne({ referenceId: event._id });
    expect(p!.discountBearer).toBe('platform');
    expect(p!.discountAmount).toBe(200);
    expect(p!.listedPrice).toBe(1000); // full listed price, not discounted
  });

  it('owner-created code => discountBearer "owner", listedPrice = full listed price', async () => {
    const owner = await makeUser({ role: 'venue_owner' }); // no adminRole
    const buyer = await makeUser();
    const event = await makeEvent(owner._id);
    await makeCode(event._id, owner._id);

    await ticketService.purchaseTicket({ userId: buyer._id, eventId: event._id, quantity: 2, discountCode: 'SAVE200' });

    const p = await Payment.findOne({ referenceId: event._id });
    expect(p!.discountBearer).toBe('owner');
    expect(p!.listedPrice).toBe(2000); // 1000 * qty 2, full listed price
  });

  it('no discount => discountBearer null, listedPrice still = full listed price', async () => {
    const owner = await makeUser({ role: 'venue_owner' });
    const buyer = await makeUser();
    const event = await makeEvent(owner._id);

    await ticketService.purchaseTicket({ userId: buyer._id, eventId: event._id, quantity: 1 });

    const p = await Payment.findOne({ referenceId: event._id });
    expect(p!.discountBearer).toBeNull();
    expect(p!.listedPrice).toBe(1000);
  });
});
