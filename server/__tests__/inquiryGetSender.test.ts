/**
 * Task 5.2 — getSenderInquiries({ userId }) runnable check.
 *
 * The smallest thing that fails if the sender-list logic breaks:
 *   - returns ONLY the caller's own enquiries (scoped by `user` — Req 7.3)
 *   - newest-first (Req 7.1)
 *   - normalizeStatus is applied: stored 'responded' with no replyText reads 'pending' (Req 10.2)
 *   - the owner's reply carries through when present (Req 7.2)
 *
 * Feature: event-venue-enquiries, Task 5.2: getSenderInquiries sender-only scoped list
 * Validates: Requirements 7.1, 7.2, 7.3
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const inquiryService = require('../services/inquiryService');
const Inquiry = require('../models/Inquiry');

async function makeInquiry(
  userId: mongoose.Types.ObjectId,
  fields: Partial<{ status: string; replyText: string | null; createdAt: Date }>,
) {
  const doc = await Inquiry.create({
    referenceType: 'venue',
    referenceId: new mongoose.Types.ObjectId(),
    senderName: 'Sender',
    senderEmail: 'sender@example.com',
    message: 'A valid enquiry message.',
    user: userId,
    status: fields.status ?? 'pending',
    replyText: fields.replyText ?? null,
  });
  if (fields.createdAt) {
    await Inquiry.updateOne({ _id: doc._id }, { $set: { createdAt: fields.createdAt } });
  }
  return doc;
}

describe('getSenderInquiries — sender-only scoped list (Req 7.1, 7.2, 7.3)', () => {
  it('returns only the caller\'s enquiries, newest-first', async () => {
    const me = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();

    const older = await makeInquiry(me, { createdAt: new Date('2020-01-01') });
    const newer = await makeInquiry(me, { createdAt: new Date('2020-06-01') });
    await makeInquiry(other, { createdAt: new Date('2020-03-01') }); // must be excluded

    const inquiries = await inquiryService.getSenderInquiries({ userId: me });

    expect(inquiries.map((i: any) => String(i._id))).toEqual([
      String(newer._id),
      String(older._id),
    ]);
  });

  it('carries through the owner reply when present', async () => {
    const me = new mongoose.Types.ObjectId();
    await makeInquiry(me, { status: 'responded', replyText: 'here is my answer' });

    const inquiries = await inquiryService.getSenderInquiries({ userId: me });

    expect(inquiries).toHaveLength(1);
    expect(inquiries[0].status).toBe('responded');
    expect(inquiries[0].replyText).toBe('here is my answer');
  });

  it('normalizeStatus wins: stored responded with no replyText reads pending', async () => {
    const me = new mongoose.Types.ObjectId();
    await makeInquiry(me, { status: 'responded', replyText: null });

    const inquiries = await inquiryService.getSenderInquiries({ userId: me });

    expect(inquiries[0].status).toBe('pending');
  });
});
