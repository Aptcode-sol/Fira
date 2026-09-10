# Design Document

## Overview

This feature replaces the flat, always-10% venue advance (`bookingService.initiateBookingPayment` → `roundMoney(booking.totalAmount * 0.10)`) with a **date-aware payment schedule** decided once, at booking-request time:

- **Event more than 7 days (168h) away** → `installment` schedule: 10% deposit now, 90% balance due 168h before the event.
- **Event 7 days away or closer (≤168h)** → `full` schedule: 100% now.
- **Balance unpaid past its deadline** → automatic cancellation + deposit forfeiture (a distinct outcome, *not* the venue `cancellationPolicy` refund tiers).
- While a balance is pending → daily email + push reminders and a floating "Pay Now" widget on the venue page.

The design deliberately reuses what already exists rather than inventing parallel machinery:

| Need | Reuse | Not build |
|------|-------|-----------|
| Money rounding | `utils/money.roundMoney` | new rounding |
| Charge collection | `paymentService.initiatePayment` / `verifyPayment` (the exact pattern deposit already uses) | new gateway integration |
| Time-until-event convention | the `bookingDate` + `startTime` combine already in `venueService.processCancellation` | new date math |
| Cron registration | `jobs/scheduledJobs.js` (`initScheduledJobs`, `node-cron`) | new scheduler |
| Notifications (in-app + push + SSE) | `notificationService.createNotification({ channel: 'all' })` | new push path |
| Reminder email | `emailService` (same style as `sendEventReminderEmail`) | new mail transport |
| Client advance display | `client/src/lib/venuePricing.bookingAdvance` | new pricing calc |
| Mobile safe-area / bottom-nav clearance | `env(safe-area-inset-bottom)` + `5rem` nav reserve convention | new layout system |

The schedule **type is frozen at booking creation** (Req 10.3): the whole decision reduces to one pure function of `(now, bookingDate, startTime, totalAmount)`, and the booking stores the result. Nothing recomputes the type later.

## Architecture

```
                          BOOKING CREATION (schedule decided once)
  Client booking modal ──POST /api/bookings──▶ bookingService.createBooking
                                                     │
                                          paymentSchedule.build(now, date, startTime, total)
                                                     │  (pure — utils/paymentSchedule.js)
                                                     ▼
                                        Booking.paymentSchedule { type, deposit,
                                          balance, balanceDueAt, balanceStatus }

                          DEPOSIT / FULL PAYMENT (at booking)
  Client ──initiate-payment──▶ bookingService.initiateBookingPayment
                                     │ charge = schedule.type==='installment' ? deposit : total
                                     ▼ paymentService.initiatePayment ──▶ Razorpay
  Client ──verify-payment───▶ bookingService.completeBookingPayment  (status→accepted)

                          BALANCE PAYMENT (before deadline)
  Client widget ──initiate-balance-payment──▶ bookingService.initiateBalancePayment
                                     │ guard: type==='installment' && balanceStatus==='pending'
                                     ▼ paymentService.initiatePayment ──▶ Razorpay
  Client ──verify-balance-payment──▶ bookingService.completeBalancePayment (balanceStatus→paid)

                          SCHEDULED (jobs/scheduledJobs.js, node-cron)
  daily  ─▶ sendBalanceReminders()   → notificationService (email+push), skip past-deadline
  hourly ─▶ enforceBalanceDeadlines() → atomic claim, cancel+forfeit+release date+notify

                          CLIENT WIDGET
  VenueDetailClient ─▶ PaymentDueWidgets (fetch user's installment/pending bookings at venue)
                          ├─ ≤2 → stacked   |  >2 → swipeable container
                          └─ bottom-right, above mobile bottom nav (safe-area inset)
```

### Why a pure `utils/paymentSchedule.js`

The schedule decision, the deadline, and the split are the correctness-critical core (Properties 1–3). Isolating them in a pure, DB-free module means the property tests QA writes run without Mongo, mirroring the existing `*.check.mjs` / `*.property.mjs` convention already in the repo (`money.check.mjs`, `listingSettlementState.property.mjs`). Ponytail: one function, tested once, called from `createBooking`.

## Components and Interfaces

### 1. `server/utils/paymentSchedule.js` (new, pure)

```js
const { roundMoney } = require('./money');

const INSTALLMENT_THRESHOLD_HOURS = 168; // 7 days
const DEPOSIT_RATE = 0.10;
const MS_PER_HOUR = 3600 * 1000;

/**
 * Combine bookingDate + "HH:MM" startTime into one Date, matching the exact
 * convention in venueService.processCancellation (Req 10.1).
 */
function eventStartAt(bookingDate, startTime) {
    const d = new Date(bookingDate);
    const [h, m] = String(startTime).split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
}

/** Hours between `now` and event start. (Req 1.1) */
function hoursUntilEvent(now, bookingDate, startTime) {
    return (eventStartAt(bookingDate, startTime).getTime() - now.getTime()) / MS_PER_HOUR;
}

/**
 * The frozen schedule for a booking. > 168h ⇒ installment; ≤ 168h ⇒ full.
 * Exactly 168h is treated as "not farther than 7 days" ⇒ full (Req 10.2).
 * Returns the sub-document stored on Booking.paymentSchedule.
 */
function build(now, bookingDate, startTime, totalAmount) {
    const hrs = hoursUntilEvent(now, bookingDate, startTime);
    if (hrs > INSTALLMENT_THRESHOLD_HOURS) {
        const deposit = roundMoney(totalAmount * DEPOSIT_RATE);
        return {
            type: 'installment',
            depositAmount: deposit,
            balanceAmount: roundMoney(totalAmount - deposit), // remainder, so deposit+balance===total exactly
            balanceDueAt: new Date(eventStartAt(bookingDate, startTime).getTime()
                - INSTALLMENT_THRESHOLD_HOURS * MS_PER_HOUR), // Req 1.4 / Property 3
            balanceStatus: 'pending',
        };
    }
    return {
        type: 'full',
        depositAmount: roundMoney(totalAmount),
        balanceAmount: 0,
        balanceDueAt: null,
        balanceStatus: 'not_applicable',
    };
}

module.exports = { build, hoursUntilEvent, eventStartAt, INSTALLMENT_THRESHOLD_HOURS, DEPOSIT_RATE };
```

The `balanceAmount` is `total − deposit` (the remainder), not an independent `total × 0.90`, so `deposit + balance === total` holds exactly under rounding (Property 1).

### 2. `server/models/Booking.js` (extend)

Add one embedded sub-document. All existing bookings keep working — the schema default makes legacy bookings `full` / `not_applicable`, so no migration and no reminder/enforcement job ever touches them.

```js
paymentSchedule: {
    type: { type: String, enum: ['full', 'installment'], default: 'full' },
    depositAmount: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 },
    balanceDueAt: { type: Date, default: null },
    balanceStatus: {
        type: String,
        enum: ['not_applicable', 'pending', 'paid', 'forfeited'],
        default: 'not_applicable'
    },
    balancePayment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    lastReminderOn: { type: String, default: null } // 'YYYY-MM-DD', for once-per-day dedupe (Req 7.1)
},
cancellationReason: { type: String, default: null } // e.g. 'missed_payment_deadline' (Req 4.1)
```

New index to make both jobs cheap and let the enforcement claim be a targeted atomic update:

```js
bookingSchema.index({ 'paymentSchedule.balanceStatus': 1, 'paymentSchedule.balanceDueAt': 1 });
```

### 3. `server/services/bookingService.js` (modify)

**`createBooking`** — build and attach the schedule before `Booking.create`:

```js
const paymentSchedule = require('../utils/paymentSchedule');
// ...inside createBooking, before Booking.create(data):
data.paymentSchedule = paymentSchedule.build(new Date(), data.bookingDate, data.startTime, data.totalAmount);
```

**`initiateBookingPayment`** — replace the hardcoded 10% with schedule-driven amount. This is the smallest change to the existing method: the `advanceAmount` line becomes schedule-aware; everything downstream (billing, Razorpay, `platformFee` save) is unchanged.

```js
const { type, depositAmount } = booking.paymentSchedule;
const chargeSubtotal = type === 'installment' ? depositAmount : roundMoney(booking.totalAmount);
const billing = paymentService.calculateBilling(chargeSubtotal, 1, feePct);
// ...unchanged initiatePayment call, but response returns depositAmount / balanceAmount / balanceDueAt
```

**`initiateBalancePayment(bookingId, userId)`** (new) — mirrors `initiateBookingPayment`:

- Load booking, assert ownership.
- Guard (Req 3.3): `paymentSchedule.type === 'installment' && paymentSchedule.balanceStatus === 'pending'`, else throw `"No balance payment is currently due"`.
- Charge exactly `paymentSchedule.balanceAmount` (Req 3.4 — no partials; the client cannot supply an amount). Route through `calculateBilling(balanceAmount, 1, feePct)` → `paymentService.initiatePayment`.

**`completeBalancePayment(bookingId, {gateway...})`** (new) — mirrors `completeBookingPayment`:

- Verify via `paymentService.verifyPayment`.
- On success and only if still `pending` and `Date.now() < balanceDueAt`: set `paymentSchedule.balanceStatus = 'paid'`, link `balancePayment`. Stopping reminders/widgets is automatic — both are filtered on `balanceStatus === 'pending'` (Req 3.2).

### 4. `server/services/venueService.js` (modify `processCancellation`)

Two additions to the existing method, both small:

- **Block forfeited bookings (Req 6.4):** early throw if `booking.paymentSchedule.balanceStatus === 'forfeited'`.
- **Refund base = amount actually paid (Req 6.1/6.2, Property 7):** the method currently returns `{ refundType, refundPercentage }` and the refund amount is computed downstream. Add `amountPaid` to the returned object so the refund is a percentage of it:

```js
const s = booking.paymentSchedule || {};
const amountPaid = s.type === 'installment'
    ? roundMoney(s.depositAmount + (s.balanceStatus === 'paid' ? s.balanceAmount : 0))
    : roundMoney(s.depositAmount || booking.totalAmount);
// result gains: refundAmount: roundMoney(amountPaid * refundPercentage / 100)
```

The tier logic (hoursRemaining vs free/no-cancellation windows) is **unchanged** (Req 6.3).

### 5. `server/jobs/scheduledJobs.js` (extend)

Two functions added and registered inside `initScheduledJobs`, following the existing `sendEventReminders` shape (batch reads, per-item email in a try/catch, exported for tests).

**`sendBalanceReminders()` — daily (`cron '0 9 * * *'`), Req 7:**

```
today = 'YYYY-MM-DD' (server tz)
bookings = Booking.find({
    'paymentSchedule.type': 'installment',
    'paymentSchedule.balanceStatus': 'pending',
    'paymentSchedule.balanceDueAt': { $gt: now },   // Req 7.3 skip past-deadline
    'paymentSchedule.lastReminderOn': { $ne: today } // Req 7.1 once/day
}).populate('user','name email').populate('venue','name')
for each:
    daysLeft = ceil((balanceDueAt - now)/DAY)
    notificationService.createNotification({ channel:'all', ... days + balanceAmount }) // in-app+push
    emailService.sendBalanceReminderEmail(...)  // wrapped in try/catch, continue on fail (Req 7.5)
    Booking.updateOne({_id}, { $set: { 'paymentSchedule.lastReminderOn': today } })
```

`lastReminderOn` guarantees at most one email + one push per booking per calendar day and makes the job idempotent within a day (Req 7.1). Once `balanceStatus` leaves `pending`, the query excludes the booking (Req 7.4, Property 5).

**`enforceBalanceDeadlines()` — hourly (`cron '5 * * * *'`), Req 4 & 5:**

The claim and the transition are the **same atomic operation** so overlapping runs cannot double-process (Req 5.2, Property 6):

```
loop:
  claimed = Booking.findOneAndUpdate(
    { 'paymentSchedule.type':'installment',
      'paymentSchedule.balanceStatus':'pending',            // ← the claim predicate
      'paymentSchedule.balanceDueAt': { $lte: now } },
    { $set: { status:'cancelled',
              'paymentSchedule.balanceStatus':'forfeited',  // ← moves it out of 'pending'
              cancellationReason:'missed_payment_deadline' } },
    { new: false })                                          // returns pre-update doc
  if (!claimed) break
  releaseVenueDate(claimed)   // remove the booked slot from venue.blockedDates (Req 4.4)
  try { notificationService.createNotification({channel:'all', ...forfeit message}) } // Req 4.5
  catch (e) { log; do NOT undo the cancel } // Req 5.3
```

Because `balanceStatus: 'pending'` is both the selector and what the same update clears, a second concurrent `findOneAndUpdate` for the same doc matches nothing — exactly one cancellation, exactly one forfeiture (Property 6). Missed-deadline cancellations set `cancellationReason` and never touch `cancellationPolicy`, so no refund path runs (Req 4.3, Property 4).

### 6. `server/routes/booking.js` (add 2 routes)

Mirror the existing deposit routes exactly (auth, `req.user._id`):

```js
router.post('/:id/initiate-balance-payment', auth, ... bookingService.initiateBalancePayment(req.params.id, req.user._id));
router.post('/:id/verify-balance-payment',   ... bookingService.completeBalancePayment(req.params.id, req.body));
```

### 7. `server/services/emailService.js` + `utils/emailTemplates.js` (add)

`sendBalanceReminderEmail(to, name, { venueName, daysLeft, balanceAmount, balanceDueAt, bookingId })` and `sendBalanceForfeitEmail(...)`, styled with the same template helpers as the existing venue/reminder emails. Content per Req 7.2 (days remaining + amount due) and Req 4.5 (cancelled + deposit forfeited).

### 8. Client — `client/src/lib/api.ts` (extend `bookingsApi`)

```ts
initiateBalancePayment: (id, userId) => request(`/bookings/${id}/initiate-balance-payment`, { method:'POST', body: JSON.stringify({ userId }) }),
verifyBalancePayment:   (id, data)   => request(`/bookings/${id}/verify-balance-payment`,   { method:'POST', body: JSON.stringify(data) }),
```

`Booking` type in `types.ts` gains the `paymentSchedule` shape mirroring the schema.

### 9. Client — `client/src/lib/paymentSchedule.ts` (new, pure display helper)

`daysUntil(balanceDueAt)` → whole days remaining, and a `describeSchedule(booking)` returning the "deposit / balance / balance due date" or "full amount due" strings for Req 1.6 and the widget (Req 8.7). Pure, so it gets a small `.check.mjs`-style test.

### 10. Client — `PaymentDueWidgets` component (new)

Rendered by `VenueDetailClient`. On mount for an authenticated user it fetches that user's bookings and keeps those where `venue === current && paymentSchedule.type==='installment' && paymentSchedule.balanceStatus==='pending'`.

```
qualifying = userBookings.filter(installment & pending & this venue)
count = qualifying.length
if count === 0 → render nothing
container:  fixed, bottom-right
            desktop: bottom-6 right-6
            mobile:  right-4 + bottom = 5rem nav reserve + safe-area-inset-bottom
            className bottom uses: bottom-[calc(5rem+env(safe-area-inset-bottom)+0.5rem)] on mobile
if count <= 2 → stack the 1–2 PaymentDueCard(s) with gap-3 (Req 8.5, Property 8)
if count  > 2 → single small swipeable container:
                horizontal scroll-snap (overflow-x-auto snap-x snap-mandatory, one card per snap)
                + dot indicators; native touch/trackpad swipe, no new dependency (Req 8.4)
```

`PaymentDueCard`: dark bg, rounded-2xl, violet accent, existing `Button`, showing `{daysLeft} days left · ₹{balanceAmount} due` and a "Pay Now" `Button`. Activating it runs the balance Razorpay flow (`initiateBalancePayment` → checkout → `verifyBalancePayment`), the same checkout wrapper the deposit already uses (Req 8.6).

Styling tokens (dark background, rounded corners, violet accent, `Button`) are lifted from the venue page so it reads as part of the site, not a bolt-on (Req 9.1). `z-index` below the fixed navbar/bottom-nav so it never overlaps them (Req 9.2); safe-area inset matches the bottom nav exactly (Req 9.3); visible and operable across mobile/tablet/desktop breakpoints (Req 9.4).

## Data Models

### `Booking.paymentSchedule` (embedded)

| Field | Type | Values / Meaning |
|-------|------|------------------|
| `type` | String | `full` \| `installment` (frozen at creation) |
| `depositAmount` | Number | deposit (installment) or full total (full) charged at booking |
| `balanceAmount` | Number | `total − deposit` for installment; `0` for full |
| `balanceDueAt` | Date | 168h before event start; `null` for full |
| `balanceStatus` | String | `not_applicable` \| `pending` \| `paid` \| `forfeited` |
| `balancePayment` | ObjectId→Payment | balance payment record when paid |
| `lastReminderOn` | String | `YYYY-MM-DD` of last reminder (once/day dedupe) |

`Booking.cancellationReason` — `'missed_payment_deadline'` distinguishes forfeiture from policy cancellations.

State machine for `balanceStatus`:

```
full:        not_applicable  (terminal)
installment: pending ──balance paid before deadline──▶ paid       (terminal)
             pending ──deadline passed unpaid───────▶ forfeited   (terminal)
```

Both `paid` and `forfeited` are terminal, which is exactly what makes reminders stop (Property 5) and enforcement single-shot (Property 6): once a status leaves `pending`, neither the reminder query nor the enforcement claim predicate can select the booking again.

## Correctness Properties

The eight properties defined in requirements.md are enforced by this design as follows.

### Property 1: Payment Schedule Split Invariant
`paymentSchedule.build` computes `balanceAmount = roundMoney(total − roundMoney(total × 0.10))`, so `depositAmount + balanceAmount === totalAmount` exactly and `depositAmount` is 10% of total under the paise-rounding convention.
**Validates: Requirements 1.2, 10.1**

### Property 2: Payment Schedule Type Threshold Consistency
`build` has a single branch `hoursUntilEvent > 168 ⇒ installment, else full`, evaluated once at booking creation and never recomputed, so type is `installment` iff hours-at-booking exceeded 168.
**Validates: Requirements 1.2, 1.3, 10.2, 10.3**

### Property 3: Balance Deadline Consistency
`build` sets `balanceDueAt = eventStartAt(bookingDate, startTime) − 168h`, using the same date/time combine as `venueService.processCancellation`.
**Validates: Requirements 1.4, 10.1**

### Property 4: Forfeiture Exclusivity
`enforceBalanceDeadlines` sets `cancellationReason='missed_payment_deadline'` and never invokes `cancellationPolicy`; `processCancellation` rejects `forfeited` bookings (Req 6.4), so no refund of the deposit is ever produced.
**Validates: Requirements 4.2, 4.3, 6.4**

### Property 5: Reminder Cessation Idempotence
The reminder query filters `paymentSchedule.balanceStatus: 'pending'`. Once a booking transitions to the terminal `paid` or `forfeited`, the selector matches zero, so further runs send nothing.
**Validates: Requirements 7.1, 7.4**

### Property 6: Enforcement Job Idempotence
The claim is an atomic `findOneAndUpdate` whose selector `balanceStatus:'pending'` is exactly what the same update clears to `forfeited`; a concurrent or later run cannot match the same booking, yielding exactly one cancellation and one forfeiture.
**Validates: Requirements 5.1, 5.2**

### Property 7: Refund Base Amount Correctness
`processCancellation` computes `amountPaid = deposit + (balanceStatus==='paid' ? balance : 0)` (or `deposit` alone for `full`) and returns `refundAmount = roundMoney(pct × amountPaid)`.
**Validates: Requirements 6.1, 6.2**

### Property 8: Widget Count Threshold Consistency
`PaymentDueWidgets` renders a swipeable container iff the count of qualifying (installment + pending, this venue) bookings is `> 2`, and stacks otherwise.
**Validates: Requirements 8.4, 8.5**

## Error Handling

- **Deposit/balance payment fails** → booking stays as-is; balance stays `pending`; no deadline countdown change (Req 2.4). Same fail-closed billing as today (billing throws before any Razorpay order).
- **Balance paid after deadline (race with enforcement)** → `completeBalancePayment` only sets `paid` when still `pending` and `now < balanceDueAt`; if enforcement already flipped to `forfeited`, the guard fails and the (rare) late payment is surfaced for manual refund rather than silently double-charging a cancelled booking.
- **Reminder email/push failure** → logged, loop continues (Req 7.5); `lastReminderOn` is set only after the attempt so a hard failure early doesn't suppress the whole batch.
- **Enforcement notification failure** → logged, cancellation/forfeiture not retried (Req 5.3).
- **Legacy bookings** (no `paymentSchedule`) → schema defaults make them `full`/`not_applicable`; every job query excludes them; no migration needed.

## Testing Strategy

Property-based tests (repo uses `fast-check` + `vitest`, plus lightweight `*.check.mjs` self-checks) target the pure core and the idempotent jobs — the highest-risk logic:

- `paymentSchedule.property` — Properties 1, 2, 3 over random `(now, futureDate, startTime, total)`: split sums to total, deposit is 10%, type flips exactly at 168h (including the `=168` boundary → full), deadline is exactly 168h before start.
- `balanceRefund.property` — Property 7: refund = `pct × amountPaid`, with `amountPaid` = deposit (+balance iff paid).
- `enforcementIdempotence.property` — Property 6: running the atomic claim twice over the same due booking yields exactly one cancel + one forfeit (in-memory model of the `findOneAndUpdate` claim, matching the existing `settlementIdempotentRecording.property` style).
- `reminderCessation.property` — Property 5: after status leaves `pending`, the reminder selector matches zero.
- `paymentSchedule.check.mjs` (client + server) — boundary self-checks (`=168`, `168.0001`, same-day) with no framework, matching `money.check.mjs`.
- Widget threshold — small unit test: 0→none, 1–2→stacked, 3+→swipeable (Property 8).

Existing money-invariant property tests (`moneyInvariant.preservation.property.test.ts`) continue to cover the rounding convention the schedule relies on.
