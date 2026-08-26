/**
 * Task 9.5 (spec platform-interaction-fixes) — runnable check for the discount
 * date-window validation (11.14, client side). The exported helper
 * `discountWindowError` is the single source of truth used by both the Add and
 * Edit paths in DiscountCodesSection.
 *
 * Bug condition (11.14): validFrom < eventStart OR validUntil > eventEnd.
 * Expected: rejected (non-null error) when out of window.
 * Preservation (12.7): in-window dates still accepted (null error).
 *
 * Validates: Requirements 11.14, 12.7
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { discountWindowError } from '@/components/dashboard/DiscountCodesSection';

const START = '2025-06-10';
const END = '2025-06-20';

describe('11.14 discount date bounds (client)', () => {
    it('accepts dates fully inside the event window (12.7 preservation)', () => {
        expect(discountWindowError('2025-06-12', '2025-06-18', START, END)).toBeNull();
    });

    it('accepts dates exactly on the window bounds', () => {
        expect(discountWindowError(START, END, START, END)).toBeNull();
    });

    it('rejects validFrom before event start', () => {
        expect(discountWindowError('2025-06-09', '2025-06-18', START, END)).not.toBeNull();
    });

    it('rejects validUntil after event end', () => {
        expect(discountWindowError('2025-06-12', '2025-06-21', START, END)).not.toBeNull();
    });

    it('tolerates ISO datetime bounds by comparing on the date part', () => {
        expect(discountWindowError('2025-06-10', '2025-06-20', `${START}T14:00:00.000Z`, `${END}T23:00:00.000Z`)).toBeNull();
    });

    // Property (Property 10): rejected iff out of window, across the domain.
    it('rejected iff (validFrom < eventStart OR validUntil > eventEnd)', () => {
        const day = fc.integer({ min: 1, max: 28 }).map(d => `2025-06-${String(d).padStart(2, '0')}`);
        fc.assert(
            fc.property(day, day, day, day, (from, until, s, e) => {
                const err = discountWindowError(from, until, s, e);
                const outOfWindow = from < s || until > e;
                expect(err !== null).toBe(outOfWindow);
            }),
        );
    });
});
