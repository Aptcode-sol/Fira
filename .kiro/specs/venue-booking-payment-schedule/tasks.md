# Implementation Plan

## Overview

Implements the date-aware venue payment schedule: a pure schedule-decision core, Booking model extension, schedule-aware deposit/balance collection, refund-policy interaction, daily reminder + hourly enforcement cron jobs, notification emails, and the client cost summary + floating swipeable "Pay Now" widget. Server core lands first (tasks 1–7), then the client (tasks 8–9).

## Tasks

- [x] 1. Pure payment-schedule core + tests
- [x] 1.1 Create `server/utils/paymentSchedule.js`
  - Implement `eventStartAt`, `hoursUntilEvent`, and `build(now, bookingDate, startTime, totalAmount)` using `roundMoney`.
  - `build`: `hours > 168 ⇒ installment` (deposit = 10%, balance = total − deposit, balanceDueAt = eventStart − 168h, status `pending`); else `full` (deposit = total, balance 0, balanceDueAt null, status `not_applicable`).
  - Export `INSTALLMENT_THRESHOLD_HOURS`, `DEPOSIT_RATE`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 10.2, 10.3_

- [x] 1.2 Write property test `server/__tests__/paymentSchedule.property.test.ts`
  - Property 1: `deposit + balance === total` and `deposit === roundMoney(total×0.10)` for installment.
  - Property 2: type is `installment` iff hours > 168 (assert `=168` and `168.0001` boundaries).
  - Property 3: `balanceDueAt === eventStart − 168h` for installment.
  - _Requirements: 1.2, 1.3, 1.4, 10.2_

- [x] 2. Extend Booking model
- [x] 2.1 Add `paymentSchedule` sub-document and `cancellationReason` to `server/models/Booking.js`
  - Fields per design: `type`, `depositAmount`, `balanceAmount`, `balanceDueAt`, `balanceStatus`, `balancePayment`, `lastReminderOn`; add `cancellationReason`.
  - Add index `{ 'paymentSchedule.balanceStatus': 1, 'paymentSchedule.balanceDueAt': 1 }`.
  - _Requirements: 1.5_

- [x] 3. Booking service — schedule-aware collection
- [x] 3.1 Attach schedule in `createBooking`
  - Before `Booking.create`, set `data.paymentSchedule = paymentSchedule.build(new Date(), data.bookingDate, data.startTime, data.totalAmount)`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.3_

- [x] 3.2 Make `initiateBookingPayment` schedule-aware
  - Charge `depositAmount` for installment, full `totalAmount` for full; route through `calculateBilling`.
  - Return `depositAmount`, `balanceAmount`, `balanceDueAt`, `paymentScheduleType` in the response payload.
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3.3 Add `initiateBalancePayment` and `completeBalancePayment`
  - `initiateBalancePayment`: assert ownership; guard `type==='installment' && balanceStatus==='pending'` else throw "No balance payment is currently due"; charge exactly `balanceAmount` (no partials).
  - `completeBalancePayment`: verify; only when still `pending` and `now < balanceDueAt` set `balanceStatus='paid'` and link `balancePayment`.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Balance-payment routes
- [x] 4.1 Add routes to `server/routes/booking.js`
  - `POST /:id/initiate-balance-payment` (auth, `req.user._id`) and `POST /:id/verify-balance-payment`.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5. Refund policy interaction
- [x] 5.1 Update `venueService.processCancellation`
  - Throw early if `balanceStatus==='forfeited'`.
  - Compute `amountPaid` from schedule (deposit + balance iff paid; else deposit/total) and return `refundAmount = roundMoney(pct × amountPaid)`; leave tier logic unchanged.
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5.2 Write property test `server/__tests__/balanceRefund.property.test.ts`
  - Property 7: `refundAmount === roundMoney(pct × amountPaid)` where `amountPaid` = deposit (+balance iff paid).
  - _Requirements: 6.1, 6.2_

- [x] 6. Scheduled jobs — reminders + enforcement
- [x] 6.1 Add `sendBalanceReminders` to `server/jobs/scheduledJobs.js`
  - Daily cron `0 9 * * *`. Query installment + pending + `balanceDueAt > now` + `lastReminderOn != today`.
  - Per booking: notify (channel `all`) with days-left + amount, send reminder email in try/catch (continue on fail), set `lastReminderOn = today`.
  - Export for tests; register in `initScheduledJobs`.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6.2 Add `enforceBalanceDeadlines` to `server/jobs/scheduledJobs.js`
  - Hourly cron `5 * * * *`. Loop atomic `findOneAndUpdate` claim (selector `pending` + `balanceDueAt <= now`, set `status='cancelled'`, `balanceStatus='forfeited'`, `cancellationReason='missed_payment_deadline'`).
  - Release venue booked date; notify (channel `all`) in try/catch without undoing cancel.
  - Export for tests; register in `initScheduledJobs`.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3_

- [x] 6.3 Write property tests for job idempotence
  - `enforcementIdempotence.property`: claim run twice over same due booking ⇒ exactly one cancel + one forfeit (Property 6).
  - `reminderCessation.property`: after status leaves `pending`, reminder selector matches zero (Property 5).
  - _Requirements: 5.1, 5.2, 7.1, 7.4_

- [x] 7. Notification emails
- [x] 7.1 Add `sendBalanceReminderEmail` and `sendBalanceForfeitEmail`
  - Add to `server/services/emailService.js` (+ templates in `utils/emailTemplates.js`), styled like existing venue/reminder emails. Reminder shows days-left + amount; forfeit shows cancelled + deposit forfeited.
  - _Requirements: 4.5, 7.2_

- [x] 8. Client — API + types + display helper
- [x] 8.1 Extend `client/src/lib/api.ts` and `types.ts`
  - Add `initiateBalancePayment` / `verifyBalancePayment` to `bookingsApi`; add `paymentSchedule` shape to the `Booking` type.
  - _Requirements: 3.1, 8.6_

- [x] 8.2 Create `client/src/lib/paymentSchedule.ts` (+ `.check.mjs`)
  - `daysUntil(balanceDueAt)` (whole days) and `describeSchedule(booking)` returning full-amount or deposit/balance/due-date strings. Self-check for boundaries.
  - _Requirements: 1.6, 8.7_

- [x] 9. Client — cost summary + floating widget
- [x] 9.1 Show schedule in booking cost summary
  - In the venue booking modal, use `describeSchedule` to display either full amount due, or deposit + balance + balance due date before confirming.
  - _Requirements: 1.6_

- [x] 9.2 Create `PaymentDueWidgets` component and mount in `VenueDetailClient`
  - Fetch user's bookings; keep installment + pending at this venue. Render nothing if 0; stack if ≤2; single swipeable scroll-snap container with dots if >2.
  - Position: desktop bottom-right; mobile bottom-right above bottom nav via `bottom-[calc(5rem+env(safe-area-inset-bottom)+0.5rem)]`. Dark/rounded/violet tokens, existing `Button`, z-index below navbars. Each card shows days-left + amount and runs the balance Razorpay flow on "Pay Now".
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4_

- [x] 9.3 Write widget threshold unit test
  - 0 → none, 1–2 → stacked, 3+ → swipeable (Property 8).
  - _Requirements: 8.4, 8.5_

## Task Dependency Graph

```json
{
  "tasks": {
    "1.1": { "dependsOn": [] },
    "1.2": { "dependsOn": ["1.1"] },
    "2.1": { "dependsOn": [] },
    "3.1": { "dependsOn": ["1.1", "2.1"] },
    "3.2": { "dependsOn": ["3.1"] },
    "3.3": { "dependsOn": ["3.2"] },
    "4.1": { "dependsOn": ["3.3"] },
    "5.1": { "dependsOn": ["2.1"] },
    "5.2": { "dependsOn": ["5.1"] },
    "7.1": { "dependsOn": [] },
    "6.1": { "dependsOn": ["2.1", "7.1"] },
    "6.2": { "dependsOn": ["2.1", "7.1"] },
    "6.3": { "dependsOn": ["6.1", "6.2"] },
    "8.1": { "dependsOn": ["3.3"] },
    "8.2": { "dependsOn": ["8.1"] },
    "9.1": { "dependsOn": ["8.2"] },
    "9.2": { "dependsOn": ["8.2"] },
    "9.3": { "dependsOn": ["9.2"] }
  },
  "waves": [
    { "wave": 1, "tasks": ["1.1", "2.1", "7.1"] },
    { "wave": 2, "tasks": ["1.2", "3.1", "5.1", "6.1", "6.2"] },
    { "wave": 3, "tasks": ["3.2", "5.2", "6.3"] },
    { "wave": 4, "tasks": ["3.3"] },
    { "wave": 5, "tasks": ["4.1", "8.1"] },
    { "wave": 6, "tasks": ["8.2"] },
    { "wave": 7, "tasks": ["9.1", "9.2"] },
    { "wave": 8, "tasks": ["9.3"] }
  ]
}
```

- **Tasks 1.1, 2.1, 7.1** are the roots — no dependencies.
- **Task 7.1** (emails) must precede the jobs (6.1, 6.2) that call them.
- Server chain is largely independent of the client chain (8→9) except that 8.1 needs the balance endpoints from 3.3.

## Notes

- Reuse existing infrastructure: `utils/money.roundMoney`, `paymentService.initiatePayment/verifyPayment/calculateBilling`, `notificationService.createNotification({channel:'all'})`, `jobs/scheduledJobs.js` cron registration, and `env(safe-area-inset-bottom)` + `5rem` bottom-nav convention.
- No data migration: schema defaults make legacy bookings `full`/`not_applicable`, excluded from all job queries.
- Property tests use the repo's `fast-check` + `vitest` setup; boundary self-checks follow the `*.check.mjs` convention (e.g. `money.check.mjs`).
- Money rounding to paise at each step, matching server and client (`venuePricing.bookingAdvance`).

