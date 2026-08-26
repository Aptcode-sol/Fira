/**
 * Task 5.3 — markReplySeen({ inquiryId, requester }) runnable check.
 *
 * The smallest thing that fails if the mark-seen logic breaks:
 *   - the sender marking seen sets senderSeenReply = true (Req 7.4)
 *   - a non-sender is rejected with 403 (server-side authorization)
 *   - repeating the operation leaves the state unchanged (idempotent — Property 13)
 *
 * Feature: event-venue-enquiries, Task 5.3: markReplySeen sender-only, idempotent
 * Validates: Requirements 7.4
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const inquiryService = require('../services/inquiryService');
const Inquiry = require('../models/Inquiry');

async function makeReplied(userId: mongoose.Types.ObjectId) {
  return Inquiry.create({
    referenceType: 'venue',
    referenceId: new mongoose.Types.ObjectId(),
    senderName: 'Sender',
    senderEmail: 'sender@example.com',
    message: 'A valid enquiry message.',
    user: userId,
    status: 'responded',
    replyText: 'here is my answer',
  });
}

describe('markReplySeen — sender-only, idempotent (Req 7.4)', () => {
  it('sets senderSeenReply = true when the sender marks it seen', async () => {
    const me = new mongoose.Types.ObjectId();
    const inquiry = await makeReplied(me);
    expect(inquiry.senderSeenReply).toBe(false);

    const updated = await inquiryService.markReplySeen({ inquiryId: inquiry._id, requester: me });

    expect(updated.senderSeenReply).toBe(true);
  });

  it('rejects a non-sender with 403', async () => {
    const me = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();
    const inquiry = await makeReplied(me);

    await expect(
      inquiryService.markReplySeen({ inquiryId: inquiry._id, requester: other }),
    ).rejects.toMatchObject({ status: 403 });

    const fresh = await Inquiry.findById(inquiry._id);
    expect(fresh.senderSeenReply).toBe(false); // unauthorized call left state untouched
  });

  it('is idempotent: a second call leaves the state unchanged', async () => {
    const me = new mongoose.Types.ObjectId();
    const inquiry = await makeReplied(me);

    await inquiryService.markReplySeen({ inquiryId: inquiry._id, requester: me });
    const second = await inquiryService.markReplySeen({ inquiryId: inquiry._id, requester: me });

    expect(second.senderSeenReply).toBe(true);
  });

  it('404s when the enquiry does not exist', async () => {
    await expect(
      inquiryService.markReplySeen({
        inquiryId: new mongoose.Types.ObjectId(),
        requester: new mongoose.Types.ObjectId(),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
