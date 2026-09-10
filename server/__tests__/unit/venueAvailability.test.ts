import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain CommonJS util, no types
import { isDayBlockedByOwner, dayKey } from '../../utils/venueAvailability.js';

/**
 * The rule both the booking and event create paths depend on: an owner-set
 * 'busy' block makes that whole day unavailable, so FIRA won't double-book a
 * date the owner gave away to an offline/external booking.
 */
describe('isDayBlockedByOwner', () => {
    const day = '2026-05-20';
    const busy = [{ date: day, slots: [{ startTime: '09:00', endTime: '18:00', type: 'busy' }] }];

    it('blocks a day the owner marked busy', () => {
        expect(isDayBlockedByOwner(busy, new Date(`${day}T10:00:00Z`))).toBe(true);
    });

    it('does not block other days', () => {
        expect(isDayBlockedByOwner(busy, new Date('2026-05-21T10:00:00Z'))).toBe(false);
    });

    it('treats system "booked" slots as not-owner-blocked (that path is the booking-conflict check)', () => {
        const booked = [{ date: day, slots: [{ startTime: '09:00', endTime: '18:00', type: 'booked' }] }];
        expect(isDayBlockedByOwner(booked, new Date(`${day}T10:00:00Z`))).toBe(false);
    });

    it('is safe on venues with no blockedDates (older docs)', () => {
        expect(isDayBlockedByOwner(undefined, new Date(`${day}T10:00:00Z`))).toBe(false);
        expect(isDayBlockedByOwner([], new Date(`${day}T10:00:00Z`))).toBe(false);
    });

    it('dayKey matches the YYYY-MM-DD format the calendar writes', () => {
        expect(dayKey(new Date(`${day}T23:59:00Z`))).toBe(day);
    });
});
