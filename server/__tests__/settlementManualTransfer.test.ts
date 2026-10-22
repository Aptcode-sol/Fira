/**
 * Owners are paid by manual transfer and each transfer is recorded as a
 * settlement. Net payable is the owner's share in whole rupees; there is no
 * payout step in between.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const settlementService = require('../services/settlementService');
const Payout = require('../models/Payout');

const BANK = { accountName: 'Organizer', accountNumber: '123456789012', ifscCode: 'HDFC0001234', bankName: 'HDFC' };

async function makeOrganizer(bankDetails: object | null = BANK) {
  const id = new mongoose.Types.ObjectId();
  await mongoose.connection.db!.collection('users').insertOne({
    _id: id, name: 'Organizer', email: `o${id}@example.com`, role: 'user', ...(bankDetails ? { bankDetails } : {}),
  });
  return id;
}

async function makeEvent(organizer: mongoose.Types.ObjectId) {
  const id = new mongoose.Types.ObjectId();
  await mongoose.connection.db!.collection('events').insertOne({ _id: id, name: 'Dandiya', organizer, status: 'approved' });
  return id;
}

const admin = { _id: new mongoose.Types.ObjectId(), name: 'Admin', adminRole: 'admin' };

describe('recording a manual transfer', () => {
  async function paidTicket(eventId: mongoose.Types.ObjectId, listedPrice: number) {
    await mongoose.connection.db!.collection('payments').insertOne({
      user: new mongoose.Types.ObjectId(), type: 'ticket_purchase', referenceId: eventId, referenceModel: 'Event',
      amount: listedPrice, listedPrice, platformFee: 0, gstAmount: 0, totalAmount: listedPrice,
      status: 'success', paidAt: new Date(), createdAt: new Date(),
    });
  }
  const entry = (settledAmount: number, key: string) => ({
    settledAmount, settlementReference: 'UTR629268719892', settledAt: '2026-01-01T00:00:00.000Z',
    method: 'manual', idempotencyKey: key,
  });

  it("settles against the organizer's share with no payout record", async () => {
    const eventId = await makeEvent(await makeOrganizer());
    await paidTicket(eventId, 37841.52);

    const result = await settlementService.recordEntry({
      kind: 'event', listingId: String(eventId), input: entry(37840, 'k1'), admin,
    });

    expect(result.ledger.settledToDate).toBe(37840);
    expect(result.ledger.outstandingAmount).toBe(1);
    expect(await Payout.countDocuments({})).toBe(0);

    // The share is still the ceiling: ₹2 more would overpay by ₹1.
    await expect(settlementService.recordEntry({
      kind: 'event', listingId: String(eventId), input: entry(2, 'k2'), admin,
    })).rejects.toMatchObject({ status: 409 });
  });

  it('ignores a legacy payout record: net payable stays the share', async () => {
    const organizer = await makeOrganizer();
    const eventId = await makeEvent(organizer);
    await paidTicket(eventId, 1000);
    await mongoose.connection.db!.collection('payouts').insertOne({
      recipient: organizer, type: 'event_tickets', referenceId: eventId, referenceModel: 'Event',
      grossAmount: 0, platformCommission: 0, netAmount: 0, status: 'pending', createdAt: new Date(),
    });

    const settlement = await settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) });
    expect(settlement.money.netPayable).toBe(1000);
  });
});
