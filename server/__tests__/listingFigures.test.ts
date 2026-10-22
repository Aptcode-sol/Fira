/**
 * Task 2.3 — earningsService.getListingFigures boundary checks.
 *
 * Two named boundaries, and nothing else:
 *   1. A listing with successful payments is owed the owner's share in whole
 *      rupees, with or without a Payout record, so a manual transfer can be
 *      recorded straight away.
 *   2. Fail-closed: a malformed listing id, an unknown kind, and a non-finite
 *      sum all reject rather than returning a zeroed figure set that could
 *      become a settlement basis (Requirement 12.5).
 *
 * The malformed-id and unknown-kind rejections happen before any DB access; the
 * non-finite sum is exercised through the pure buildListingFigures helper.
 *
 * Feature: per-listing-settlement-tracking, Task 2.3
 * Validates: Requirements 1.7, 12.5
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const earningsService = require('../services/earningsService');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');

/**
 * Raw insert so the check doesn't couple to the full Event schema's required
 * fields — getListingFigures only reads `_id`.
 */
async function makeEvent() {
  const eventId = new mongoose.Types.ObjectId();
  await mongoose.connection
    .db!.collection('events')
    .insertOne({ _id: eventId, name: 'Settlement Boundary Event', status: 'approved' });
  return eventId;
}

async function makeSuccessfulPayment(eventId: mongoose.Types.ObjectId, overrides: Record<string, any> = {}) {
  return Payment.create({
    user: new mongoose.Types.ObjectId(),
    type: 'ticket_purchase',
    referenceId: eventId,
    referenceModel: 'Event',
    amount: 1000,
    platformFee: 50,
    gstAmount: 180,
    totalAmount: 1180,
    status: 'success',
    paidAt: new Date('2024-03-04T05:06:07.000Z'),
    ...overrides,
  });
}

describe('getListingFigures — payments but no Payout record (Req 1.7)', () => {
  it("owes the owner's share, floored to whole rupees, while no payout is raised", async () => {
    const eventId = await makeEvent();
    await makeSuccessfulPayment(eventId, { listedPrice: 1000 });
    // ₹2,000.50 listed, ₹100 off on the organizer's own code → ₹1,900.50 share.
    await makeSuccessfulPayment(eventId, {
      amount: 2000, platformFee: 100, gstAmount: 360, totalAmount: 2260.5,
      listedPrice: 2000.5, discountAmount: 100, discountBearer: 'owner',
    });
    expect(await Payout.countDocuments({ referenceId: eventId })).toBe(0);

    const figures = await earningsService.getListingFigures({ kind: 'event', listingId: String(eventId) });

    expect(figures.money.ownerShare).toBe(2900.5);
    expect(figures.money.netPayable).toBe(2900);
    // No commission is invented from a percentage (Requirement 12.1).
    expect(figures.money.ownerGross).toBe(0);
    expect(figures.money.platformCommission).toBe(0);
    expect(figures.payout).toBeNull();

    expect(figures.money.platformFeeCollected).toBe(150);
    expect(figures.money.gstRetained).toBe(540);
    expect(figures.activity.successfulPayments).toBe(2);
    expect(figures.activity.lastPaymentAt).toBeInstanceOf(Date);
  });

  it('a payout record does not change the net payable', async () => {
    const eventId = await makeEvent();
    await makeSuccessfulPayment(eventId, { listedPrice: 1000 });
    await mongoose.connection.db!.collection('payouts').insertOne({
      recipient: new mongoose.Types.ObjectId(), type: 'event_tickets',
      referenceId: eventId, referenceModel: 'Event',
      grossAmount: 900, platformCommission: 0, netAmount: 900, status: 'pending', createdAt: new Date(),
    });

    const figures = await earningsService.getListingFigures({ kind: 'event', listingId: String(eventId) });

    expect(figures.money.ownerShare).toBe(1000);
    expect(figures.money.netPayable).toBe(1000);
  });
});

describe('getListingFigures — fail closed rather than zeroed figures (Req 12.5)', () => {
  it('rejects a malformed listing id', async () => {
    await expect(
      earningsService.getListingFigures({ kind: 'event', listingId: 'not-an-object-id' }),
    ).rejects.toThrow(/malformed event id/);
  });

  it('rejects an absent listing id', async () => {
    await expect(
      earningsService.getListingFigures({ kind: 'venue', listingId: undefined }),
    ).rejects.toThrow(/malformed venue id/);
  });

  it('rejects an unknown listing kind', async () => {
    await expect(
      earningsService.getListingFigures({ kind: 'ticket', listingId: String(new mongoose.Types.ObjectId()) }),
    ).rejects.toThrow(/unknown listing kind/);
  });

  it('rejects a well-formed id that matches no listing', async () => {
    await expect(
      earningsService.getListingFigures({ kind: 'event', listingId: String(new mongoose.Types.ObjectId()) }),
    ).rejects.toThrow(/not found/);
  });

  it('rejects a non-finite money sum instead of returning a partial figure set', () => {
    const money = {
      fullPriceTotal: 1000, grossCollected: 1059, platformFeeCollected: 50, gstRetained: 9,
      discountTotal: 0, discountByOwner: 0, discountByPlatform: 0, ownerShare: 1000,
      ownerGross: 950, platformCommission: 0, netPayable: 950, refundedTotal: 0,
    };
    const activity = {
      successfulPayments: 1, unitsSold: 1, confirmed: 1, cancelled: 0,
      refundedPayments: 0, lastPaymentAt: null,
    };

    expect(() =>
      earningsService.buildListingFigures({ money: { ...money, netPayable: NaN }, activity, payout: null }),
    ).toThrow(/netPayable/);
    expect(() =>
      earningsService.buildListingFigures({ money: { ...money, grossCollected: Infinity }, activity, payout: null }),
    ).toThrow(/grossCollected/);
    expect(() =>
      earningsService.buildListingFigures({ money: { ...money, ownerShare: NaN }, activity, payout: null }),
    ).toThrow(/ownerShare/);
    // A count is a settlement justification too, so it fails closed the same way.
    expect(() =>
      earningsService.buildListingFigures({ money, activity: { ...activity, unitsSold: undefined }, payout: null }),
    ).toThrow(/unitsSold/);
  });
});

describe('getListingFigures — discount breakdown', () => {
  it('splits discounts by who funded them and keeps the owner share at full price for platform codes', async () => {
    const eventId = await makeEvent();
    // No discount: ₹998 of tickets, ₹49.90 fee, ₹8.98 GST.
    await makeSuccessfulPayment(eventId, {
      amount: 1056.88, subtotal: 998, listedPrice: 998, platformFee: 49.9, gstAmount: 8.98, totalAmount: 1056.88,
    });
    // Organizer's 15% code (the live NITHU09 order): the organizer absorbs it.
    await makeSuccessfulPayment(eventId, {
      amount: 4491.75, subtotal: 4990, listedPrice: 4990, platformFee: 249.5, gstAmount: 44.91, totalAmount: 4491.75,
      discountCode: 'NITHU09', discountAmount: 792.66, discountBearer: 'owner',
    });
    // Platform's ₹100 code: the platform absorbs it, the organizer keeps full price.
    await makeSuccessfulPayment(eventId, {
      amount: 956.88, subtotal: 998, listedPrice: 998, platformFee: 49.9, gstAmount: 8.98, totalAmount: 956.88,
      discountCode: 'FIRAA100', discountAmount: 100, discountBearer: 'platform',
    });

    const { money } = await earningsService.getListingFigures({ kind: 'event', listingId: String(eventId) });

    expect(money.fullPriceTotal).toBeCloseTo(998 + 4990 + 998, 2);
    expect(money.discountTotal).toBeCloseTo(892.66, 2);
    expect(money.discountByOwner).toBeCloseTo(792.66, 2);
    expect(money.discountByPlatform).toBeCloseTo(100, 2);
    // full price + fee + GST − discounts = what buyers paid
    expect(money.fullPriceTotal + money.platformFeeCollected + money.gstRetained - money.discountTotal)
      .toBeCloseTo(money.grossCollected, 2);
    // Only the organizer's own discount reduces their share.
    expect(money.ownerShare).toBeCloseTo(998 + (4990 - 792.66) + 998, 2);
  });

  it('lists a legacy whole-venue payout without letting it change net payable', async () => {
    const venueId = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('venues').insertOne({ _id: venueId, name: 'Hall' });
    const bookingId = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('bookings').insertOne({ _id: bookingId, venue: venueId, status: 'accepted' });
    await Payout.create({
      recipient: new mongoose.Types.ObjectId(), type: 'venue_booking', referenceId: venueId, referenceModel: 'Venue',
      grossAmount: 5000, platformCommission: 0, netAmount: 5000,
      bankDetails: { accountName: 'A', accountNumber: '123456789012', ifscCode: 'HDFC0001234', bankName: 'HDFC' },
    });

    const figures = await earningsService.getListingFigures({ kind: 'venue', listingId: String(venueId) });
    expect(figures.money.netPayable).toBe(0);
    expect(figures.payout).toMatchObject({ netAmount: 5000 });
  });
});
