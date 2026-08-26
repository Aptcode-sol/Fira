/**
 * Task 1.3 — status normalization on the enquiry read path.
 *
 * normalizeStatus(inquiry) is a pure helper: it returns a shallow-cloned object
 * whose `status` is forced to 'pending' whenever `replyText == null`, and left
 * unchanged otherwise. Reply content (not the stored status) is authoritative
 * for whether an enquiry has been answered, so an inconsistent stored
 * 'responded'/'closed' with no reply is auto-corrected to 'pending' on read.
 *
 * Pure helper => no DB needed.
 *
 * Feature: event-venue-enquiries, Property 12: Reply content is authoritative over stored status
 * Validates: Requirements 10.2
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const { normalizeStatus } = require('../services/inquiryService');

const STORED_STATUS = fc.constantFrom('pending', 'responded', 'closed');
// replyText is either "no reply" (null/undefined) or a non-empty string.
const REPLY = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 2000 }),
);

describe('normalizeStatus — Property 12: reply content is authoritative over stored status', () => {
  it('presents status as pending iff replyText is null/undefined, without mutating the input', () => {
    fc.assert(
      fc.property(STORED_STATUS, REPLY, (status, replyText) => {
        const input = { status, replyText, message: 'x', senderName: 'S' };
        const before = JSON.stringify(input);

        const out = normalizeStatus(input);

        if (replyText == null) {
          // authoritative: no reply => pending, regardless of the stored status
          expect(out.status).toBe('pending');
        } else {
          // has reply => stored status is left untouched
          expect(out.status).toBe(status);
        }
        // pure: input is never mutated
        expect(JSON.stringify(input)).toBe(before);
        // clone, not the same reference
        expect(out).not.toBe(input);
      }),
      { numRuns: 100 },
    );
  });
});
