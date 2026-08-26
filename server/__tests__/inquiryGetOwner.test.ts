/**
 * Task 5.1 — getOwnerInquiries({ requester, referenceType, referenceId, statusFilter })
 * runnable check.
 *
 * The smallest thing that fails if the owner-list logic breaks:
 *   - owner gets their listing's enquiries newest-first
 *   - authoritative pending count = enquiries with replyText == null
 *   - a non-owner requester is rejected with 403 (never an empty list — Req 4.4)
 *   - optional status filter narrows by NORMALIZED status
 *   - normalizeStatus is applied: a stored 'responded' with no replyText reads 'pending'
 *
 * Ownership resolves venue -> owner; we insert a minimal Venue doc directly so
 * the check doesn't couple to the full Venue schema's required fields.
 *
 * Feature: event-venue-enquiries, Task 5.1: getOwnerInquiries owner-only scoped list
 * Validates: Requirements 4.2, 4.4, 8.5, 12.3
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const inquiryService = require('../services/inquiryService');
const Inquiry = require('../models/Inquiry');

async function makeVenueOwnedBy(ownerId: mongoose.Types.ObjectId) {
  const venueId = new mongoose.Types.ObjectId();
  await mongoose.connection.db!
    .collection('venues')
    .insertOne({ _id: venueId, owner: ownerId, status: 'approved' });
  return venueId;
}

async function makeInquiry(
  venueId: mongoose.Types.ObjectId,
  fields: Partial<{ status: string; replyText: string | null; createdAt: Date }>,
) {
  const doc = await Inquiry.create({
    referenceType: 'venue',
    referenceId: venueId,
    senderName: 'Sender',
    senderEmail: 'sender@example.com',
    message: 'A valid enquiry message.',
    status: fields.status ?? 'pending',
    replyText: fields.replyText ?? null,
  });
  if (fields.createdAt) {
    await Inquiry.updateOne({ _id: doc._id }, { $set: { createdAt: fields.createdAt } });
  }
  return doc;
}

describe('getOwnerInquiries — owner-only scoped list + pending count (Req 4.2, 4.4, 8.5, 12.3)', () => {
  it('returns owner enquiries newest-first with an authoritative pending count', async () => {
    const owner = new mongoose.Types.ObjectId();
    const venueId = await makeVenueOwnedBy(owner);

    const older = await makeInquiry(venueId, { createdAt: new Date('2020-01-01') });
    const newer = await makeInquiry(venueId, {
      status: 'responded',
      replyText: 'answered',
      createdAt: new Date('2020-06-01'),
    });

    const { inquiries, pendingCount } = await inquiryService.getOwnerInquiries({
      requester: owner,
      referenceType: 'venue',
      referenceId: venueId,
    });

    // newest-first
    expect(inquiries.map((i: any) => String(i._id))).toEqual([
      String(newer._id),
      String(older._id),
    ]);
    // one has replyText == null -> authoritative pending count is 1
    expect(pendingCount).toBe(1);
  });

  it('rejects a non-owner with 403 (never an empty list — Req 4.4)', async () => {
    const owner = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    const venueId = await makeVenueOwnedBy(owner);
    await makeInquiry(venueId, {});

    await expect(
      inquiryService.getOwnerInquiries({
        requester: stranger,
        referenceType: 'venue',
        referenceId: venueId,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('applies the optional status filter against the normalized status', async () => {
    const owner = new mongoose.Types.ObjectId();
    const venueId = await makeVenueOwnedBy(owner);
    await makeInquiry(venueId, {}); // pending
    await makeInquiry(venueId, { status: 'responded', replyText: 'hi' }); // responded

    const respondedOnly = await inquiryService.getOwnerInquiries({
      requester: owner,
      referenceType: 'venue',
      referenceId: venueId,
      statusFilter: 'responded',
    });
    expect(respondedOnly.inquiries).toHaveLength(1);
    expect(respondedOnly.inquiries[0].status).toBe('responded');

    // 'all' (or undefined) returns everything
    const all = await inquiryService.getOwnerInquiries({
      requester: owner,
      referenceType: 'venue',
      referenceId: venueId,
      statusFilter: 'all',
    });
    expect(all.inquiries).toHaveLength(2);
  });

  it('normalizeStatus wins: stored responded with no replyText reads pending', async () => {
    const owner = new mongoose.Types.ObjectId();
    const venueId = await makeVenueOwnedBy(owner);
    // inconsistent stored state: status responded but no reply content
    await makeInquiry(venueId, { status: 'responded', replyText: null });

    const { inquiries, pendingCount } = await inquiryService.getOwnerInquiries({
      requester: owner,
      referenceType: 'venue',
      referenceId: venueId,
    });

    expect(inquiries[0].status).toBe('pending');
    expect(pendingCount).toBe(1);
    // and filtering by 'pending' finds it via normalized status
    const pendingView = await inquiryService.getOwnerInquiries({
      requester: owner,
      referenceType: 'venue',
      referenceId: venueId,
      statusFilter: 'pending',
    });
    expect(pendingView.inquiries).toHaveLength(1);
  });
});
