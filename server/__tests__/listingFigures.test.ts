/**
 * Task 2.3 — earningsService.getListingFigures boundary checks.
 *
 * Two named boundaries, and nothing else:
 *   1. A listing with successful payments but no Payout record reports
 *      netPayable: 0 and payout: null — the design's stated consequence
 *      (design decision 1, Requirement 1.7). Buyer-side figures still come
 *      through, so this is a real "payout not initiated yet" listing, not an
 *      empty one.
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
  it('reports netPayable 0 and payout null while still reporting buyer-side money', async () => {
    const eventId = await makeEvent();
    await makeSuccessfulPayment(eventId);
    await makeSuccessfulPayment(eventId, { amount: 2000, platformFee: 100, gstAmount: 360, totalAmount: 2360 });
    expect(await Payout.countDocuments({ referenceId: eventId })).toBe(0);

    const figures = await earningsService.getListingFigures({ kind: 'event', listingId: String(eventId) });

    // Owner side is empty because no payout has been raised — not invented from
    // a percentage of the collected gross (Requirement 12.1).
    expect(figures.money.ownerGross).toBe(0);
    expect(figures.money.platformCommission).toBe(0);
    expect(figures.money.netPayable).toBe(0);
    expect(figures.payout).toBeNull();

    // ...but the listing is genuinely earning, so buyer-side figures are present.
    expect(figures.money.grossCollected).toBe(1180 + 2360);
    expect(figures.money.platformFeeCollected).toBe(150);
    expect(figures.money.gstRetained).toBe(540);
    expect(figures.activity.successfulPayments).toBe(2);
    expect(figures.activity.lastPaymentAt).toBeInstanceOf(Date);
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
      grossCollected: 1180, platformFeeCollected: 50, gstRetained: 180,
      ownerGross: 1000, platformCommission: 50, netPayable: 950, refundedTotal: 0,
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
    // A count is a settlement justification too, so it fails closed the same way.
    expect(() =>
      earningsService.buildListingFigures({ money, activity: { ...activity, unitsSold: undefined }, payout: null }),
    ).toThrow(/unitsSold/);
  });
});
