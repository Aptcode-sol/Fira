# Implementation Plan: Payout & Earnings Breakdown

## Overview

This plan builds the read-only earnings/payout reporting feature from the inside out: the shared INR formatter and pure attribution/masking helpers first, then the single `earningsService` aggregator (`server/services/earningsService.js`) method by method, each immediately covered by its design properties. HTTP routes wire the service to the network behind the existing auth guards, then the three frontend surfaces (admin `Payouts.jsx`, `Event_Earnings_View`, `Venue_Earnings_View`) consume those routes.

Backend service + properties come before routes; routes come before frontend surfaces. Every monetary figure is read verbatim from recorded integer-rupee fields — no recomputation. Tests follow existing conventions: `vitest` + `fast-check` + `mongodb-memory-server` for server logic/properties (`server/__tests__/*.property.test.ts`), `supertest` integration for routes, and client component tests (`client/__tests__/`).

Each property test is tagged with the form:
**Feature: payout-earnings-breakdown, Property {number}: {property_text}** and runs ≥100 iterations (fast-check `numRuns` ≥ 100).

## Tasks

- [x] 1. Shared INR formatter and pure attribution/masking helpers
  - [x] 1.1 Implement shared INR formatter `formatInr`
    - Wrap `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`; prefix `₹`, Indian grouping, integer rupees only
    - `null`/`undefined`/absent amount → `₹0`
    - Place the canonical implementation on the server (`server/utils/formatInr.js`) and mirror equivalent tiny helpers in `client/src/lib/formatInr` and the admin app so the same recorded amount renders identically on every surface
    - _Requirements: 9.1, 9.2, 9.5_

  - [ ]* 1.2 Write property test for `formatInr`
    - **Property 15: INR formatting is consistent, grouped, integer-rupee, and safe on null**
    - **Validates: Requirements 9.1, 9.2, 9.5**
    - Generate integer rupee amounts including 0, lakhs/crores-scale values, plus `null`/`undefined`; assert `₹` prefix, Indian grouping equal to `Intl.NumberFormat('en-IN', …)`, no paise, determinism, and `₹0` on absent input

  - [x] 1.3 Implement `computePayeeGross(payment)` in `earningsService`
    - Create `server/services/earningsService.js` (plain-object module export) with the shared status constants (`PAID='success'`, `REFUNDED='refunded'`, `PENDING_PAYOUT=['pending','processing']`, `COMPLETED_PAYOUT='completed'`)
    - Discount attribution mirroring `processPayout`: `platform`/`null` → `listedPrice`; `owner` → `listedPrice − discountAmount`; reject invalid discount / unknown bearer with an error indication; `Math.round` semantics identical to `calculateBilling`/`processPayout`; never negative
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 1.4 Write property test for payee gross discount attribution
    - **Property 13: Payee gross discount attribution**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

  - [ ]* 1.5 Write property test for invalid discount exclusion
    - **Property 14: Invalid discount input is excluded without corrupting earnings**
    - **Validates: Requirements 8.6, 8.7**

  - [x] 1.6 Implement `maskAccountNumber(accountNumber)` in `earningsService`
    - Preserve last four characters, replace every preceding digit with a masking character, preserve overall length; applied to every account number returned to any surface
    - _Requirements: 2.5, 11.5_

  - [ ]* 1.7 Write property test for account number masking
    - **Property 6: Account number masking preserves only the last four digits**
    - **Validates: Requirements 2.5, 11.5**

- [x] 2. Implement admin overview aggregation
  - [x] 2.1 Implement `getAdminOverview({ from, to })`
    - Aggregate verbatim integer-rupee sums: `grossCollected` (Σ `totalAmount` where `status='success'`), `gstCollected` (Σ `gstAmount`), `platformCommissionEarned` (Σ `platformFee`), `refundedTotal` (Σ `amount` where `status='refunded'`); `paidOut` (Σ `Payout.netAmount` where `status='completed'`), `pendingPayout` (Σ where `status ∈ {pending,processing}`)
    - `netPayable = grossCollected − platformCommissionEarned − gstCollected`
    - Build `reconciliation` block (`platformRetained`, `payeeAttributed`, `refundedTotal`, `residual`, `discrepancy` when `|residual| > 0.01`); apply optional inclusive `createdAt` range identically to every figure; fail closed (error, no partial/stale totals) on retrieval/compute failure or violated identity
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 4.2, 4.3, 4.4, 4.5, 7.1, 7.3, 9.3, 9.4, 10.1, 10.3, 10.5_

  - [ ]* 2.2 Write property test for headline aggregates
    - **Property 1: Headline aggregates equal the verbatim sum over collected Payments**
    - **Validates: Requirements 1.2, 1.3, 1.6, 4.2, 7.1, 7.3, 9.4**

  - [ ]* 2.3 Write property test for payout aggregates
    - **Property 2: Payout aggregates equal the verbatim sum by status**
    - **Validates: Requirements 1.4, 1.5**

  - [ ]* 2.4 Write property test for net payable identity
    - **Property 3: Net payable identity**
    - **Validates: Requirements 1.7, 5.6, 6.3**

  - [ ]* 2.5 Write property test for date range application
    - **Property 4: Date range applies identically to every figure**
    - **Validates: Requirements 1.8**

  - [ ]* 2.6 Write property test for reconciliation identity
    - **Property 9: Reconciliation identity, residual, and discrepancy flag**
    - **Validates: Requirements 4.3, 4.4, 4.5, 10.3, 10.5**

  - [ ]* 2.7 Write property test for verbatim figures
    - **Property 16: Displayed figures are read verbatim from recorded fields**
    - **Validates: Requirements 9.3, 10.1**

- [x] 3. Implement per-recipient payable breakdown
  - [x] 3.1 Implement `getRecipientBreakdown({ from, to })`
    - Group `Payout` records by `recipient` within each `type` section (`event_tickets`, `venue_booking`); per recipient compute `grossEarnings`, `commissionDeducted`, `netPayable = gross − commission`, `owedNow` (Σ `netAmount` where `status ∈ {pending,processing}`, else 0), masked `bankDetails` (via `maskAccountNumber`) or `bankDetailsMissing: true`; exclude recipients with missing bank details from `readyToPayTotal`; all monetary values non-negative
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [ ]* 3.2 Write property test for recipient breakdown
    - **Property 5: Per-recipient breakdown rows are correct, non-negative, and partitioned by type**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

- [x] 4. Implement payout lifecycle list
  - [x] 4.1 Implement `getPayoutList({ statuses })`
    - Return rows exposing `status` (or `unknown` when absent/invalid), `grossAmount`, `platformCommission`, `platformCommissionPercentage`, `netAmount`; `processedAt` only when `completed`; `failureReason` only when `failed` (and no `processedAt`); optional filter to selected `status` values (exact matching subset, empty match → empty list); set `refundAfterCompleted: true` when a `refunded` Payment exists for the same reference as a `completed` Payout, returning that Payout unchanged
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 7.5_

  - [ ]* 4.2 Write property test for payout lifecycle fields
    - **Property 7: Payout lifecycle fields follow status**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5**

  - [ ]* 4.3 Write property test for payout status filter
    - **Property 8: Payout status filter returns exactly the matching subset**
    - **Validates: Requirements 3.6, 3.7**

  - [ ]* 4.4 Write property test for refund-after-completed flag
    - **Property 17: Refund-after-completed reconciliation flag**
    - **Validates: Requirements 7.5**

- [x] 5. Implement event and venue earnings
  - [x] 5.1 Implement `getEventEarnings(eventId, requesterId)`
    - Enforce ownership (`Event.organizer === requesterId`) server-side, throwing an authorization error otherwise and returning no data
    - `grossTicketSales` (Σ `totalAmount`, `status='success'`, referencing event; 0 when none), `platformCommissionDeducted` (Σ `platformFee`), `gst` (Σ `gstAmount`), `netEarnings = gross − commission − gst`, `payoutStatus` (referencing Payout status or `not yet initiated`)
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 5.2 Write property test for scoped gross
    - **Property 10: Scoped gross equals the sum of paid amounts for that reference**
    - **Validates: Requirements 5.2, 6.2**

  - [ ]* 5.3 Write property test for reference payout status
    - **Property 11: Payout status for a reference, or "not yet initiated"**
    - **Validates: Requirements 5.3, 5.4, 6.5, 6.6**

  - [x] 5.4 Implement `getVenueEarnings(venueId, requesterId)`
    - Enforce ownership (`Venue.owner === requesterId`) server-side; per-booking rows: `grossBookingAmount`, `advancePaid` (Σ paid `Payment.amount`), `commissionDeducted`, `netPayable = recognizedGross − commissionDeducted`, `balanceOutstanding` true iff `0 < advancePaid < grossBookingAmount`, `payoutStatus`; booking with no paid Payment → all-zero figures + `not yet initiated`
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 5.5 Write property test for outstanding balance detection
    - **Property 12: Outstanding balance detection**
    - **Validates: Requirements 6.4**

  - [ ]* 5.6 Write property test for ownership and role authorization
    - **Property 18: Earnings surfaces enforce ownership and role, returning no data when unauthorized**
    - **Validates: Requirements 5.5, 6.7, 6.8, 11.1, 11.2, 11.3, 11.4**

- [x] 6. Checkpoint - service layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Wire HTTP routes and integration coverage
  - [x] 7.1 Add admin earnings routes to `server/routes/admin.js`
    - `GET /admin/earnings/overview?from&to` → `getAdminOverview`; `GET /admin/earnings/recipients?from&to` → `getRecipientBreakdown`; `GET /admin/earnings/payouts?status=` → `getPayoutList`
    - Behind `adminAuth` + `roleGuard(['super_admin','admin'])` (moderator rejected); map failures to `500 { error }`; perform no writes
    - _Requirements: 1.1, 11.1, 11.2, 11.6_

  - [x] 7.2 Add `GET /events/:id/earnings` to `server/routes/event.js`
    - Behind `requireAuth()` plus server-side organizer ownership check delegating to `getEventEarnings`; 403 on non-owner, no data returned
    - _Requirements: 5.5, 11.3_

  - [x] 7.3 Add `GET /venues/:id/earnings` to `server/routes/venue.js`
    - Behind `requireAuth()` plus server-side owner ownership check delegating to `getVenueEarnings`; 403 on non-owner, no data returned
    - _Requirements: 6.7, 6.8, 11.4_

  - [ ]* 7.4 Write integration tests for admin route guards
    - `supertest`: `super_admin`/`admin` allowed; `moderator`/unauthenticated/other roles rejected on `/admin/earnings/*` with no earnings/payout/bank data
    - _Requirements: 11.1, 11.2_

  - [ ]* 7.5 Write integration tests for event/venue ownership guards
    - `supertest`: owner allowed, non-owner rejected on `/events/:id/earnings` and `/venues/:id/earnings`
    - _Requirements: 5.5, 6.7, 6.8, 11.3, 11.4_

  - [ ]* 7.6 Write integration test for refund exclusion after transition
    - Transition a Payment to `refunded`, recompute, assert the refunded amount is excluded from net earnings figures
    - _Requirements: 7.2_

  - [ ]* 7.7 Write integration test for read-only / GET-only behavior
    - Earnings endpoints are GET-only with no mutation controls; rejected requests leave stored records unchanged
    - _Requirements: 2.7, 10.2, 11.6_

- [x] 8. Checkpoint - routes and integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Build the admin payouts dashboard surface
  - [x] 9.1 Add earnings methods to `admin/src/api/adminApi.js`
    - `getEarningsOverview`, `getEarningsRecipients`, `getEarningsPayouts` using existing `authHeaders`/`handle`
    - _Requirements: 1.1_

  - [x] 9.2 Implement `admin/src/pages/Payouts.jsx` and register it
    - Four regions: six headline figure cards, reconciliation summary (residual + discrepancy indicator), per-recipient breakdown (two sections, masked bank details, "bank details missing" badge, read-only), payout lifecycle list (status filter, `processedAt`/`failureReason`/`unknown` handling, empty-result indication); optional date-range control re-querying every figure with the same range; use shared `formatInr`; register route in `admin/src/App.jsx` and sidebar in `AdminDashboardLayout.jsx`
    - _Requirements: 1.1, 1.10, 2.1, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 9.5_

  - [ ]* 9.3 Write component tests for admin rendering presence
    - Six headline figures (1.1), four reconciliation figures (4.1), four payout fields (3.2)
    - _Requirements: 1.1, 3.2, 4.1_

  - [ ]* 9.4 Write component test for admin loading/empty/error/retry state machine
    - Loading within 300 ms, mutual exclusion with empty/error; empty-state on zero records; error + retry on failure/timeout; retry re-fetches same scope and returns to loading
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 9.5 Write example test for read-only guarantee and moderator UI hiding
    - No mutation controls present in the dashboard; dashboard hidden for a `moderator` session
    - _Requirements: 2.7, 11.2_

- [x] 10. Build the client earnings surfaces
  - [x] 10.1 Add `earningsApi` methods to `client/src/lib/api.ts`
    - Typed `getEventEarnings(eventId)` and `getVenueEarnings(venueId)` helpers following existing client api conventions
    - _Requirements: 5.1, 6.1_

  - [x] 10.2 Implement `Event_Earnings_View` route segment
    - `client/src/app/dashboard/creator/earnings/`: per-event breakdown card (gross / commission / GST / net) plus payout status; shared loading/empty/error state machine with retry; use shared `formatInr`; absent/null → `₹0`
    - _Requirements: 5.1, 5.3, 5.4, 9.5, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 10.3 Write component tests for the event earnings view
    - Four-figure card rendering (5.1) and loading/empty/error/retry state machine
    - _Requirements: 5.1, 12.1, 12.2, 12.3, 12.4_

  - [x] 10.4 Implement `Venue_Earnings_View` route segment
    - `client/src/app/venue-portal/earnings/`: per-booking table (gross / advance paid / commission / net / balance-outstanding / payout status) scoped to owner's venues; shared loading/empty/error state machine with retry; use shared `formatInr`; absent/null → `₹0`
    - _Requirements: 6.1, 6.4, 6.5, 6.6, 6.9, 9.5, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 10.5 Write component tests for the venue earnings view
    - Per-booking columns rendering (6.1) and loading/empty/error/retry state machine
    - _Requirements: 6.1, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 10.6 Write smoke test for event earnings render time
    - Event earnings breakdown renders within 3 s under a normal-volume dataset, run once (not iterated)
    - _Requirements: 5.7_

- [x] 11. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (test sub-tasks) and can be skipped for a faster MVP.
- Each task references specific requirement clauses for traceability; property tests additionally cite the design property they implement.
- Property tests use `fast-check` (≥100 iterations each) with `mongodb-memory-server` for record-backed aggregation, matching existing `server/__tests__/*.property.test.ts` conventions, and carry the `Feature: payout-earnings-breakdown, Property {n}` tag.
- The service is the single aggregator and reads recorded integer-rupee fields verbatim — no figure is re-derived from percentages.
- Checkpoints ensure incremental validation before moving from service → routes → surfaces.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.3", "1.2"] },
    { "id": 2, "tasks": ["1.6", "1.4", "1.5"] },
    { "id": 3, "tasks": ["2.1", "1.7"] },
    { "id": 4, "tasks": ["3.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"] },
    { "id": 5, "tasks": ["4.1", "3.2"] },
    { "id": 6, "tasks": ["5.1", "4.2", "4.3", "4.4"] },
    { "id": 7, "tasks": ["5.4", "5.2", "5.3"] },
    { "id": 8, "tasks": ["5.5", "5.6"] },
    { "id": 9, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 10, "tasks": ["7.4", "7.5", "7.6", "7.7"] },
    { "id": 11, "tasks": ["9.1", "10.1"] },
    { "id": 12, "tasks": ["9.2", "10.2", "10.4"] },
    { "id": 13, "tasks": ["9.3", "9.4", "9.5", "10.3", "10.5", "10.6"] }
  ]
}
```
