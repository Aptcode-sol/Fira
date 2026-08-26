/**
 * Task 4.2 — closeInquiry({ inquiryId, requester }) runnable check.
 *
 * The smallest thing that fails if the close logic breaks:
 *   - owner may close a `pending` enquiry           -> status becomes 'closed'
 *   - owner may close a `responded` enquiry          -> status becomes 'closed'
 *   - a non-owner requester is rejected with 403
 *   - closing an already-`closed` enquiry (closed -> *) is rejected with 409
 *
 * Ownership resolves venue -> owner; we insert a minimal Venue doc directly so
 * the check doesn't couple to the full Venue schema's required fields.
 *
 * Feature: event-venue-enquiries, Task 4.2: closeInquiry owner-only atomic transition
 * Validates: Requirements 8.3, 8.4, 12.3
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const inquiryService = require('../services/inquiryService');
const Inquiry = require('../models/Inquiry');

async function makeVenueOwnedBy(ownerId: mongoose.Types.ObjectId) {
  const venueId = new mongoose.Types.ObjectId();
  // Raw insert to avoid the full Venue schema's required-field surface.
  await mongoose.connection.db!
    .collection('venues')
    .insertOne({ _id: venueId, owner: ownerId, status: 'approved' });
  return venueId;
}

async function makeInquiry(
  venueId: mongoose.Types.ObjectId,
  status: 'pending' | 'responded' | 'closed',
) {
  return Inquiry.create({
    referenceType: 'venue',
    referenceId: venueId,
    senderName: 'Sender',
    senderEmail: 'sender@example.com',
    message: 'A valid enquiry message.',
    status,
  });
}

describe('closeInquiry — owner-only atomic transition to closed (Req 8.3, 8.4, 12.3)', () => {
  it('owner closes a pending enquiry', async () => {
    const owner = new mongoose.Types.ObjectId();
    const venueId = await makeVenueOwnedBy(owner);
    const inquiry = await makeInquiry(venueId, 'pending');

    const updated = await inquiryService.closeInquiry({ inquiryId: inquiry._id, requester: owner });

    expect(updated.status).toBe('closed');
  });

  it('owner closes a responded enquiry', async () => {
    const owner = new mongoose.Types.ObjectId();
    const venueId = await makeVenueOwnedBy(owner);
    const inquiry = await makeInquiry(venueId, 'responded');

    const updated = await inquiryService.closeInquiry({ inquiryId: inquiry._id, requester: owner });

    expect(updated.status).toBe('closed');
  });

  it('rejects a non-owner requester with 403', async () => {
    const owner = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    const venueId = await makeVenueOwnedBy(owner);
    const inquiry = await makeInquiry(venueId, 'pending');

    await expect(
      inquiryService.closeInquiry({ inquiryId: inquiry._id, requester: stranger }),
    ).rejects.toMatchObject({ status: 403 });

    // unchanged
    const after = await Inquiry.findById(inquiry._id);
    expect(after.status).toBe('pending');
  });

  it('rejects closing an already-closed enquiry (closed -> *) with 409', async () => {
    const owner = new mongoose.Types.ObjectId();
    const venueId = await makeVenueOwnedBy(owner);
    const inquiry = await makeInquiry(venueId, 'closed');

    await expect(
      inquiryService.closeInquiry({ inquiryId: inquiry._id, requester: owner }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
