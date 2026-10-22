/**
 * settlementService.raisePayout — the admin types the payout amount; no
 * commission is taken from it, and it becomes the listing's net payable.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const settlementService = require('../services/settlementService');
const Payout = require('../models/Payout');
const AuditLog = require('../models/AuditLog');

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

describe('raisePayout', () => {
  it('records exactly the typed amount with no commission and makes it the net payable', async () => {
    const organizer = await makeOrganizer();
    const eventId = await makeEvent(organizer);

    const result = await settlementService.raisePayout({
      kind: 'event', listingId: String(eventId), input: { amount: 35000, notes: 'agreed on call' }, admin,
    });

    expect(result.payout).toMatchObject({ status: 'pending', netAmount: 35000 });
    const payout = await Payout.findById(result.payout.payoutId).lean();
    expect(payout).toMatchObject({
      grossAmount: 35000, platformCommission: 0, platformCommissionPercentage: 0, netAmount: 35000,
      referenceModel: 'Event', type: 'event_tickets', notes: 'agreed on call',
    });
    expect(String(payout.recipient)).toBe(String(organizer));
    expect(String(payout.initiatedBy)).toBe(String(admin._id));
    expect(await AuditLog.countDocuments({ action: 'payout', entityId: eventId })).toBe(1);

    const settlement = await settlementService.getListingSettlement({ kind: 'event', listingId: String(eventId) });
    expect(settlement.money.netPayable).toBe(35000);
    expect(settlement.money.outstandingAmount).toBe(35000);
  });

  it('rejects a non-whole or non-positive amount and writes nothing', async () => {
    const eventId = await makeEvent(await makeOrganizer());
    for (const amount of [0, -5, 10.5, '1000', undefined]) {
      await expect(settlementService.raisePayout({ kind: 'event', listingId: String(eventId), input: { amount }, admin }))
        .rejects.toMatchObject({ status: 400, field: 'amount' });
    }
    expect(await Payout.countDocuments({})).toBe(0);
  });

  it('refuses an owner without valid bank details', async () => {
    const eventId = await makeEvent(await makeOrganizer(null));
    await expect(settlementService.raisePayout({ kind: 'event', listingId: String(eventId), input: { amount: 1000 }, admin }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/bank details/) });
    expect(await Payout.countDocuments({})).toBe(0);
  });
});
