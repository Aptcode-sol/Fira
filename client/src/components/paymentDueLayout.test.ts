// Validates: Requirements 8.4, 8.5 — Property 8
//
// Property 8: the widget layout is a swipeable container iff the count of
// qualifying bookings is > 2, and stacked otherwise; a count of 0 renders
// nothing. The crux is the exclusive threshold at 2/3.

import { describe, it, expect } from 'vitest';
import { widgetLayout } from './paymentDueLayout';

describe('widgetLayout — count threshold (Property 8)', () => {
    it('renders nothing when nothing qualifies', () => {
        expect(widgetLayout(0)).toBe('none');
    });

    it('stacks 1 and 2 qualifying bookings', () => {
        expect(widgetLayout(1)).toBe('stacked');
        expect(widgetLayout(2)).toBe('stacked');
    });

    it('switches to swipeable the moment the count exceeds two (3..10)', () => {
        for (let count = 3; count <= 10; count++) {
            expect(widgetLayout(count)).toBe('swipeable');
        }
    });
});
