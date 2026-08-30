# Requirements Document

## Introduction

The FIRA platform collects money centrally through Razorpay and settles event organizers and venue owners manually via captured bank details. The money math is already the single source of truth on the server (`paymentService.calculateBilling` for buyer-side billing and `paymentService.processPayout` for settlement), but neither the admin app nor the event/venue owner experiences surface it clearly. Admins cannot see, at a glance and per party, how much was collected, how much the platform retained, how much is owed to each event organizer and venue owner, and which payouts are pending versus paid. Event organizers and venue owners cannot see their own expected payout per event or per venue booking.

This feature is a reporting and visibility layer over the existing money model. It does not change how billing or payouts are calculated. It aggregates existing `Payment` and `Payout` records into accurate per-party and platform-wide earnings and payout statistics, and presents them in three places: a dedicated payouts/earnings overview in the admin app, an owner-facing earnings view for event organizers per event and for venue owners per venue booking in the client app, and per-entity earnings panels on the admin event and venue detail views. Every displayed figure is derived from values the server already records, so what is shown equals what was collected and what will be settled.

A central clarity rule drives these requirements: the platform earns from two distinct, non-overlapping sources that must never be confused or double-counted — (a) the platform fee plus GST the buyer pays on top of the ticket price at purchase (`Payment.platformFee` + `Payment.gstAmount`), and (b) the commission deducted from the owner's gross at settlement (`Payout.platformCommission`). Each stakeholder sees the number that applies to them, and platform-wide totals present both sources as separate labeled lines.

### Acceptance criteria classes

Each requirement's acceptance criteria are tagged with the class they cover: **(Success)** the normal path, **(Boundary)** zero/empty/limit conditions, **(Failure)** rejected or unauthorized requests, and **(Exception)** upstream/service errors. EARS patterns are used throughout.

### Scope and relationship to other specs

- This spec owns the **visibility and aggregation** of payout/earnings figures. It does not change billing or settlement math.
- `platform-flow-fixes` owns money/settlement/payout computation, the discount-bearer rule, and the booking advance. This spec consumes those numbers and must not redefine them.
- `platform-interaction-fixes` (Requirement 17.2) distinguishes a user's "Transactions" versus "Earnings" tabs at the interaction level. This spec provides the accurate per-event and per-venue earnings figures those owner-facing views display.

## Glossary

- **Admin_App**: The React admin application under `admin/` used by platform administrators.
- **Client_App**: The Next.js application under `client/` used by event organizers and venue owners.
- **Earnings_Service**: The server-side capability (read-only routes and service functions under `server/`) that aggregates `Payment` and `Payout` records into per-party and platform-wide earnings and payout figures.
- **Payout_Overview**: A dedicated view in the Admin_App that lists payouts and platform-wide earnings statistics.
- **Event_Earnings_Panel**: The earnings and payout section shown on the Admin_App event detail view.
- **Venue_Earnings_Panel**: The earnings and payout section shown on the Admin_App venue detail view.
- **Organizer_Earnings_View**: The owner-facing earnings view in the Client_App where an event organizer sees the expected payout for an event they organize.
- **Venue_Owner_Earnings_View**: The owner-facing earnings view in the Client_App where a venue owner sees the expected payout for a venue booking on a venue they own.
- **Recipient_Party**: An event organizer (for event ticket sales) or a venue owner (for venue bookings) who receives a settlement.
- **Admin_Role**: The administrator sub-role carried on the session: `super_admin`, `admin`, or `moderator`.
- **Gross_Collected**: The total amount collected from buyers via Razorpay for a scope, equal to the sum of `Payment.totalAmount` for payments with status `success` in that scope.
- **Platform_Fee_Collected**: The platform fee the buyer paid on top of the ticket price, equal to the sum of `Payment.platformFee` for successful payments in scope. This is platform revenue source (a).
- **GST_Retained**: The 18% GST collected on the platform fee, equal to the sum of `Payment.gstAmount` for successful payments in scope.
- **Owner_Gross**: The gross amount attributable to a Recipient_Party before commission, derived from `Payment.listedPrice` per the discount-bearer contract (a platform-absorbed discount keeps the full listed price; an owner-absorbed discount reduces it by the discount amount).
- **Platform_Commission**: The platform's commission on Owner_Gross at settlement, equal to `round(Owner_Gross × platformFeePercentage / 100)`, matching `Payout.platformCommission`. This is platform revenue source (b).
- **Net_Owed**: The amount owed to a Recipient_Party, equal to `Owner_Gross − Platform_Commission`, matching `Payout.netAmount`.
- **Total_Platform_Revenue**: The platform's total revenue for a scope, equal to `Platform_Fee_Collected + GST_Retained + Platform_Commission`, presented as the sum of the two distinct sources without double-counting.
- **Payout_Status**: The lifecycle state of a payout: `pending`, `processing`, `completed`, or `failed` (from `Payout.status`).
- **Settlement_State**: For a given scope, whether the amount owed to a Recipient_Party is unpaid (no completed payout), partially paid, or fully paid.

## Requirements

### Requirement 1: Platform-wide earnings overview

**User Story:** As a platform admin, I want a platform-wide summary of money collected, retained across both revenue sources, and owed, so that I understand the platform's financial position at a glance without double-counting.

#### Acceptance Criteria

1. WHEN an admin opens the Payout_Overview, THE Earnings_Service SHALL return the total Gross_Collected across all successful payments. **(Success)**
2. WHEN an admin opens the Payout_Overview, THE Earnings_Service SHALL return the total Platform_Fee_Collected, total GST_Retained, and total Platform_Commission as three distinct figures. **(Success)**
3. WHEN an admin opens the Payout_Overview, THE Earnings_Service SHALL return the total Net_Owed to all Recipient_Parties and the total net already settled. **(Success)**
4. WHEN an admin opens the Payout_Overview, THE Admin_App SHALL display Gross_Collected, Platform_Fee_Collected, GST_Retained, Platform_Commission, Total_Platform_Revenue, total Net_Owed, and total net settled as distinct labeled figures. **(Success)**
5. WHERE the Payout_Overview separates earnings by context, THE Admin_App SHALL present event ticket earnings and venue booking earnings as distinct groups. **(Success)**
6. IF no successful payments exist for a requested scope, THEN THE Admin_App SHALL display each figure as zero rather than an empty or missing value. **(Boundary)**

### Requirement 2: Payout list with status and recipient

**User Story:** As a platform admin, I want a list of all payouts with recipient, amounts, and status, so that I can track who has been paid and who is still owed.

#### Acceptance Criteria

1. WHEN an admin opens the Payout_Overview, THE Earnings_Service SHALL return payout records including Recipient_Party name, context type, Owner_Gross, Platform_Commission, Net_Owed, and Payout_Status. **(Success)**
2. THE Admin_App SHALL display each payout with its Recipient_Party, Owner_Gross, Platform_Commission, Net_Owed, and Payout_Status. **(Success)**
3. WHERE an admin filters the payout list by Payout_Status, THE Earnings_Service SHALL return only payouts matching the selected status. **(Success)**
4. WHEN the payout list exceeds one page, THE Earnings_Service SHALL return results in pages with a total count. **(Boundary)**
5. IF a payout record has no completed disbursement, THEN THE Admin_App SHALL display its Payout_Status as `pending`. **(Boundary)**

### Requirement 3: Per-event earnings representation in the Admin_App

**User Story:** As a platform admin, I want each event's earnings breakdown on its detail view, so that I know how much the organizer is owed and how much the platform retained.

#### Acceptance Criteria

1. WHEN an admin opens an event detail view, THE Earnings_Service SHALL return the Gross_Collected, Platform_Fee_Collected, Owner_Gross, Platform_Commission, GST_Retained, and Net_Owed for that event. **(Success)**
2. WHEN an admin opens an event detail view, THE Event_Earnings_Panel SHALL display the organizer's Net_Owed, the Platform_Commission, the Platform_Fee_Collected, and the GST_Retained as distinct labeled figures. **(Success)**
3. WHEN an admin opens an event detail view, THE Event_Earnings_Panel SHALL display the Settlement_State for the organizer's payout. **(Success)**
4. WHERE an event has an associated organizer payout, THE Event_Earnings_Panel SHALL display the Payout_Status and net amount of that payout. **(Success)**
5. IF an event has no successful ticket payments, THEN THE Event_Earnings_Panel SHALL display each earnings figure as zero and indicate that no settlement is due. **(Boundary)**

### Requirement 4: Per-venue earnings representation in the Admin_App

**User Story:** As a platform admin, I want each venue's earnings breakdown on its detail view, so that I know how much the venue owner is owed from bookings and how much the platform retained.

#### Acceptance Criteria

1. WHEN an admin opens a venue detail view, THE Earnings_Service SHALL return the Gross_Collected, Platform_Fee_Collected, Owner_Gross, Platform_Commission, GST_Retained, and Net_Owed for that venue's bookings. **(Success)**
2. WHEN an admin opens a venue detail view, THE Venue_Earnings_Panel SHALL display the venue owner's Net_Owed, the Platform_Commission, the Platform_Fee_Collected, and the GST_Retained as distinct labeled figures. **(Success)**
3. WHEN an admin opens a venue detail view, THE Venue_Earnings_Panel SHALL display the Settlement_State for the venue owner's payout. **(Success)**
4. WHERE a venue booking payment reflects the 10% advance, THE Venue_Earnings_Panel SHALL label the displayed Gross_Collected as the advance amount collected. **(Boundary)**
5. IF a venue has no successful booking payments, THEN THE Venue_Earnings_Panel SHALL display each earnings figure as zero and indicate that no settlement is due. **(Boundary)**

### Requirement 5: Organizer-facing earnings per event

**User Story:** As an event organizer, I want to see my expected payout for each event I organize, so that I know what I will receive after the platform's commission.

#### Acceptance Criteria

1. WHEN an authenticated organizer opens the Organizer_Earnings_View for an event they organize, THE Earnings_Service SHALL return that event's Gross_Collected, Owner_Gross, Platform_Commission, and Net_Owed. **(Success)**
2. WHEN the Organizer_Earnings_View is displayed, THE Client_App SHALL present the Owner_Gross, the Platform_Commission deducted, and the resulting Net_Owed as distinct labeled figures. **(Success)**
3. WHEN an organizer's event has an associated payout, THE Client_App SHALL display the Payout_Status and net amount of that payout. **(Success)**
4. IF an event has no successful ticket payments, THEN THE Client_App SHALL display each figure as zero and indicate that no payout is yet due. **(Boundary)**
5. IF a user who is not the organizer of the event requests that event's Organizer_Earnings_View, THEN THE Earnings_Service SHALL reject the request with an authorization error and SHALL NOT return earnings figures. **(Failure)**

### Requirement 6: Venue-owner-facing earnings per venue booking

**User Story:** As a venue owner, I want to see my expected payout for each booking on my venue, so that I know what I will receive after the platform's commission.

#### Acceptance Criteria

1. WHEN an authenticated venue owner opens the Venue_Owner_Earnings_View for a venue they own, THE Earnings_Service SHALL return that venue's Gross_Collected, Owner_Gross, Platform_Commission, and Net_Owed for its bookings. **(Success)**
2. WHEN the Venue_Owner_Earnings_View is displayed, THE Client_App SHALL present the Owner_Gross, the Platform_Commission deducted, and the resulting Net_Owed as distinct labeled figures. **(Success)**
3. WHEN a venue booking has an associated payout, THE Client_App SHALL display the Payout_Status and net amount of that payout. **(Success)**
4. WHERE a venue booking payment reflects the 10% advance, THE Client_App SHALL label the collected figure as the advance amount. **(Boundary)**
5. IF a user who is not the owner of the venue requests that venue's Venue_Owner_Earnings_View, THEN THE Earnings_Service SHALL reject the request with an authorization error and SHALL NOT return earnings figures. **(Failure)**

### Requirement 7: Accuracy and consistency with the money model

**User Story:** As a platform admin, I want the displayed figures to match the recorded payments and payouts exactly, so that I can trust the numbers when disbursing money.

#### Acceptance Criteria

1. THE Earnings_Service SHALL compute Gross_Collected as the sum of `Payment.totalAmount`, Platform_Fee_Collected as the sum of `Payment.platformFee`, and GST_Retained as the sum of `Payment.gstAmount`, for payments with status `success` in the requested scope. **(Success)**
2. THE Earnings_Service SHALL derive Owner_Gross from `Payment.listedPrice` according to the discount-bearer contract, where a platform-absorbed discount keeps the full listed price and an owner-absorbed discount reduces Owner_Gross by the discount amount. **(Success)**
3. THE Earnings_Service SHALL compute Platform_Commission as `round(Owner_Gross × platformFeePercentage / 100)` and Net_Owed as `Owner_Gross − Platform_Commission`, using the referenced entity's `platformFeePercentage`. **(Success)**
4. FOR any scope, THE Earnings_Service SHALL ensure that Net_Owed plus Platform_Commission equals Owner_Gross. **(Boundary)**
5. FOR any scope, THE Earnings_Service SHALL present Total_Platform_Revenue as `Platform_Fee_Collected + GST_Retained + Platform_Commission` and SHALL NOT add the buyer-paid platform fee into any figure representing amounts owed to a Recipient_Party. **(Boundary)**
6. WHERE a payout record exists for a scope, THE Earnings_Service SHALL report the payout's recorded `netAmount`, `platformCommission`, and `grossAmount` rather than recomputed values, so displayed settlement figures match the stored payout. **(Success)**

### Requirement 8: Access control for earnings visibility

**User Story:** As a platform operator, I want earnings and payout data restricted to authorized parties, so that platform-wide figures and bank details are not exposed to unauthorized users.

#### Acceptance Criteria

1. WHEN a request for Payout_Overview or admin event/venue earnings data is received, THE Earnings_Service SHALL require an authenticated session whose Admin_Role is `super_admin` or `admin`. **(Success)**
2. IF a request for admin earnings or payout data carries the `moderator` Admin_Role, THEN THE Earnings_Service SHALL reject the request with an authorization error and THE Admin_App SHALL hide the payouts navigation item for that role. **(Failure)**
3. IF a request for admin earnings or payout data lacks a valid admin session, THEN THE Earnings_Service SHALL reject the request with an authorization error and SHALL NOT return financial figures. **(Failure)**
4. WHEN an owner-facing earnings request is received, THE Earnings_Service SHALL return figures only for events or venues the authenticated requester owns. **(Success)**
5. THE Earnings_Service SHALL exclude Recipient_Party bank details from every owner-facing earnings response. **(Success)**

### Requirement 9: Payout navigation entry point and error handling

**User Story:** As a platform admin, I want a dedicated navigation entry to the payouts and earnings overview and clear feedback when data cannot load, so that I can reach the financial view directly and never act on stale numbers.

#### Acceptance Criteria

1. THE Admin_App SHALL provide a navigation item, visible to `super_admin` and `admin` roles, that opens the Payout_Overview. **(Success)**
2. WHEN an admin selects the payouts navigation item, THE Admin_App SHALL display the Payout_Overview. **(Success)**
3. IF an Earnings_Service request fails, THEN THE Admin_App and Client_App SHALL display an error message and SHALL NOT display stale or partial financial figures as current. **(Exception)**
4. WHILE an Earnings_Service request is in progress, THE Admin_App and Client_App SHALL indicate a loading state rather than showing zero or empty figures as final. **(Boundary)**
