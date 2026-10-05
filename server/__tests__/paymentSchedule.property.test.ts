/**
 * Feature: venue-booking-payment-schedule — the pure schedule-decision core.
 *
 * Under test: `utils/paymentSchedule.build(now, bookingDate, startTime, totalAmount)`
 * plus its `eventStartAt` / `hoursUntilEvent` helpers. The module is DB-free, so
 * these run without Mongo — matching the design's "pure core, tested once"
 * intent (Testing Strategy).
 *
 * The generator derives `now` FROM the event start rather than from wall-clock:
 * `eventStartAt` combines bookingDate + "HH:MM" and zeroes seconds/ms via
 * setHours, so the only way to control Hours_Until_Event to the hour is to
 * anchor on the real event-start instant and subtract the offset. That makes the
 * threshold boundary (=168 vs 168.0001) exact and deterministic instead of
 * flaky-on-clock.
 *
 * Three properties, one per requirement cluster:
 *   Property 1 — split invariant: deposit + balance === total, deposit is 10%.
 *   Property 2 — type threshold: installment iff hours > 168 (with the 168 and
 *                just-over-168 boundaries asserted explicitly).
 *   Property 3 — deadline: balanceDueAt === eventStart − 24h.
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 10.2 — Correctness Properties 1, 2, 3.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const paymentSchedule = require('../utils/paymentSchedule');
const { roundMoney } = require('../utils/money');
const {
  build,
  eventStartAt,
  hoursUntilEvent,
  INSTALLMENT_THRESHOLD_HOURS,
  BALANCE_DUE_HOURS_BEFORE,
  DEPOSIT_RATE,
} = paymentSchedule;

const MS_PER_HOUR = 3600 * 1000;
const THRESHOLD = INSTALLMENT_THRESHOLD_HOURS; // 168

// --- generators ------------------------------------------------------------

// Realistic rupee totals: ₹1 up to ₹10,00,000, in paise increments so the
// rounding convention is genuinely exercised (not just whole rupees).
const totalAmount = fc
  .integer({ min: 100, max: 100_000_000 })
  .map((paise) => paise / 100);

// A base calendar date for the event (any day; the time-of-day comes from
// startTime). Range kept to plausible booking dates.
const bookingDate = fc
  .date({
    min: new Date('2024-01-01T00:00:00Z'),
    max: new Date('2030-12-31T00:00:00Z'),
    noInvalidDate: true, // Invalid Date is out of scope for the pure schedule core.
  })
  .map((d) => {
    // Strip to a plain date-ish value; eventStartAt will re-apply the time.
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  });

const startTime = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** now placed exactly `hours` before the event start (to the millisecond). */
function nowAtHoursBefore(date: Date, time: string, hours: number): Date {
  return new Date(eventStartAt(date, time).getTime() - hours * MS_PER_HOUR);
}

// --- Property 1: split invariant ------------------------------------------

describe('Property 1 — installment split: deposit + balance === total, deposit is 10%', () => {
  it('holds for random totals with an event clearly beyond 168h', () => {
    fc.assert(
      fc.property(
        totalAmount,
        bookingDate,
        startTime,
        // Well beyond the threshold so every case is an installment (Req 1.2).
        fc.integer({ min: THRESHOLD + 1, max: 24 * 365 }),
        (total, date, time, hoursAhead) => {
          const now = nowAtHoursBefore(date, time, hoursAhead);
          const s = build(now, date, time, total);

          expect(s.type).toBe('installment');
          // deposit is exactly 10% under the paise-rounding convention.
          expect(s.depositAmount).toBe(roundMoney(total * DEPOSIT_RATE));
          // balance is the remainder, so the split reconstructs the total exactly.
          expect(roundMoney(s.depositAmount + s.balanceAmount)).toBe(roundMoney(total));
          expect(s.depositAmount + s.balanceAmount).toBeCloseTo(total, 2);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// --- Property 2: type threshold -------------------------------------------

describe('Property 2 — type is installment iff Hours_Until_Event > 168', () => {
  it('flips exactly at the 168h threshold across random offsets', () => {
    fc.assert(
      fc.property(
        totalAmount,
        bookingDate,
        startTime,
        // Offsets on both sides of the threshold, in whole hours.
        fc.integer({ min: 1, max: 24 * 365 }),
        (total, date, time, hoursAhead) => {
          const now = nowAtHoursBefore(date, time, hoursAhead);
          const s = build(now, date, time, total);
          const hrs = hoursUntilEvent(now, date, time);

          // The generator anchors now on event start, so hrs === hoursAhead to
          // floating tolerance; the type must agree with the > 168 rule.
          expect(hrs).toBeCloseTo(hoursAhead, 6);
          if (hoursAhead > THRESHOLD) {
            expect(s.type).toBe('installment');
          } else {
            expect(s.type).toBe('full');
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('boundary: exactly 168h ⇒ full; just over 168h ⇒ installment', () => {
    fc.assert(
      fc.property(totalAmount, bookingDate, startTime, (total, date, time) => {
        // Exactly on the threshold — Req 10.2 says "not farther than 7 days" ⇒ full.
        const at168 = build(nowAtHoursBefore(date, time, THRESHOLD), date, time, total);
        expect(at168.type).toBe('full');
        expect(at168.balanceAmount).toBe(0);
        expect(at168.balanceDueAt).toBeNull();
        expect(at168.balanceStatus).toBe('not_applicable');

        // A hair over the threshold — installment (Req 1.2).
        const justOver = build(
          nowAtHoursBefore(date, time, THRESHOLD + 0.0001),
          date,
          time,
          total
        );
        expect(justOver.type).toBe('installment');
        expect(justOver.balanceStatus).toBe('pending');
      }),
      { numRuns: 200 }
    );
  });
});

// --- Property 3: balance deadline -----------------------------------------

describe('Property 3 — balanceDueAt === eventStart − 24h for installments', () => {
  it('holds for random installment bookings', () => {
    fc.assert(
      fc.property(
        totalAmount,
        bookingDate,
        startTime,
        fc.integer({ min: THRESHOLD + 1, max: 24 * 365 }),
        (total, date, time, hoursAhead) => {
          const now = nowAtHoursBefore(date, time, hoursAhead);
          const s = build(now, date, time, total);

          expect(s.type).toBe('installment');
          expect(s.balanceDueAt).toBeInstanceOf(Date);
          expect(s.balanceDueAt.getTime()).toBe(
            eventStartAt(date, time).getTime() - BALANCE_DUE_HOURS_BEFORE * MS_PER_HOUR
          );
        }
      ),
      { numRuns: 300 }
    );
  });
});
