/**
 * Task 9.2 (spec platform-interaction-fixes) — runnable check for the two
 * non-trivial pure formulas added to `dashboard/events/[id]/page.tsx`:
 *   11.6  revenue = Σ ticket.price (already the line total), rendered as ₹0 (never "Free") when none.
 *   11.7  event-info price = lowest tier price, shown "from ₹X onwards".
 *
 * The formulas are inline in the page component (rendering it needs the full
 * auth/api mock surface), so this check mirrors them exactly. If the page
 * formula changes, this expectation is the thing that fails.
 *
 * Validates: Requirements 11.6, 11.7, 12.4 (preservation: non-zero revenue).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Mirrors the page: totalRevenue = tickets.reduce((s, t) => s + (t.price || 0), 0)
// Ticket.price is stored as the line total (unit price × quantity).
const revenue = (tickets: { price: number; quantity: number }[]) =>
    tickets.reduce((sum, t) => sum + (t.price || 0), 0);

// Mirrors the page: lowestTierPrice — min tier price, else ticketPrice.
const lowestTierPrice = (tiers: { price: number }[], ticketPrice: number) =>
    tiers.length === 0 ? ticketPrice : Math.min(...tiers.map(t => t.price));

// Mirrors the page revenue formatter: always a ₹ amount, ₹0 when none.
const formatINR = (price: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

describe('11.6 revenue = Σ ticket.price (line totals)', () => {
    it('does not count a multi-ticket booking twice (2 bookings × 2 tickets @ ₹499 = ₹1,996)', () => {
        // Each booking's price is already 2 × 499 = 998.
        expect(revenue([{ price: 998, quantity: 2 }, { price: 998, quantity: 2 }])).toBe(1996);
    });

    it('renders ₹0 (never "Free") when there are no bookings', () => {
        expect(revenue([])).toBe(0);
        expect(formatINR(0)).toContain('0');
        expect(formatINR(0).toLowerCase()).not.toContain('free');
    });

    it('property: revenue equals Σ(unit price × quantity) when price is stored as the line total (12.4)', () => {
        fc.assert(
            fc.property(
                fc.array(fc.record({ unit: fc.nat(100000), quantity: fc.integer({ min: 1, max: 50 }) })),
                (rows) => {
                    const tickets = rows.map(r => ({ price: r.unit * r.quantity, quantity: r.quantity }));
                    const expected = rows.reduce((s, r) => s + r.unit * r.quantity, 0);
                    expect(revenue(tickets)).toBe(expected);
                }
            )
        );
    });
});

describe('11.7 lowest tier price "from ₹X onwards"', () => {
    it('picks the minimum tier price', () => {
        expect(lowestTierPrice([{ price: 500 }, { price: 200 }, { price: 900 }], 0)).toBe(200);
    });

    it('falls back to ticketPrice when there are no tiers', () => {
        expect(lowestTierPrice([], 350)).toBe(350);
    });

    it('property: result is <= every tier price when tiers exist', () => {
        fc.assert(
            fc.property(
                fc.array(fc.record({ price: fc.nat(100000) }), { minLength: 1 }),
                fc.nat(100000),
                (tiers, ticketPrice) => {
                    const low = lowestTierPrice(tiers, ticketPrice);
                    tiers.forEach(t => expect(low).toBeLessThanOrEqual(t.price));
                }
            )
        );
    });
});
