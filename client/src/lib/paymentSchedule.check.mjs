// Runnable self-check for the payment-schedule display core. No framework, no
// fixtures — run with:
//   node src/lib/paymentSchedule.check.mjs
//
// Imports the SAME functions the app uses (paymentScheduleCore.mjs), so this
// guards the real logic, not a copy. Two things carry the whole widget:
//   - daysUntil rounds whole days the way the reminder job does (Req 8.7)
//   - describeSchedule picks the right branch (full vs installment) (Req 1.6)
import assert from 'node:assert/strict';
import { daysUntil, describeSchedule, describeScheduleText } from './paymentScheduleCore.mjs';

const DAY = 86_400_000;
const now = new Date('2025-01-01T00:00:00.000Z');
const at = (ms) => new Date(now.getTime() + ms);

/* ---- daysUntil: rounding boundaries (the whole reason this convention exists) ---- */

// Exactly one day out is 1 day, not 0 — a full remaining day rounds to 1.
assert.equal(daysUntil(at(DAY), now), 1, 'exactly 1 day → 1');

// One day plus a single millisecond crosses into the second day (Math.ceil).
assert.equal(daysUntil(at(DAY + 1), now), 2, '1 day + 1ms → 2');

// One millisecond short of a day is still within the first day → rounds up to 1.
assert.equal(daysUntil(at(DAY - 1), now), 1, '1ms under a day → 1');

// The exact deadline is 0 — the day has arrived, nothing left to count.
assert.equal(daysUntil(at(0), now), 0, 'due right now → 0');

// A past due date never goes negative; the UI must never show "-3 days".
assert.equal(daysUntil(at(-DAY), now), 0, 'past due → 0 (never negative)');
assert.equal(daysUntil(at(-5 * DAY), now), 0, 'well past due → 0');

// A week out is 7 whole days.
assert.equal(daysUntil(at(7 * DAY), now), 7, '7 days → 7');

// null / invalid input is 0, never NaN — a NaN would render as "NaN days".
assert.equal(daysUntil(null, now), 0, 'null → 0');
assert.equal(daysUntil(undefined, now), 0, 'undefined → 0');
assert.equal(daysUntil('not-a-date', now), 0, 'garbage string → 0');

// Accepts both a Date and an ISO string for the same instant.
assert.equal(daysUntil(at(3 * DAY), now), daysUntil(at(3 * DAY).toISOString(), now));

/* ---- describeSchedule: branch selection (Req 1.6) ---- */

// Installment surfaces deposit / balance / due-date, not a single full amount.
const inst = describeSchedule(
    { type: 'installment', depositAmount: 500, balanceAmount: 4500, balanceDueAt: '2025-02-01T00:00:00.000Z' },
    5000
);
assert.deepEqual(inst, {
    type: 'installment',
    depositAmount: 500,
    balanceAmount: 4500,
    balanceDueAt: '2025-02-01T00:00:00.000Z',
}, 'installment → deposit/balance/due-date');

// Full surfaces one fullAmount — taken from the deposit (deposit = total for full).
const full = describeSchedule({ type: 'full', depositAmount: 5000, balanceAmount: 0, balanceDueAt: null }, 5000);
assert.deepEqual(full, { type: 'full', fullAmount: 5000 }, 'full → single fullAmount');

// Missing schedule (legacy booking) falls back to a full display of the total.
assert.deepEqual(describeSchedule(null, 1234), { type: 'full', fullAmount: 1234 }, 'no schedule → full of totalAmount');
assert.deepEqual(describeSchedule(undefined, 1234), { type: 'full', fullAmount: 1234 });

// No schedule and no total is a full display of 0, never a blank/NaN.
assert.deepEqual(describeSchedule(null), { type: 'full', fullAmount: 0 }, 'nothing → full of 0');

// A partial object with no type is treated as missing → full fallback.
assert.deepEqual(describeSchedule({ depositAmount: 9 }, 42), { type: 'full', fullAmount: 42 }, 'no type → fallback');

/* ---- describeScheduleText: rendered strings, formatter injected ---- */

const fmt = (n) => `₹${n}`;
assert.equal(
    describeScheduleText({ type: 'installment', depositAmount: 500, balanceAmount: 4500, balanceDueAt: null }, fmt),
    'Deposit ₹500 now · Balance ₹4500',
    'installment text without a due date omits the date',
);
assert.equal(
    describeScheduleText({ type: 'full', depositAmount: 5000 }, fmt),
    'Full amount due: ₹5000',
    'full text',
);
assert.equal(describeScheduleText(null, fmt, 777), 'Full amount due: ₹777', 'fallback text uses totalAmount');

console.log('paymentSchedule.check.mjs: all assertions passed');
