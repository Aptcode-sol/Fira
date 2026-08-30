# Requirements Document

## Introduction

The platform collects money from buyers (event ticket purchases and venue booking advances) and later pays out net earnings to two kinds of payees: event organizers and venue owners. The admin is the party that holds collected funds and manually disburses payouts to each payee's bank details.

Today there is no clear, accurate, reconciliation-friendly view of this money movement. The admin app has no dedicated payouts-and-earnings surface (who the admin owes, how much, and what has already been paid), and the organizer and owner surfaces do not clearly present per-party earnings breakdowns (gross vs. platform commission vs. GST vs. net payable) or payout status.

This feature adds financial breakdown and payout-status surfaces across three audiences — admin, event organizer, and venue owner — following industry-standard financial-dashboard practices. It is a **read/reporting feature**: it presents money that has already been computed and recorded by the existing billing and payout logic. It MUST NOT introduce a second, divergent way of computing money. All displayed figures MUST be derived from the recorded `Payment` and `Payout` records and MUST be consistent with the existing `paymentService.calculateBilling` and `paymentService.processPayout` math.

### Money model (source of truth — displayed figures must reconcile to this)

Buyer-facing billing (`calculateBilling(ticketPrice, quantity, platformFeePercentage, discountAmount)`):
- `subtotal = ticketPrice * quantity`
- `discountedSubtotal = max(0, subtotal - discountAmount)`
- `platformFee = round(discountedSubtotal * platformFeePercentage / 100)`
- `gstAmount = round(platformFee * 0.18)` (18% GST charged **on the platform fee only**)
- `totalAmount = discountedSubtotal + platformFee + gstAmount`

Payee-facing payout (`processPayout(...)`):
- `commissionPercentage = platformFeePercentage ?? 5`
- `platformCommission = round(grossAmount * commissionPercentage / 100)`
- `netAmount = grossAmount - platformCommission`
- Owner gross is based on `Payment.listedPrice`, adjusted by `discountBearer`:
  - `discountBearer === 'platform'` → owner gross = `listedPrice` (platform absorbs the discount)
  - `discountBearer === 'owner'` → owner gross = `listedPrice - discountAmount` (owner absorbs the discount)
  - no discount (`discountBearer === null`) → owner gross = `listedPrice`

## Glossary

- **Admin_Payout_Dashboard**: The admin-app surface that presents aggregate collection, commission, GST, payable, paid, and pending figures plus per-recipient breakdowns.
- **Event_Earnings_View**: The organizer-facing surface presenting per-event earnings breakdown and payout status.
- **Venue_Earnings_View**: The owner-facing surface presenting per-venue/per-booking earnings breakdown and payout status.
- **Earnings_Service**: The single server-side component that aggregates `Payment` and `Payout` records into the figures presented by all three surfaces. It is the one place breakdown figures are computed.
- **Payment**: A recorded buyer transaction with fields `amount`, `subtotal`, `platformFee`, `platformFeePercentage`, `gstAmount`, `totalAmount`, `discountAmount`, `discountBearer`, `listedPrice`, `netAmount`, and `paymentStatus ∈ {pending, paid, refunded, failed}`.
- **Payout**: A recorded disbursement with fields `recipient`, `type ∈ {venue_booking, event_tickets}`, `referenceModel ∈ {Booking, Event}`, `grossAmount`, `platformCommission`, `platformCommissionPercentage`, `netAmount`, `bankDetails`, `method ∈ {manual, gateway}`, and `status ∈ {pending, processing, completed, failed}`.
- **Gross_Collected**: Sum of `totalAmount` across paid, non-refunded Payment records for a scope.
- **Platform_Commission_Earned**: The platform's revenue from a scope, equal to the sum of `platformFee` (buyer-side) / `platformCommission` (payout-side) that the platform retains.
- **GST_Collected**: Sum of `gstAmount` across paid, non-refunded Payment records for a scope.
- **Net_Payable**: Total amount the admin owes payees for a scope, equal to the sum of payout `netAmount` owed and not yet disbursed.
- **Paid_Out**: Sum of `netAmount` across Payout records whose `status` is `completed`.
- **Pending_Payout**: Sum of `netAmount` across Payout records whose `status` is `pending` or `processing`.
- **Payee**: An event organizer or a venue owner who receives payouts.
- **Recipient**: A `User` referenced by `Payout.recipient`; the party the admin owes.
- **Payout_Status_Lifecycle**: The ordered set of Payout states `pending → processing → completed`, with `failed` reachable from `pending` or `processing`.
- **Reconciliation_Check**: The identity that, for any scope, `Gross_Collected` equals the sum of amounts attributable to platform (commission + GST) and to payees (net payable + already paid out + refunded), with no double counting.
- **INR**: Indian Rupee, the platform currency, displayed with the ₹ symbol and thousands separators.

## Requirements

### Requirement 1: Admin aggregate payouts and earnings overview

**User Story:** As an admin, I want a single dashboard showing total money collected, platform commission earned, GST collected, total net payable, amount already paid out, and amount pending, so that I understand the platform's financial position at a glance.

#### Acceptance Criteria

1. WHEN an admin opens the Admin_Payout_Dashboard, THE Admin_Payout_Dashboard SHALL display Gross_Collected, Platform_Commission_Earned, GST_Collected, Net_Payable, Paid_Out, and Pending_Payout as six distinct labeled figures in INR.
2. THE Earnings_Service SHALL compute Gross_Collected as the sum of `totalAmount` over Payment records whose `paymentStatus` equals `paid`.
3. THE Earnings_Service SHALL compute GST_Collected as the sum of `gstAmount` over Payment records whose `paymentStatus` equals `paid`.
4. THE Earnings_Service SHALL compute Paid_Out as the sum of `netAmount` over Payout records whose `status` equals `completed`.
5. THE Earnings_Service SHALL compute Pending_Payout as the sum of `netAmount` over Payout records whose `status` equals `pending` or `processing`.
6. THE Earnings_Service SHALL compute Platform_Commission_Earned as the sum of `platformFee` over Payment records whose `paymentStatus` equals `paid`.
7. THE Earnings_Service SHALL compute Net_Payable as Gross_Collected minus Platform_Commission_Earned minus GST_Collected.
8. THE Earnings_Service SHALL default the dashboard scope to all Payment and Payout records recorded to date, and WHERE an admin selects an inclusive date range, THE Earnings_Service SHALL apply that identical date range to every displayed figure.
9. IF retrieval or computation of the dashboard figures fails, THEN THE Admin_Payout_Dashboard SHALL display an error indication and SHALL NOT display stale, partial, or unreconciled totals.
10. WHERE no Payment or Payout records exist for the selected scope, or a figure's computed value is null or undefined, THE Admin_Payout_Dashboard SHALL display that figure as ₹0.

### Requirement 2: Admin per-recipient payable breakdown

**User Story:** As an admin, I want to see who I owe and how much, broken down per organizer and per venue owner, so that I can process payouts to the correct parties.

#### Acceptance Criteria

1. WHEN an admin opens the per-recipient breakdown, THE Admin_Payout_Dashboard SHALL display one row per Recipient showing the Recipient's name, gross earnings, platform commission deducted, and net payable, where net payable equals gross earnings minus platform commission deducted, and all monetary values are shown as non-negative amounts rounded to 2 decimal places.
2. WHEN the breakdown is displayed, THE Earnings_Service SHALL group breakdown rows by Payout `type` into exactly two sections, one containing all `event_tickets` Recipients and one containing all `venue_booking` Recipients.
3. WHEN a Recipient has one or more Payout records with `status` equal to `pending` or `processing`, THE Admin_Payout_Dashboard SHALL display the sum of those `netAmount` values, rounded to 2 decimal places, as the amount currently owed to that Recipient.
4. IF a Recipient has no Payout records with `status` equal to `pending` or `processing`, THEN THE Admin_Payout_Dashboard SHALL display the amount currently owed to that Recipient as 0.00.
5. WHERE a Recipient has stored bank details, THE Admin_Payout_Dashboard SHALL display the Recipient's bank account name, account number masked so that only the last 4 digits are visible and all preceding digits are replaced with a masking character, IFSC code, and bank name.
6. IF a Recipient has no stored bank details, THEN THE Admin_Payout_Dashboard SHALL display a "bank details missing" indicator for that Recipient and SHALL exclude that Recipient's owed amount from the ready-to-pay total.
7. WHEN the breakdown is displayed, THE Admin_Payout_Dashboard SHALL present all data as read-only and SHALL NOT provide any control that creates, edits, or deletes Payout or bank detail records.

### Requirement 3: Payout status lifecycle display

**User Story:** As an admin, I want each payout's status shown across its lifecycle, so that I can track which payouts are pending, in progress, completed, or failed.

#### Acceptance Criteria

1. WHEN an admin views a Payout, THE Admin_Payout_Dashboard SHALL display the Payout `status` as exactly one of `pending`, `processing`, `completed`, or `failed`.
2. WHEN an admin views a Payout, THE Admin_Payout_Dashboard SHALL display the `grossAmount`, `platformCommission`, `platformCommissionPercentage`, and `netAmount` for that Payout, WHERE `platformCommissionPercentage` is a value within the range 0 to 100 inclusive.
3. IF a Payout `status` equals `completed`, THEN THE Admin_Payout_Dashboard SHALL display the `processedAt` timestamp for that Payout.
4. IF a Payout `status` equals `failed`, THEN THE Admin_Payout_Dashboard SHALL display the `failureReason` recorded for that Payout and SHALL NOT display a `processedAt` timestamp.
5. IF a Payout `status` is absent or is not one of `pending`, `processing`, `completed`, or `failed`, THEN THE Admin_Payout_Dashboard SHALL display an indicator marking the status as unknown and SHALL still display the remaining fields of that Payout.
6. WHEN an admin selects one or more `status` values as a filter, THE Admin_Payout_Dashboard SHALL display only the Payouts whose `status` matches one of the selected values.
7. IF no Payout matches the selected `status` filter, THEN THE Admin_Payout_Dashboard SHALL display an empty-result indication.

### Requirement 4: Reconciliation totals

**User Story:** As an admin, I want reconciliation-friendly totals that add up, so that I can verify no money is unaccounted for or double counted.

#### Acceptance Criteria

1. WHEN the Admin_Payout_Dashboard renders the reconciliation summary, THE Admin_Payout_Dashboard SHALL display Gross_Collected, platform-retained amounts (Platform_Commission_Earned plus GST_Collected), payee-attributed amounts (Net_Payable plus Paid_Out), and Refunded_Total, each presented as a monetary value rounded to 2 decimal places.
2. THE Earnings_Service SHALL exclude Payment records whose `paymentStatus` equals `refunded`, `failed`, or `pending` from Gross_Collected, Platform_Commission_Earned, and GST_Collected.
3. THE Earnings_Service SHALL attribute each Payment record's amount to exactly one of the reconciliation categories (platform-retained, payee-attributed, or Refunded_Total), so that no amount contributes to more than one category.
4. WHEN the reconciliation summary is displayed, THE Admin_Payout_Dashboard SHALL display a residual figure equal to Gross_Collected minus the sum of platform-retained amounts, payee-attributed amounts, and Refunded_Total.
5. IF the absolute value of the residual figure exceeds 0.01, THEN THE Admin_Payout_Dashboard SHALL display a reconciliation discrepancy indicator alongside the residual figure, retaining the displayed category totals unchanged.

### Requirement 5: Event organizer earnings breakdown

**User Story:** As an event organizer, I want to see my earnings per event broken into gross sales, platform commission deducted, and net earnings, so that I understand what I earned and what I will be paid.

#### Acceptance Criteria

1. WHEN an organizer opens the Event_Earnings_View for an event they own, THE Event_Earnings_View SHALL display gross ticket sales, platform commission deducted, GST, and net earnings for that event, each shown as a monetary amount rounded to 2 decimal places.
2. THE Earnings_Service SHALL compute an event's gross ticket sales as the sum of `totalAmount` over Payment records referencing that event whose `paymentStatus` equals `paid`, and SHALL use a value of `0.00` when no such Payment records exist.
3. THE Event_Earnings_View SHALL display the Payout `status` for the event's payout when a Payout record referencing that event exists.
4. WHERE no Payout record exists for an event, THE Event_Earnings_View SHALL display the payout status as `not yet initiated`.
5. IF the requesting organizer does not own the event, THEN THE Earnings_Service SHALL reject the request with an error indicating access is denied and SHALL NOT return or display earnings for that event.
6. THE Earnings_Service SHALL compute net earnings as gross ticket sales minus platform commission deducted minus GST.
7. WHEN an organizer opens the Event_Earnings_View for an event they own, THE Event_Earnings_View SHALL render the complete earnings breakdown within 3 seconds under normal operating conditions.

### Requirement 6: Venue owner earnings breakdown

**User Story:** As a venue owner, I want to see my earnings per venue and per booking including advance handling, commission deducted, and net payable, so that I understand what I will be paid for each booking.

#### Acceptance Criteria

1. WHEN an owner opens the Venue_Earnings_View for a venue the owner owns, THE Venue_Earnings_View SHALL display, per booking, the gross booking amount, the advance amount charged, the platform commission deducted, and the net payable, each shown as a monetary value rounded to 2 decimal places in the same currency as the booking amount.
2. THE Earnings_Service SHALL compute a booking's recognized gross as the sum of the amounts of all Payment records referencing that booking whose `paymentStatus` equals `paid`, reflecting the 10% advance billing already recorded.
3. THE Earnings_Service SHALL compute each booking's net payable as its recognized gross minus the platform commission deducted, where the commission is derived from the same billing calculation that produces the displayed commission amount, and the three displayed values SHALL satisfy: net payable = recognized gross − commission deducted.
4. WHILE a booking has at least one paid Payment record but the total paid amount is less than the full gross booking amount, THE Venue_Earnings_View SHALL display the advance amount charged as the total paid amount and SHALL indicate that the remaining balance is not yet collected.
5. WHEN a Payout record referencing a booking exists, THE Venue_Earnings_View SHALL display that Payout's `status` for the booking; otherwise THE Venue_Earnings_View SHALL display the payout status as `not yet initiated`.
6. WHERE a booking has no paid Payment record, THE Venue_Earnings_View SHALL display that booking's recognized gross as ₹0.00, its commission deducted as ₹0.00, its net payable as ₹0.00, and its payout status as `not yet initiated`.
7. THE Earnings_Service SHALL restrict returned earnings data to venues owned by the requesting owner, enforced server-side.
8. IF the requesting owner requests earnings for a venue the owner does not own, THEN THE Earnings_Service SHALL deny the request, return no earnings data for that venue, and return an authorization error indicating the venue is not accessible to the requester.
9. IF the Earnings_Service fails to retrieve or compute earnings for a requested venue, THEN THE Venue_Earnings_View SHALL display an error indication that earnings could not be loaded and SHALL NOT display partial or stale earnings values for that venue.

### Requirement 7: Refund handling in earnings and payables

**User Story:** As an admin and as a payee, I want refunded payments excluded from earnings and payables, so that no party is credited or paid for money that was returned to the buyer.

#### Acceptance Criteria

1. THE Earnings_Service SHALL exclude every Payment record whose `paymentStatus` equals `refunded` from Gross_Collected, Net_Payable, Platform_Commission_Earned, and GST_Collected, such that each refunded Payment contributes 0.00 to each of these four figures.
2. WHEN a Payment's `paymentStatus` transitions to `refunded`, THE Event_Earnings_View and THE Venue_Earnings_View SHALL exclude that Payment's amount from their net earnings figure within 5 seconds of the transition being recorded.
3. THE Admin_Payout_Dashboard SHALL display Total_Refunded_Amount, computed as the sum of the amounts of all Payment records whose `paymentStatus` equals `refunded`, as a distinct figure separate from Gross_Collected, expressed to two decimal places.
4. WHILE no Payment record with `paymentStatus` equal to `refunded` exists for a given reference, THE Admin_Payout_Dashboard SHALL display Total_Refunded_Amount for that reference as 0.00.
5. IF a Payment transitions to `refunded` after a Payout for the same reference has reached `completed` status, THEN THE Admin_Payout_Dashboard SHALL display a reconciliation flag against that Payout indicating that a refund occurred against an already-completed payout, AND SHALL retain the completed Payout record unchanged.

### Requirement 8: Discount attribution in earnings

**User Story:** As a payee, I want discounts applied to purchases attributed to the correct party, so that my net earnings reflect who absorbed the discount.

#### Acceptance Criteria

1. WHERE a Payment has `discountBearer` equal to `platform`, THE Earnings_Service SHALL compute the payee's gross for that Payment as equal to `listedPrice`, without subtracting `discountAmount`.
2. WHERE a Payment has `discountBearer` equal to `owner`, THE Earnings_Service SHALL compute the payee's gross for that Payment as `listedPrice` minus `discountAmount`.
3. WHERE a Payment has `discountBearer` equal to `null`, THE Earnings_Service SHALL compute the payee's gross for that Payment as equal to `listedPrice`.
4. THE Admin_Payout_Dashboard SHALL compute platform-side earnings figures from the full `listedPrice` for every Payment regardless of the value of `discountBearer`.
5. THE Earnings_Service SHALL round every computed payee gross to exactly 2 decimal places, rounding halves upward, before it is recorded or displayed.
6. IF `discountBearer` equals `owner` AND `discountAmount` is negative, greater than `listedPrice`, or missing, THEN THE Earnings_Service SHALL exclude that Payment from the payee's accumulated gross and return an error indication identifying the invalid `discountAmount`, without producing a negative gross.
7. IF `discountBearer` for a Payment is not one of `platform`, `owner`, or `null`, THEN THE Earnings_Service SHALL exclude that Payment from the payee's accumulated gross and return an error indication identifying the invalid `discountBearer`, without altering the payee's previously accumulated earnings.

### Requirement 9: Currency, rounding, and formatting consistency

**User Story:** As any viewer of these surfaces, I want amounts shown in consistent INR formatting with consistent rounding, so that figures are readable and match recorded amounts to the rupee.

#### Acceptance Criteria

1. WHEN THE Admin_Payout_Dashboard, THE Event_Earnings_View, or THE Venue_Earnings_View renders a monetary amount, THE Earnings_Service SHALL display the amount prefixed with the ₹ symbol and grouped using the Indian numbering system (thousands, then lakhs, then crores; e.g., ₹12,34,567), with no fractional/paise portion since amounts are stored as integer rupees.
2. WHEN the same recorded amount is displayed on more than one of these three surfaces, THE Earnings_Service SHALL render it as an identical character string on every surface.
3. THE Earnings_Service SHALL perform all rounding using the same `round` operation used by `calculateBilling` and `processPayout`, so that every displayed figure equals its recorded integer-rupee figure with zero rupee difference.
4. THE Earnings_Service SHALL compute each aggregate figure by summing the recorded per-record integer-rupee amounts, and SHALL NOT re-derive amounts from percentages, so that the aggregate equals the exact sum of its recorded components with zero rupee drift.
5. IF a monetary amount to be displayed is absent, null, or otherwise unavailable, THEN THE Earnings_Service SHALL display ₹0 rather than a blank, error, or non-numeric value.

### Requirement 10: Single source-of-truth consistency

**User Story:** As a maintainer, I want the breakdown surfaces to reuse the recorded money figures rather than recomputing them, so that displayed values never diverge from what was billed and paid.

#### Acceptance Criteria

1. THE Earnings_Service SHALL read each displayed breakdown figure — `grossAmount`, `platformCommission`, `platformCommissionPercentage`, and `netAmount` from Payout records, and `totalAmount`, `platformFee`, `gstAmount`, and `netAmount` from Payment records — verbatim from the recorded field, without arithmetic re-derivation.
2. WHEN a Payment is in the `paid` (completed) state, THE Earnings_Service SHALL NOT re-run buyer-facing billing to produce displayed figures for that Payment.
3. FOR ALL scopes, the absolute difference between a scope's total recorded collected amount and the sum of that scope's Platform_Commission_Earned, GST_Collected, Net_Payable, Paid_Out, and refunded amount SHALL be at most 0.01 (reconciliation identity).
4. IF a completed Payment has a missing or null source field required for a displayed figure, THEN THE Earnings_Service SHALL suppress display of that figure, return an error indication naming the affected scope, and preserve the recorded values unchanged.
5. IF the reconciliation identity is violated for a scope, THEN THE Earnings_Service SHALL flag that scope, return an error indication, and preserve the recorded values unchanged.

### Requirement 11: Access control for earnings surfaces

**User Story:** As a platform operator, I want each earnings surface restricted to the right audience, so that financial data is only visible to authorized parties.

#### Acceptance Criteria

1. IF a request for the Admin_Payout_Dashboard is not authenticated, or is authenticated as a role other than `super_admin` or `admin`, THEN THE Earnings_Service SHALL reject the request with an authorization error and SHALL NOT return any earnings, payout, or bank detail data.
2. WHILE a session holds the `moderator` role, THE Admin_Payout_Dashboard SHALL remain hidden in the UI, and THE Earnings_Service SHALL reject server-side requests for dashboard data from that session with an authorization error.
3. IF the owner identifier of an event referenced by an Event_Earnings_View request does not match the authenticated requester's identifier, THEN THE Earnings_Service SHALL reject the request with an authorization error and SHALL NOT return any earnings, payout, or bank detail data for that event.
4. IF the owner identifier of a venue referenced by a Venue_Earnings_View request does not match the authenticated requester's identifier, THEN THE Earnings_Service SHALL reject the request with an authorization error and SHALL NOT return any earnings, payout, or bank detail data for that venue.
5. WHERE the Earnings_Service returns a bank account number to any surface, THE Earnings_Service SHALL replace all but the last four digits of that account number with a masking character on every surface.
6. WHEN THE Earnings_Service rejects a request for an authentication or authorization failure, THE Earnings_Service SHALL leave all stored Payment, Payout, and bank detail records unchanged.

### Requirement 12: Loading, empty, and error states

**User Story:** As any viewer, I want clear loading, empty, and error states, so that I can tell the difference between "no earnings", "still loading", and "something went wrong".

#### Acceptance Criteria

1. WHILE earnings or payout data is being retrieved, THE Admin_Payout_Dashboard, THE Event_Earnings_View, and THE Venue_Earnings_View SHALL display a loading indicator within 300 milliseconds of the retrieval request being initiated, and SHALL NOT concurrently display the empty-state message or the error message.
2. WHEN earnings or payout retrieval completes successfully and returns zero earnings records and zero payout records for the requested scope, THE relevant surface SHALL replace the loading indicator with an empty-state message that identifies the scope as having no records, and SHALL NOT display the loading indicator or the error message.
3. IF retrieval of earnings or payout data fails, or does not complete within 30 seconds, THEN THE relevant surface SHALL replace the loading indicator with an error message indicating that data could not be loaded, SHALL provide a retry control, and SHALL NOT display the loading indicator or the empty-state message.
4. WHEN the viewer activates the retry control, THE relevant surface SHALL re-initiate retrieval of the earnings or payout data for the same scope and SHALL return to displaying the loading indicator per criterion 1.
