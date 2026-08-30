# Requirements Document

## Introduction

The platform already computes and reports money accurately. `server/services/earningsService.js` is the single aggregator over recorded `Payment` and `Payout` records, and `admin/src/pages/Payouts.jsx` presents a platform-wide overview, reconciliation summary, payout lifecycle, and per-recipient breakdown. That entire surface is read-only: nothing in the admin app can record that money was actually transferred to an event organizer or venue owner. `Payout` records are created only by `paymentService.processPayout` from the payment route, and no admin action marks one settled.

This feature adds the missing write layer and the missing per-listing representation. Each Listing (an event or a venue) carries a Settlement_Ledger: what the listing earned, what has been settled to date, and what remains outstanding. An admin records real transfers as append-only Settlement_Entry records carrying the amount actually transferred, a Settlement_Reference (UTR or equivalent), and a settlement date. The system computes and displays Net_Payable and Outstanding_Amount; the admin records the actual movement of money. A Settlement_Entry is a recorded fact about a bank transfer, never a re-derivation of billing.

Alongside the ledger, each listing gets a complete statistics representation: money figures (Gross_Collected, Platform_Fee_Collected, GST_Retained, Platform_Commission, Net_Payable, Settled_To_Date, Outstanding_Amount, Refunded_Total) and sales activity figures (tickets or bookings sold, confirmed versus cancelled, refund count, last payment date). The same per-listing figures are mirrored read-only to the listing owner, excluding admin-internal notes, and the owner is notified when a settlement is recorded.

This is the first write path over money records in the platform, so it carries protections proportional to that: admin-only access, an over-settlement guard, idempotent creation, append-only correction by reversal rather than deletion, and a full audit trail of who settled what and when.

### Scope and relationship to other specs

- `payout-earnings-breakdown` is implemented and owns the platform-wide read/reporting surface. This spec extends `Earnings_Service` per listing rather than replacing it, and MUST NOT introduce a second way of computing money.
- `payout-earnings-visibility` is requirements-only (no design, no tasks). **This spec supersedes it** for per-event and per-venue earnings representation and for owner-facing per-listing earnings views, and adds the settlement write layer that spec never defined. `payout-earnings-visibility` requirements 3, 4, 5, and 6 are absorbed here.
- `platform-flow-fixes` owns billing, settlement, and payout computation, the discount-bearer contract, and the booking advance. This spec consumes those recorded numbers and MUST NOT redefine them.

### Acceptance criteria classes

Each acceptance criterion is tagged with the class it covers: **(Success)** the normal path, **(Boundary)** zero/empty/limit conditions, **(Failure)** rejected or unauthorized requests, and **(Exception)** upstream or service errors. EARS patterns are used throughout.

## Glossary

Terms carried forward from `payout-earnings-breakdown` and `payout-earnings-visibility`:

- **Admin_App**: The React application under `admin/` used by platform administrators.
- **Client_App**: The Next.js application under `client/` used by event organizers and venue owners.
- **Earnings_Service**: The single server-side aggregator (`server/services/earningsService.js`) that reads `Payment` and `Payout` records into earnings figures.
- **Admin_Role**: The administrator sub-role carried on the session: `super_admin`, `admin`, or `moderator`.
- **Recipient_Party**: An event organizer (for event ticket sales) or a venue owner (for venue bookings) who receives a settlement.
- **Gross_Collected**: The total collected from buyers for a scope, equal to the sum of `Payment.totalAmount` over payments whose `status` is `success` in that scope.
- **Platform_Fee_Collected**: The sum of `Payment.platformFee` over successful payments in scope, being the buyer-paid platform fee.
- **GST_Retained**: The sum of `Payment.gstAmount` over successful payments in scope.
- **Owner_Gross**: The gross attributable to a Recipient_Party before commission, derived from `Payment.listedPrice` per the discount-bearer contract: `discountBearer` of `platform` or `null` keeps the full `listedPrice`; `discountBearer` of `owner` reduces it by `discountAmount`.
- **Platform_Commission**: The platform's commission on Owner_Gross at settlement, matching the recorded `Payout.platformCommission`.
- **Net_Payable**: The amount owed to a Recipient_Party for a scope, equal to `Owner_Gross − Platform_Commission`, matching the recorded `Payout.netAmount`.
- **Payout_Status**: The lifecycle state of a `Payout` record: `pending`, `processing`, `completed`, or `failed`.
- **Refunded_Total**: The sum of `Payment.totalAmount` over payments whose `status` is `refunded` in scope.

Terms introduced by this spec:

- **Listing**: An event or a venue that earns money on the platform and is settled to a single Recipient_Party. A Listing is identified by its kind (`event` or `venue`) and its identifier.
- **Listing_Stats**: The complete per-Listing figure set returned by the Settlement_Service, comprising the money figures and the activity figures defined in Requirements 2 and 3.
- **Settlement_Entry**: An immutable record of one real money transfer from the platform to a Recipient_Party for one Listing, carrying `settledAmount`, `settlementReference`, `settledAt`, `method`, optional `adminNotes`, `recordedBy`, and an optional reversal linkage.
- **Settlement_Ledger**: The ordered set of all Settlement_Entry records for one Listing, together with the derived Settled_To_Date and Outstanding_Amount.
- **Settled_To_Date**: The sum of `settledAmount` over all effective Settlement_Entry records for a Listing, where a reversed entry and its reversing entry contribute zero in total.
- **Outstanding_Amount**: `Net_Payable − Settled_To_Date` for a Listing, floored at zero for display when Settled_To_Date exceeds Net_Payable.
- **Settlement_Reference**: The admin-supplied external transfer identifier for a Settlement_Entry, such as a UTR or bank reference.
- **Settlement_State**: The derived state of a Listing's ledger: `not_settled` when Settled_To_Date is zero, `partially_settled` when Settled_To_Date is greater than zero and less than Net_Payable, `fully_settled` when Settled_To_Date equals Net_Payable, and `over_settled` when Settled_To_Date exceeds Net_Payable.
- **Reversal_Entry**: A Settlement_Entry that negates a specific prior Settlement_Entry, carrying the reversed entry's identifier and a mandatory reason. Correction is performed by appending a Reversal_Entry, never by editing or deleting an existing entry.
- **Settlement_Service**: The server-side capability that reads the Settlement_Ledger and Listing_Stats and records Settlement_Entry and Reversal_Entry records. It reads money figures from Earnings_Service and never recomputes them.
- **Listing_Settlement_Panel**: The Admin_App surface, on the event detail and venue detail views, that presents Listing_Stats, the Settlement_Ledger, and the settlement recording controls.
- **Owner_Settlement_View**: The Client_App surface where a Recipient_Party sees the read-only mirror of Listing_Stats and the Settlement_Ledger for a Listing they own.
- **Idempotency_Key**: A caller-supplied value accompanying a settlement recording request that identifies that request uniquely, used to collapse duplicate submissions of the same transfer.
- **Audit_Log**: The existing `server/models/AuditLog.js` record store that captures administrator actions.
- **Settlement_Notification**: The message delivered to a Recipient_Party through the existing notification capability when a Settlement_Entry is recorded for one of their Listings.

## Requirements

### Requirement 1: Per-listing settlement ledger read

**User Story:** As a platform admin, I want each listing's settlement ledger on that listing's detail view, so that I can see what the listing earned, what has already been transferred, and what is still outstanding before I move money.

#### Acceptance Criteria

1. WHEN an admin opens the Listing_Settlement_Panel for a Listing, THE Settlement_Service SHALL return the Listing's Net_Payable, Settled_To_Date, Outstanding_Amount, and Settlement_State. **(Success)**
2. WHEN an admin opens the Listing_Settlement_Panel for a Listing, THE Settlement_Service SHALL return every Settlement_Entry for that Listing including `settledAmount`, `settlementReference`, `settledAt`, `method`, `adminNotes`, the display name of the administrator in `recordedBy`, and any reversal linkage. **(Success)**
3. WHEN the Listing_Settlement_Panel renders the Settlement_Ledger, THE Admin_App SHALL order Settlement_Entry records by `settledAt` descending. **(Success)**
4. WHEN the Listing_Settlement_Panel renders, THE Admin_App SHALL display Net_Payable, Settled_To_Date, and Outstanding_Amount as three distinct labeled figures in INR alongside the Settlement_State. **(Success)**
5. WHERE a Listing has an associated `Payout` record, THE Admin_App SHALL display that record's Payout_Status and recorded `netAmount` alongside the Settlement_Ledger. **(Success)**
6. IF a Listing has no Settlement_Entry records, THEN THE Admin_App SHALL display Settled_To_Date as ₹0, Outstanding_Amount as equal to Net_Payable, Settlement_State as `not_settled`, and an empty-ledger indication. **(Boundary)**
7. IF a Listing has no successful payments, THEN THE Admin_App SHALL display Net_Payable as ₹0, Outstanding_Amount as ₹0, and an indication that no settlement is due. **(Boundary)**

### Requirement 2: Per-listing money statistics representation

**User Story:** As a platform admin, I want the complete money breakdown for a single listing in one place, so that I can justify the settlement amount without cross-referencing other screens.

#### Acceptance Criteria

1. WHEN an admin opens the Listing_Settlement_Panel for a Listing, THE Settlement_Service SHALL return that Listing's Gross_Collected, Platform_Fee_Collected, GST_Retained, Owner_Gross, Platform_Commission, Net_Payable, Settled_To_Date, Outstanding_Amount, and Refunded_Total. **(Success)**
2. WHEN the Listing_Settlement_Panel renders Listing_Stats, THE Admin_App SHALL display each figure named in criterion 1 as a distinct labeled figure in INR. **(Success)**
3. WHEN the Listing_Settlement_Panel renders Listing_Stats, THE Admin_App SHALL group the figures into a buyer-side group containing Gross_Collected, Platform_Fee_Collected, and GST_Retained, and an owner-side group containing Owner_Gross, Platform_Commission, Net_Payable, Settled_To_Date, and Outstanding_Amount. **(Success)**
4. THE Settlement_Service SHALL obtain every money figure named in criterion 1 other than Settled_To_Date and Outstanding_Amount from Earnings_Service. **(Success)**
5. WHERE the Listing kind is `venue` and a booking payment reflects the collected advance, THE Admin_App SHALL label the displayed Gross_Collected as the advance amount collected. **(Boundary)**
6. IF a money figure for a Listing is absent or null, THEN THE Admin_App SHALL display that figure as ₹0. **(Boundary)**

### Requirement 3: Per-listing sales activity statistics

**User Story:** As a platform admin, I want the sales activity behind a listing's money, so that I can tell whether an outstanding balance reflects healthy sales or cancellations and refunds.

#### Acceptance Criteria

1. WHEN an admin opens the Listing_Settlement_Panel for a Listing, THE Settlement_Service SHALL return the count of successful payments, the count of tickets or bookings sold, the count of confirmed bookings or tickets, the count of cancelled bookings or tickets, the count of refunded payments, and the timestamp of the most recent successful payment for that Listing. **(Success)**
2. WHEN the Listing_Settlement_Panel renders activity statistics, THE Admin_App SHALL display each count named in criterion 1 as a distinct labeled figure. **(Success)**
3. WHEN the Listing_Settlement_Panel renders activity statistics, THE Admin_App SHALL display the timestamp of the most recent successful payment as an absolute date and time. **(Success)**
4. IF a Listing has no payment records, THEN THE Admin_App SHALL display every count named in criterion 1 as 0 and SHALL display the most recent payment timestamp as an explicit "no payments yet" indication rather than a blank or placeholder date. **(Boundary)**

### Requirement 4: Recording a settlement entry

**User Story:** As a platform admin, I want to record the amount I actually transferred for a listing along with its bank reference and date, so that the platform's record of settlement matches the bank.

#### Acceptance Criteria

1. WHEN an admin submits a settlement recording request for a Listing with a `settledAmount`, a `settlementReference`, a `settledAt` date, and an Idempotency_Key, THE Settlement_Service SHALL create one Settlement_Entry for that Listing carrying those values, the submitting administrator's identifier in `recordedBy`, and the submission timestamp. **(Success)**
2. WHEN a Settlement_Entry is created, THE Settlement_Service SHALL recompute Settled_To_Date and Outstanding_Amount for that Listing from the Settlement_Ledger and return the updated Settlement_State. **(Success)**
3. WHEN a Settlement_Entry is created, THE Admin_App SHALL display the updated Settled_To_Date, Outstanding_Amount, Settlement_State, and the new entry in the Settlement_Ledger without requiring a manual page reload. **(Success)**
4. WHERE an admin supplies `adminNotes` with a settlement recording request, THE Settlement_Service SHALL store that text on the Settlement_Entry. **(Success)**
5. WHERE an admin supplies no `method` with a settlement recording request, THE Settlement_Service SHALL record the Settlement_Entry `method` as `manual`. **(Boundary)**
6. THE Settlement_Service SHALL store `settledAmount` as a whole number of rupees. **(Success)**
7. IF a settlement recording request carries a `settledAmount` that is absent, not a whole number, or less than or equal to zero, THEN THE Settlement_Service SHALL reject the request with a validation error naming `settledAmount` and SHALL create no Settlement_Entry. **(Failure)**
8. IF a settlement recording request carries an absent or empty `settlementReference`, THEN THE Settlement_Service SHALL reject the request with a validation error naming `settlementReference` and SHALL create no Settlement_Entry. **(Failure)**
9. IF a settlement recording request carries a `settledAt` date that is absent, unparseable, or later than the time of submission, THEN THE Settlement_Service SHALL reject the request with a validation error naming `settledAt` and SHALL create no Settlement_Entry. **(Failure)**
10. IF a settlement recording request names a Listing that does not exist, THEN THE Settlement_Service SHALL reject the request with a not-found error and SHALL create no Settlement_Entry. **(Failure)**
11. IF creation of a Settlement_Entry fails after validation, THEN THE Settlement_Service SHALL leave the Settlement_Ledger unchanged and THE Admin_App SHALL display an error indicating the settlement was not recorded. **(Exception)**

### Requirement 5: Over-settlement guard

**User Story:** As a platform operator, I want the system to block a settlement that would pay a listing more than it earned unless a super admin explicitly overrides with a reason, so that overpayments are deliberate and documented.

#### Acceptance Criteria

1. WHEN a settlement recording request is received, THE Settlement_Service SHALL compare the sum of the requested `settledAmount` and the Listing's current Settled_To_Date against the Listing's Net_Payable. **(Success)**
2. IF that sum exceeds Net_Payable AND the request carries no override, THEN THE Settlement_Service SHALL reject the request with an over-settlement error stating Net_Payable, Settled_To_Date, and the maximum amount that can be recorded, and SHALL create no Settlement_Entry. **(Failure)**
3. WHERE a settlement recording request carries an override flag and an override reason AND the requesting Admin_Role is `super_admin`, THE Settlement_Service SHALL create the Settlement_Entry, mark it as an over-settlement, and store the override reason on the entry. **(Success)**
4. IF a settlement recording request carries an override flag AND the requesting Admin_Role is not `super_admin`, THEN THE Settlement_Service SHALL reject the request with an authorization error and SHALL create no Settlement_Entry. **(Failure)**
5. IF a settlement recording request carries an override flag with an absent or empty override reason, THEN THE Settlement_Service SHALL reject the request with a validation error naming the override reason and SHALL create no Settlement_Entry. **(Failure)**
6. WHEN a Listing's Settled_To_Date exceeds its Net_Payable, THE Admin_App SHALL display the Settlement_State as `over_settled`, SHALL display the excess amount as a distinct labeled figure, and SHALL display Outstanding_Amount as ₹0. **(Boundary)**
7. WHEN the requested `settledAmount` added to Settled_To_Date equals Net_Payable exactly, THE Settlement_Service SHALL accept the request without requiring an override. **(Boundary)**

### Requirement 6: Idempotent settlement recording

**User Story:** As a platform admin, I want a resubmitted settlement to be recorded once, so that a double-click or a retried request never double-counts a single bank transfer.

#### Acceptance Criteria

1. WHEN a settlement recording request carries an Idempotency_Key that matches an existing Settlement_Entry for the same Listing, THE Settlement_Service SHALL return that existing Settlement_Entry and SHALL create no additional Settlement_Entry. **(Boundary)**
2. THE Settlement_Service SHALL enforce uniqueness of the pair of Listing identifier and Idempotency_Key at the data store level. **(Success)**
3. IF a settlement recording request omits an Idempotency_Key, THEN THE Settlement_Service SHALL reject the request with a validation error naming the Idempotency_Key and SHALL create no Settlement_Entry. **(Failure)**
4. WHILE a settlement recording request is in flight, THE Admin_App SHALL disable the settlement submission control. **(Boundary)**
5. WHEN a settlement recording request returns an existing Settlement_Entry for a matched Idempotency_Key, THE Admin_App SHALL display the recorded entry and SHALL indicate that the settlement was already recorded. **(Boundary)**

### Requirement 7: Settlement correction by append-only reversal

**User Story:** As a platform admin, I want to correct a wrongly recorded settlement by reversing it rather than deleting it, so that the financial history stays complete and auditable.

#### Acceptance Criteria

1. WHEN an admin submits a reversal request naming an existing Settlement_Entry and a reason, THE Settlement_Service SHALL create a Reversal_Entry that references that Settlement_Entry, carries the reason, negates the reversed entry's `settledAmount`, and records the submitting administrator's identifier. **(Success)**
2. WHEN a Reversal_Entry is created, THE Settlement_Service SHALL exclude both the reversed Settlement_Entry and the Reversal_Entry from Settled_To_Date so that the pair contributes zero. **(Success)**
3. THE Settlement_Service SHALL preserve every Settlement_Entry record unchanged for the lifetime of the Listing and SHALL provide no capability to edit or delete a Settlement_Entry. **(Success)**
4. WHEN the Listing_Settlement_Panel renders the Settlement_Ledger, THE Admin_App SHALL display a reversed Settlement_Entry with a reversed indication, its reversal reason, and the Reversal_Entry's recording administrator and timestamp. **(Success)**
5. IF a reversal request names a Settlement_Entry that is already reversed, THEN THE Settlement_Service SHALL reject the request with a conflict error and SHALL create no Reversal_Entry. **(Failure)**
6. IF a reversal request names a Settlement_Entry that does not exist or does not belong to the named Listing, THEN THE Settlement_Service SHALL reject the request with a not-found error and SHALL create no Reversal_Entry. **(Failure)**
7. IF a reversal request carries an absent or empty reason, THEN THE Settlement_Service SHALL reject the request with a validation error naming the reason and SHALL create no Reversal_Entry. **(Failure)**
8. IF a reversal request names a Settlement_Entry that is itself a Reversal_Entry, THEN THE Settlement_Service SHALL reject the request with a validation error and SHALL create no Reversal_Entry. **(Failure)**

### Requirement 8: Audit trail for settlement actions

**User Story:** As a platform operator, I want every settlement action attributed to a named administrator with its amount and target, so that money movement can be audited after the fact.

#### Acceptance Criteria

1. WHEN a Settlement_Entry is created, THE Settlement_Service SHALL write an Audit_Log record capturing the acting administrator's identifier, the action, the Listing kind and identifier, the `settledAmount`, the `settlementReference`, and the action timestamp. **(Success)**
2. WHEN a Reversal_Entry is created, THE Settlement_Service SHALL write an Audit_Log record capturing the acting administrator's identifier, the action, the reversed Settlement_Entry identifier, the reversal reason, and the action timestamp. **(Success)**
3. WHERE a Settlement_Entry is created under a super admin over-settlement override, THE Settlement_Service SHALL record the override reason in the Audit_Log record for that action. **(Success)**
4. IF the Audit_Log write fails, THEN THE Settlement_Service SHALL reject the settlement recording request with an error and SHALL create no Settlement_Entry, so that no settlement exists without an audit record. **(Exception)**
5. WHEN an administrator views the Audit_Log surface, THE Admin_App SHALL display settlement and reversal actions with their acting administrator, Listing, and amount. **(Success)**

### Requirement 9: Owner-facing read-only mirror

**User Story:** As an event organizer or venue owner, I want to see the same per-listing figures and settlement history the admin sees, so that I know exactly what I earned, what has been paid to me, and what is still owed.

#### Acceptance Criteria

1. WHEN an authenticated Recipient_Party opens the Owner_Settlement_View for a Listing they own, THE Settlement_Service SHALL return that Listing's Owner_Gross, Platform_Commission, Net_Payable, Settled_To_Date, Outstanding_Amount, Settlement_State, Refunded_Total, and the activity counts named in Requirement 3 criterion 1. **(Success)**
2. WHEN an authenticated Recipient_Party opens the Owner_Settlement_View for a Listing they own, THE Settlement_Service SHALL return every effective Settlement_Entry for that Listing including `settledAmount`, `settlementReference`, and `settledAt`. **(Success)**
3. THE Settlement_Service SHALL exclude `adminNotes`, override reasons, the recording administrator's identity, and Recipient_Party bank details from every Owner_Settlement_View response. **(Success)**
4. WHEN the Owner_Settlement_View renders, THE Client_App SHALL display Net_Payable, Settled_To_Date, and Outstanding_Amount as three distinct labeled figures in INR alongside the Settlement_State and the settlement history. **(Success)**
5. WHEN the Owner_Settlement_View renders a reversed Settlement_Entry, THE Client_App SHALL display that entry with a reversed indication and SHALL exclude its amount from Settled_To_Date. **(Success)**
6. THE Client_App SHALL present the Owner_Settlement_View as read-only and SHALL provide no control that creates, edits, reverses, or disputes a Settlement_Entry. **(Success)**
7. IF a Listing owned by the requester has no Settlement_Entry records, THEN THE Client_App SHALL display Settled_To_Date as ₹0, Outstanding_Amount as equal to Net_Payable, and an indication that no settlement has been made yet. **(Boundary)**
8. IF a Listing owned by the requester has no successful payments, THEN THE Client_App SHALL display every money figure as ₹0 and an indication that no payout is yet due. **(Boundary)**
9. WHEN a monetary figure is displayed on both the Listing_Settlement_Panel and the Owner_Settlement_View for the same Listing, THE Settlement_Service SHALL return the same integer-rupee value to both surfaces. **(Success)**

### Requirement 10: Owner notification on settlement

**User Story:** As an event organizer or venue owner, I want to be told when a settlement is recorded for my listing, so that I can reconcile it against my bank account without polling the dashboard.

#### Acceptance Criteria

1. WHEN a Settlement_Entry is created for a Listing, THE Settlement_Service SHALL send a Settlement_Notification to that Listing's Recipient_Party stating the Listing name, the `settledAmount`, the `settledAt` date, and the `settlementReference`. **(Success)**
2. WHEN a Reversal_Entry is created for a Listing, THE Settlement_Service SHALL send a Settlement_Notification to that Listing's Recipient_Party stating that a previously recorded settlement was reversed and the updated Settled_To_Date. **(Success)**
3. THE Settlement_Service SHALL exclude `adminNotes`, override reasons, and the recording administrator's identity from every Settlement_Notification. **(Success)**
4. IF delivery of a Settlement_Notification fails, THEN THE Settlement_Service SHALL retain the created Settlement_Entry, record the delivery failure, and return a success result for the settlement recording. **(Exception)**
5. IF a Listing has no resolvable Recipient_Party, THEN THE Settlement_Service SHALL record the Settlement_Entry, skip notification delivery, and THE Admin_App SHALL display an indication that no owner could be notified. **(Boundary)**

### Requirement 11: Access control for settlement actions and views

**User Story:** As a platform operator, I want settlement writes and admin-internal settlement data restricted to authorized administrators, so that money records cannot be created or read by unauthorized parties.

#### Acceptance Criteria

1. WHEN a request to read the Listing_Settlement_Panel data is received, THE Settlement_Service SHALL require an authenticated session whose Admin_Role is `super_admin` or `admin`. **(Success)**
2. WHEN a request to create a Settlement_Entry or a Reversal_Entry is received, THE Settlement_Service SHALL require an authenticated session whose Admin_Role is `super_admin` or `admin`. **(Success)**
3. IF a settlement read or write request carries the `moderator` Admin_Role, THEN THE Settlement_Service SHALL reject the request with an authorization error, THE Admin_App SHALL hide the settlement recording controls for that role, and no Settlement_Entry SHALL be created. **(Failure)**
4. IF a settlement read or write request lacks a valid admin session, THEN THE Settlement_Service SHALL reject the request with an authorization error and SHALL return no settlement or money figures. **(Failure)**
5. IF a Recipient_Party requests the Owner_Settlement_View for a Listing they do not own, THEN THE Settlement_Service SHALL reject the request with an authorization error and SHALL return no settlement or money figures for that Listing. **(Failure)**
6. WHEN THE Settlement_Service rejects a request for an authentication or authorization failure, THE Settlement_Service SHALL leave every `Payment`, `Payout`, and Settlement_Entry record unchanged. **(Failure)**

### Requirement 12: Consistency with the recorded money model

**User Story:** As a maintainer, I want settlement figures derived only from recorded money records, so that the settlement ledger never diverges from what was billed and paid.

#### Acceptance Criteria

1. THE Settlement_Service SHALL read every money figure other than Settled_To_Date and Outstanding_Amount verbatim from the values Earnings_Service returns, without arithmetic re-derivation from percentages. **(Success)**
2. THE Settlement_Service SHALL compute Settled_To_Date solely as the sum of effective Settlement_Entry `settledAmount` values for the Listing. **(Success)**
3. FOR any Listing, THE Settlement_Service SHALL ensure that Settled_To_Date plus Outstanding_Amount equals Net_Payable whenever Settlement_State is not `over_settled`. **(Boundary)**
4. THE Settlement_Service SHALL treat a `settledAmount` as a recorded fact about a transfer and SHALL NOT adjust it to match Net_Payable. **(Success)**
5. IF Earnings_Service cannot produce the money figures for a Listing, THEN THE Settlement_Service SHALL return an error naming that Listing, SHALL suppress display of Net_Payable and Outstanding_Amount, and SHALL reject any settlement recording request for that Listing. **(Exception)**
6. WHEN a monetary amount is rendered, THE Admin_App and THE Client_App SHALL prefix it with the ₹ symbol, group it using the Indian numbering system, and display no fractional portion, matching the existing `formatInr` helpers. **(Success)**

### Requirement 13: Loading, empty, and error representation

**User Story:** As any viewer of a settlement surface, I want to distinguish loading, genuinely zero, and failed states, so that I never mistake a failure for a zero balance.

#### Acceptance Criteria

1. WHILE settlement or statistics data is being retrieved, THE Admin_App and THE Client_App SHALL display a loading indication and SHALL NOT concurrently display an empty-state indication or an error indication. **(Boundary)**
2. WHEN retrieval completes successfully and returns no payments and no Settlement_Entry records for a Listing, THE Admin_App and THE Client_App SHALL replace the loading indication with an empty-state indication that names the Listing as having no records. **(Boundary)**
3. IF retrieval of settlement or statistics data fails, THEN THE Admin_App and THE Client_App SHALL replace the loading indication with an error indication, SHALL provide a retry control, and SHALL NOT display stale or partial figures as current. **(Exception)**
4. WHEN a viewer activates the retry control, THE Admin_App and THE Client_App SHALL re-initiate retrieval for the same Listing and SHALL return to the loading indication. **(Success)**
5. IF a settlement recording request is rejected, THEN THE Admin_App SHALL display the returned error message, SHALL retain the values the admin entered in the settlement form, and SHALL leave the displayed Settlement_Ledger unchanged. **(Failure)**
