# Requirements Document

## Introduction

Today, every venue booking is charged a flat, hardcoded 10% advance at booking time (`bookingService.initiateBookingPayment`), regardless of how far away the event is, with the remaining 90% settled directly with the venue owner outside the platform. This feature replaces that fixed rule with a **date-aware payment schedule**:

- If the event is **more than 7 days away** at the moment of booking, the customer pays a **10% deposit** at booking, and the remaining **90% balance** is due **7 days before the event**.
- If the event is **7 days away or closer** at the moment of booking, there is no room for a two-stage split: the **full amount (100%)** is due at booking.
- If the 90% balance is not paid by its deadline, the booking is **automatically cancelled and the 10% deposit is forfeited**. This is a distinct, automatic "missed deadline" outcome — it is explicitly **not** a customer-initiated cancellation, and it does **not** use the existing venue `cancellationPolicy` refund tiers (Requirement 15 of `platform-feature-overhaul`).
- While a balance is outstanding, the customer receives a **daily reminder** (email + push) stating the days remaining and the amount due, and sees a floating **"Pay Now"** widget on the venue's page (bottom-right on desktop, bottom-right above the mobile bottom navigation bar on mobile). If more than 2 such widgets apply at once, they are shown in a single small swipeable container instead of stacking.

This document defines the behavior of the payment schedule, the deadline enforcement/forfeiture path, its interaction with the existing refund-tier policy, the reminder job, and the client-facing widget.

## Glossary

- **Booking**: A reservation record (`Booking` model) capturing the venue, date, time window, and financial terms of a customer's event at a Venue.
- **Payment_Schedule**: The structure attached to a Booking describing how its `totalAmount` SHALL be collected — either type `"full"` (single payment) or type `"installment"` (Deposit_Installment followed by Balance_Installment).
- **Deposit_Installment**: The portion of `totalAmount` required at the time of booking to hold the date.
- **Balance_Installment**: The remaining portion of `totalAmount` required after the Deposit_Installment, applicable only when Payment_Schedule type is `"installment"`.
- **Balance_Due_Deadline**: The point in time by which the Balance_Installment SHALL be paid in full.
- **Hours_Until_Event**: The number of hours between a reference time and the Booking's `bookingDate` combined with `startTime`, computed using the same date-combination convention already used by the existing Cancellation_Policy calculation (`venueService.processCancellation`).
- **Cancellation_Policy**: The existing venue-configurable refund-tier policy (`Venue.cancellationPolicy`: `freeCancellationHours`, `partialRefundPercentage`, `noCancellationHours`) governing refunds for customer-initiated cancellations, defined in Requirement 15 of the `platform-feature-overhaul` spec.
- **Missed-Deadline Forfeiture**: The automatic outcome applied when a Balance_Installment is not paid by its Balance_Due_Deadline: the Booking is cancelled and the Deposit_Installment is forfeited, outside the scope of the Cancellation_Policy.
- **Payment_Reminder_Job**: The scheduled Server process that sends daily reminders for Bookings with a pending Balance_Installment.
- **Deadline_Enforcement_Job**: The scheduled Server process that cancels Bookings and forfeits the Deposit_Installment once the Balance_Due_Deadline has passed unpaid.
- **Payment_Due_Widget**: The floating "Pay Now" UI element the Client displays on a Venue's page for a Booking with a pending Balance_Installment.
- **Client**: The Next.js customer-facing web application.
- **Server**: The backend application handling bookings, payments, and scheduled jobs.

## Requirements

### Domain: Payment Schedule Determination & Collection

### Requirement 1: Payment Schedule Determination at Booking Time

**User Story:** As a customer booking a venue, I want the payment structure to automatically match how far away my event is, so that I pay a predictable amount upfront.

#### Acceptance Criteria

1. WHEN a customer submits a booking request, THE Server SHALL compute Hours_Until_Event as the difference, in hours, between the current time and the Booking's `bookingDate` combined with `startTime`.
2. WHEN a customer submits a booking request and the computed Hours_Until_Event is greater than 168, THE Server SHALL create a Payment_Schedule of type `"installment"` consisting of a Deposit_Installment equal to 10% of `totalAmount` and a Balance_Installment equal to the remaining 90% of `totalAmount`.
3. WHEN a customer submits a booking request and the computed Hours_Until_Event is less than or equal to 168, THE Server SHALL create a Payment_Schedule of type `"full"` consisting of a single Deposit_Installment equal to 100% of `totalAmount` and no Balance_Installment.
4. WHEN a Payment_Schedule of type `"installment"` is created, THE Server SHALL set the Balance_Due_Deadline to exactly 168 hours before the Booking's combined `bookingDate` and `startTime`.
5. THE Booking SHALL store its Payment_Schedule type, Deposit_Installment amount, Balance_Installment amount, Balance_Due_Deadline, and Balance_Installment status (`not_applicable`, `pending`, `paid`, or `forfeited`) as part of the Booking record.
6. WHEN a customer views the booking cost summary before confirming payment, THE Client SHALL display the applicable Payment_Schedule: either the single full amount due, or the deposit amount, balance amount, and balance due date.

### Requirement 2: Deposit / Full Payment Collection at Booking

**User Story:** As a customer, I want to pay the correct upfront amount when I book, so that my date is held according to the schedule shown to me.

#### Acceptance Criteria

1. WHEN a customer initiates payment for a Booking with Payment_Schedule type `"installment"`, THE Server SHALL charge only the Deposit_Installment amount (10% of `totalAmount`, plus applicable platform fee and GST) at booking time.
2. WHEN a customer initiates payment for a Booking with Payment_Schedule type `"full"`, THE Server SHALL charge the entire `totalAmount` (plus applicable platform fee and GST) at booking time.
3. WHEN the Deposit_Installment or full payment succeeds, THE Server SHALL set the Booking status to `"accepted"` and record the payment against the Booking.
4. IF the Deposit_Installment or full payment fails or is not completed, THEN THE Server SHALL leave the Booking in `"pending"` status and SHALL NOT start the Balance_Due_Deadline countdown.

### Requirement 3: Balance Payment Before Deadline

**User Story:** As a customer with an installment schedule, I want to pay my remaining balance any time before the deadline, so that I keep my booking.

#### Acceptance Criteria

1. WHILE a Booking has Payment_Schedule type `"installment"` and Balance_Installment status `"pending"`, THE Server SHALL allow the customer to initiate payment of the Balance_Installment amount.
2. WHEN the Balance_Installment payment succeeds before the Balance_Due_Deadline, THE Server SHALL set the Balance_Installment status to `"paid"` and stop generating further reminders and widgets for that Booking.
3. IF a customer attempts to initiate a Balance_Installment payment for a Booking whose Balance_Installment status is not `"pending"`, THEN THE Server SHALL reject the request with an error indicating no balance payment is currently due.
4. IF a customer attempts to pay an amount other than the full Balance_Installment amount, THEN THE Server SHALL reject the request and require payment of the full Balance_Installment amount in a single payment.

### Domain: Deadline Enforcement & Forfeiture

### Requirement 4: Missed Balance Deadline — Automatic Cancellation and Deposit Forfeiture

**User Story:** As the platform, I want bookings with unpaid balances past their deadline to be cancelled automatically and the deposit forfeited, so that a venue's date is not held indefinitely without full payment.

#### Acceptance Criteria

1. IF a Booking's Payment_Schedule type is `"installment"`, its Balance_Installment status is `"pending"`, and the current time is at or after its Balance_Due_Deadline, THEN THE Deadline_Enforcement_Job SHALL set the Booking status to `"cancelled"`, set the Balance_Installment status to `"forfeited"`, and record the cancellation reason as `"missed_payment_deadline"`.
2. WHEN a Booking is cancelled under Requirement 4.1, THE Server SHALL mark the Deposit_Installment as forfeited and non-refundable.
3. THE Server SHALL treat a Booking cancelled under Requirement 4.1 as outside the scope of the Cancellation_Policy refund tiers, applying no Cancellation_Policy calculation to it.
4. WHEN a Booking is cancelled under Requirement 4.1, THE Server SHALL release the Venue's booked date so other customers can book that date.
5. WHEN a Booking is cancelled under Requirement 4.1, THE Server SHALL send the customer an email and a push notification stating that the booking was cancelled and the deposit forfeited due to non-payment of the balance by the deadline.

### Requirement 5: Enforcement Job Idempotence

**User Story:** As the platform, I want the deadline enforcement job to run safely on repeated or overlapping executions, so that a booking is never double-cancelled or double-notified.

#### Acceptance Criteria

1. WHEN the Deadline_Enforcement_Job runs, THE Server SHALL select only Bookings whose Balance_Installment status is currently `"pending"` and whose Balance_Due_Deadline has passed.
2. WHEN the Deadline_Enforcement_Job processes a Booking, THE Server SHALL transition that Booking's Balance_Installment status away from `"pending"` as part of the same operation that selects it, so that a concurrent or subsequent run of the job processes that Booking at most once.
3. IF the Deadline_Enforcement_Job's notification step fails after a Booking has already been cancelled and forfeited, THEN THE Server SHALL log the failure without retrying the cancellation itself.

### Domain: Interaction with Existing Refund Policy

### Requirement 6: Refund Tier Calculation Uses Total Amount Actually Paid

**User Story:** As a customer who voluntarily cancels after paying both a deposit and a balance, I want my refund calculated on everything I've actually paid, so that I'm not shortchanged.

#### Acceptance Criteria

1. WHEN a customer requests cancellation of a Booking under the existing Cancellation_Policy, THE Server SHALL calculate the refund amount as the applicable refund percentage multiplied by the total amount actually paid for that Booking.
2. THE Server SHALL compute "total amount actually paid" as the Deposit_Installment amount plus the Balance_Installment amount when the Balance_Installment status is `"paid"`, or as the Deposit_Installment amount alone otherwise.
3. THE Server SHALL continue to apply the existing Cancellation_Policy tiers (full refund, partial refund, cancellation window passed) based on hours remaining before the booking start, unchanged by this feature.
4. THE Server SHALL NOT allow a voluntary cancellation request to be processed under the Cancellation_Policy for a Booking whose Balance_Installment status is `"forfeited"`.

### Domain: Notifications

### Requirement 7: Daily Payment Due Reminders

**User Story:** As a customer with an unpaid balance, I want daily reminders by email and push notification, so that I don't miss my payment deadline.

#### Acceptance Criteria

1. WHILE a Booking has Payment_Schedule type `"installment"` and Balance_Installment status `"pending"`, THE Payment_Reminder_Job SHALL send at most one email reminder and at most one push notification reminder for that Booking per calendar day.
2. THE Payment_Reminder_Job SHALL include, in each reminder, the number of whole days remaining until the Balance_Due_Deadline and the Balance_Installment amount due.
3. IF the Balance_Due_Deadline has already passed for a Booking whose Balance_Installment status is still `"pending"` at the time the Payment_Reminder_Job runs, THEN THE Payment_Reminder_Job SHALL skip sending a reminder for that Booking and leave it for the Deadline_Enforcement_Job.
4. WHEN a Booking's Balance_Installment status changes to `"paid"` or `"forfeited"`, THE Payment_Reminder_Job SHALL stop sending further reminders for that Booking from its next run onward.
5. IF an email or push notification delivery fails for a Booking, THEN THE Payment_Reminder_Job SHALL log the failure and continue processing reminders for the remaining Bookings.

### Domain: Client UI — Floating Payment Widget

### Requirement 8: Floating "Pay Now" Widget on the Venue Page

**User Story:** As a customer viewing a venue I owe a balance on, I want a persistent, reachable way to pay, so that I can complete payment without hunting for it.

#### Acceptance Criteria

1. WHILE an authenticated customer has one or more Bookings at a given Venue with Payment_Schedule type `"installment"` and Balance_Installment status `"pending"`, WHEN that customer views that Venue's page, THE Client SHALL display one Payment_Due_Widget per such Booking.
2. WHERE the Client is rendered at a desktop viewport width, THE Client SHALL position the Payment_Due_Widget(s) fixed to the bottom-right corner of the viewport.
3. WHERE the Client is rendered at a mobile viewport width, THE Client SHALL position the Payment_Due_Widget(s) fixed to the bottom-right corner of the viewport and above the mobile bottom navigation bar, so that no part of a Payment_Due_Widget is obscured by or overlaps the mobile bottom navigation bar.
4. IF more than 2 Payment_Due_Widget instances apply to the current customer and Venue, THEN THE Client SHALL render all of them inside a single small swipeable container that lets the customer swipe or drag between them, instead of stacking more than 2 widgets.
5. IF 2 or fewer Payment_Due_Widget instances apply to the current customer and Venue, THEN THE Client SHALL render them stacked without swipe behavior.
6. WHEN a customer activates a Payment_Due_Widget, THE Client SHALL navigate the customer to the payment flow for that Booking's Balance_Installment.
7. THE Client SHALL display, on each Payment_Due_Widget, the number of whole days remaining until the Balance_Due_Deadline and the Balance_Installment amount due.

### Requirement 9: Visual Styling and Responsiveness of the Payment Due Widget

**User Story:** As a customer, I want the payment reminder UI to look consistent with the rest of the site, so that it feels trustworthy rather than intrusive.

#### Acceptance Criteria

1. THE Client SHALL style the Payment_Due_Widget and its swipeable container using the design tokens already used on the Venue page (dark background, rounded corners, violet accent color, existing `Button` component).
2. THE Client SHALL render the Payment_Due_Widget so that it does not visually overlap any other fixed-position element on the page at any supported viewport width.
3. THE Client SHALL apply the same safe-area-inset-bottom spacing convention already used by the mobile bottom navigation bar when positioning the Payment_Due_Widget on mobile viewports.
4. THE Client SHALL render the Payment_Due_Widget so that it remains fully visible and operable across the breakpoints already supported by the Venue page (mobile, tablet, and desktop).

### Domain: Computation Conventions

### Requirement 10: Consistent Time Computation Convention

**User Story:** As a developer, I want the days/hours-until-event and deadline computation to follow one unambiguous, testable rule, so the payment schedule and deadline behave consistently regardless of when a booking is made.

#### Acceptance Criteria

1. THE Server SHALL use one consistent timezone convention, shared with the existing Cancellation_Policy calculation, for all Hours_Until_Event and Balance_Due_Deadline computations.
2. THE Server SHALL treat a Booking whose Hours_Until_Event equals exactly 168 as "not farther than 7 days," applying the full-payment Payment_Schedule per Requirement 1.3.
3. THE Server SHALL compute Hours_Until_Event at the moment the booking request is submitted, and SHALL NOT recompute or change the Payment_Schedule type after the Booking is created.

## Correctness Properties

### Property 1: Payment Schedule Split Invariant
FOR ALL Bookings with Payment_Schedule type `"installment"`, Deposit_Installment + Balance_Installment SHALL equal `totalAmount`, AND Deposit_Installment SHALL equal 10% of `totalAmount` (subject to the existing money-rounding convention).

### Property 2: Payment Schedule Type Threshold Consistency
FOR ALL Bookings, Payment_Schedule type SHALL be `"installment"` if and only if Hours_Until_Event at booking submission time was greater than 168, and SHALL be `"full"` if and only if Hours_Until_Event at booking submission time was less than or equal to 168.

### Property 3: Balance Deadline Consistency
FOR ALL Bookings with Payment_Schedule type `"installment"`, Balance_Due_Deadline SHALL equal exactly 168 hours before the Booking's combined `bookingDate` and `startTime`.

### Property 4: Forfeiture Exclusivity
FOR ALL Bookings with cancellation reason `"missed_payment_deadline"`, no refund of the Deposit_Installment SHALL exist for that Booking.

### Property 5: Reminder Cessation Idempotence
FOR ALL Bookings, once Balance_Installment status transitions away from `"pending"`, running the Payment_Reminder_Job any additional number of times SHALL send zero further reminders for that Booking.

### Property 6: Enforcement Job Idempotence
FOR ALL Bookings whose Balance_Due_Deadline has passed unpaid, running the Deadline_Enforcement_Job multiple times SHALL result in exactly one cancellation and exactly one forfeiture for that Booking, never more.

### Property 7: Refund Base Amount Correctness
FOR ALL voluntary cancellations processed under the Cancellation_Policy, the refunded amount SHALL equal (refund percentage × total amount actually paid), where total amount actually paid equals Deposit_Installment plus Balance_Installment when Balance_Installment status is `"paid"`, or Deposit_Installment alone otherwise.

### Property 8: Widget Count Threshold Consistency
FOR ALL (customer, Venue) pairs, the Client SHALL render Payment_Due_Widgets in a swipeable container if and only if the count of qualifying Bookings (Payment_Schedule type `"installment"`, Balance_Installment status `"pending"`) is greater than 2.
