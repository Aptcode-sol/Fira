# Implementation Plan: Per-Listing Settlement Tracking

## Overview

Bottom-up along the design's one money path: the store first, then the single per-listing money read on `earningsService`, then `settlementService` as pure helpers before DB methods, then the routes, then the two UI surfaces. Every step is verifiable on its own — the pure fold is checkable with `node`, the DB methods with `mongodb-memory-server`, the routes with `supertest`, the panel through its state reducer.

Language follows the repo: CommonJS JavaScript on the server, JSX in `admin/`, TypeScript/TSX in `client/`. Tooling is what is already installed — `vitest` + `fast-check` + `mongodb-memory-server` + `supertest` under `server/__tests__/`, and assert-based `*.check.mjs` beside the source.

## Tasks

- [x] 1. Data layer
  - [x] 1.1 Create `server/models/Settlement.js`
    - Schema exactly as in the design: listing linkage (`listingKind`, `listing`, `listingModel`, `recipient`), the recorded transfer fact (`settledAmount`, `settlementReference`, `settledAt`, `method`), admin-internal fields (`adminNotes`, `isOverSettlement`, `overrideReason`), correction linkage (`isReversalOf`, `reversalReason`), provenance (`recordedBy`, `idempotencyKey`), `timestamps: true`
    - Three indexes: unique `(listingKind, listing, idempotencyKey)`, `(listingKind, listing, settledAt: -1)`, `(isReversalOf)`
    - No update or delete helper on the model — append-only is a property of the surface
    - Register in `server/models/index.js` alongside the existing models
    - _Requirements: 4.1, 4.6, 6.2, 7.3, 10.5_

  - [x] 1.2 Add the enum values the audit and notification surfaces need
    - `server/models/AuditLog.js`: add `'settle'`, `'reverse'` to the `action` enum, with the comment noting a missing value means a silently unrecorded action
    - `server/models/Notification.js`: add `'settlement_recorded'`, `'settlement_reversed'` to the `type` enum
    - _Requirements: 8.1, 8.2, 8.5, 10.1, 10.2_

- [x] 2. Per-listing money path on `earningsService`
  - [x] 2.1 Add `earningsService.getListingFigures({ kind, listingId })`
    - Buyer side summed verbatim from `Payment` (`grossCollected`, `platformFeeCollected`, `gstRetained` over `status: 'success'`; `refundedTotal` over `status: 'refunded'`); owner side summed verbatim from `Payout` (`ownerGross`, `platformCommission`, `netPayable`) — no re-derivation from a percentage
    - Scope per the design table: `event` → `referenceModel: 'Event'` + `Ticket { event }`; `venue` → `referenceModel: 'Booking'` over that venue's bookings + `Booking { venue }`
    - Activity: `successfulPayments`, `unitsSold`, `confirmed`, `cancelled`, `refundedPayments`, `lastPaymentAt` (null when there are no successful payments)
    - Return the `payout` summary (`payoutId`, `status`, `netAmount`) or `null`
    - Fail closed on a non-finite sum or a malformed/absent listing id, matching the existing `build*` helpers
    - _Requirements: 1.5, 2.1, 2.4, 3.1, 12.1, 12.5_

  - [-]* 2.2 Write property test for activity counts
    - **Property 18: Activity counts match the underlying records**
    - **Validates: Requirements 3.1, 3.4**
    - `server/__tests__/settlementActivityCounts.property.test.ts`, in-memory Mongo, generated payment/ticket/booking sets including the empty set
    - Tag: `Feature: per-listing-settlement-tracking, Property 18`

  - [-]* 2.3 Write unit tests for `getListingFigures` boundaries
    - Listing with payments but no `Payout` record → `netPayable: 0`, `payout: null` (the design's stated consequence)
    - Malformed id and non-finite sum both reject rather than returning a zeroed figure set
    - _Requirements: 1.7, 12.5_

- [ ] 3. `settlementService` pure core
  - [x] 3.1 Create `server/services/settlementService.js` with `buildLedger(rows, netPayable)`
    - Fold signed rows into `settledToDate`, `outstandingAmount` (floored at zero), `excessAmount`, `state`
    - A reversal row and its target both contribute zero — the pair nets out
    - `EPSILON = 0.01` for every comparison, the same tolerance `earningsService.buildOverview` already uses
    - _Requirements: 1.1, 1.6, 1.7, 4.2, 5.6, 5.7, 7.2, 12.2, 12.3_

  - [~] 3.2 Add `checkOverSettlement` and `validateEntry`
    - `checkOverSettlement({ settledToDate, netPayable, settledAmount, override, adminRole })` returns `{ allowed: true }` or the rejection carrying `code: 'over_settlement'`, `netPayable`, `settledToDate`, `maxRecordable`; override accepted only for `super_admin` with a non-empty reason
    - `validateEntry(input, now)` names the offending field for a non-integer/non-positive amount, blank reference, absent/unparseable/future `settledAt`, missing `idempotencyKey`, or override without reason
    - Both are decisions only — neither mutates or touches Mongo
    - _Requirements: 4.7, 4.8, 4.9, 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 6.3_

  - [~] 3.3 Add `toAdminRow` and `toOwnerRow`
    - `toAdminRow(row, reversalByTarget)` emits the full admin row including `adminNotes`, `isOverSettlement`, `overrideReason`, `recordedBy.name`, and the `reversedBy` linkage
    - `toOwnerRow(row, reversalByTarget)` is a whitelist of exactly `settledAmount`, `settlementReference`, `settledAt`, `reversed` — a field added to the schema later cannot leak
    - _Requirements: 1.2, 1.3, 7.4, 9.2, 9.3, 9.5_

  - [~] 3.4 Write `server/services/settlementService.check.mjs`
    - Ponytail check, plain `node`, assert-based, no framework: the ledger fold, the reversal net-out, the state lattice at each boundary, the guard's accept/reject split
    - Same shape as `server/services/earningsService.check.mjs`
    - _Requirements: 12.2, 12.3, 5.7_

  - [ ]* 3.5 Write property test for ledger conservation
    - **Property 1: Ledger conservation**
    - **Validates: Requirements 1.1, 1.6, 1.7, 4.2, 12.2, 12.3**
    - Pure, no database; generators cover the empty ledger and exact equality

  - [ ]* 3.6 Write property test for the settlement state classification
    - **Property 2: Settlement state is a total classification**
    - **Validates: Requirements 1.1, 5.6, 5.7**

  - [ ]* 3.7 Write property test for reversal as inverse
    - **Property 3: Reversal is the inverse of recording**
    - **Validates: Requirements 7.1, 7.2, 9.5**

  - [ ]* 3.8 Write property test for the over-settlement guard
    - **Property 5: The over-settlement guard is exact**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7**
    - Generators cover the exact-equality boundary and every role/override pairing

  - [ ]* 3.9 Write property test for request validation
    - **Property 7: An invalid request changes nothing**
    - **Validates: Requirements 4.7, 4.8, 4.9, 6.3**
    - Generators cover whitespace-only strings, fractional amounts, and future dates

- [~] 4. Checkpoint
  - Ensure all tests pass and `node server/services/settlementService.check.mjs` exits clean, ask the user if questions arise.

- [ ] 5. `settlementService` DB layer
  - [~] 5.1 Add `getListingSettlement` and `getOwnerSettlement`
    - Both read rows newest-first, call `earningsService.getListingFigures` once, and hand the same `buildLedger` result to both projections so the shared figures agree by construction
    - `getListingSettlement` returns the admin DTO (money, activity, state, payout, `entries` via `toAdminRow`)
    - `getOwnerSettlement({ kind, listingId, requesterId })` rejects a non-owner with a 403 carrying no figures, and returns the owner DTO via `toOwnerRow`
    - A `getListingFigures` failure surfaces as a 502 naming the listing, with no money figures
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.4, 3.1, 9.1, 9.2, 9.3, 9.9, 11.5, 12.1, 12.5_

  - [~] 5.2 Add `recordEntry({ kind, listingId, input, admin })`
    - The design's ordering exactly: resolve listing → idempotency pre-read → `validateEntry` → `getListingFigures` → `buildLedger` → `checkOverSettlement` → `AuditLog.create` (thrown, not swallowed) → `Settlement.create` (`E11000` → re-read and return existing) → notify in try/catch
    - `method` defaults to `manual`; `recipient` resolved at record time, `null` when unresolvable
    - Returns `{ entry, ledger, state, notified, recipientMissing?, alreadyRecorded? }`
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.10, 4.11, 5.2, 5.3, 5.4, 6.1, 6.2, 8.1, 8.3, 8.4, 10.1, 10.3, 10.4, 10.5, 12.4_

  - [~] 5.3 Add `recordReversal({ kind, listingId, entryId, reason, admin })`
    - Same skeleton with its own rejections: target absent or on another listing → 404, already reversed → 409, target is itself a reversal → 400, blank reason → 400
    - Reversal row carries `settledAmount = -target.settledAmount`, the target's reference and date, `isReversalOf`, `reversalReason`, and derived `idempotencyKey = reversal:<targetId>`
    - Audit record before insert; notification carries the reversal and the updated `settledToDate`
    - No update and no delete method is added to the service
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 7.8, 8.2, 8.4, 10.2, 10.3_

  - [ ]* 5.4 Write property test for the stored settlement fact
    - **Property 4: A recorded settlement is an untouched whole-rupee fact**
    - **Validates: Requirements 4.1, 4.4, 4.5, 4.6, 12.4**
    - In-memory Mongo; asserts the read-back row is byte-identical to the submission

  - [ ]* 5.5 Write property test for idempotent recording
    - **Property 6: Recording is idempotent in the Idempotency_Key**
    - **Validates: Requirements 6.1, 6.2**
    - In-memory Mongo — the unique index is part of what is under test

  - [ ]* 5.6 Write property test for invalid reversals
    - **Property 8: An invalid reversal changes nothing**
    - **Validates: Requirements 7.5, 7.6, 7.7, 7.8**

  - [ ]* 5.7 Write property test for append-only storage
    - **Property 9: The ledger is append-only**
    - **Validates: Requirements 7.3**
    - Generated operation sequences; snapshots every prior row and asserts none changed

  - [ ]* 5.8 Write property test for verbatim money figures
    - **Property 10: Money figures are reproduced verbatim from Earnings_Service**
    - **Validates: Requirements 2.1, 2.4, 12.1, 12.5**
    - Stubs `earningsService.getListingFigures` with generated figures, which is what makes "verbatim" checkable

  - [ ]* 5.9 Write property test for admin/owner figure agreement
    - **Property 13: Admin and owner agree on every shared figure**
    - **Validates: Requirements 9.1, 9.2, 9.9**

  - [ ]* 5.10 Write property test for the audit invariant
    - **Property 14: No settlement exists without its audit record**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - Audit sink stubbed and made to fail at random; asserts no entry ever exists without its record

  - [ ]* 5.11 Write property test for notification delivery
    - **Property 15: Every recorded action notifies the owner, and delivery never rolls it back**
    - **Validates: Requirements 10.1, 10.2, 10.4**
    - Notification sink stubbed and made to fail at random

  - [ ]* 5.12 Write property test for the admin ledger projection
    - **Property 11: The admin ledger projection is complete and ordered**
    - **Validates: Requirements 1.2, 1.3, 7.4**
    - Generated ledgers including reversal pairs; asserts one row per stored entry, every named field present, `settledAt` descending

  - [ ]* 5.13 Write unit tests for the two exception branches
    - No resolvable recipient → entry retained, `notified: false`, `recipientMissing: true`
    - Insert fails after the audit write → 500, ledger unchanged, audit record stands
    - _Requirements: 4.11, 10.5_

- [ ] 6. HTTP API
  - [~] 6.1 Append the three admin routes to `server/routes/admin.js`
    - In the existing `EARNINGS & PAYOUTS` section, behind the existing `router.use(adminAuth)`
    - `GET /listings/:kind/:id/settlement`, `POST /listings/:kind/:id/settlement/entries`, `POST /listings/:kind/:id/settlement/entries/:entryId/reversal`, each with `roleGuard(['super_admin', 'admin'])`
    - `entrySchema` / `reversalSchema` via the existing zod `validate` middleware so a malformed body never reaches the service
    - Handlers use the existing `res.status(error.status || 500).json({ error: error.message })` convention; the over-settlement rejection returns `code`, `netPayable`, `settledToDate`, `maxRecordable`
    - _Requirements: 4.7, 4.8, 4.9, 5.2, 5.4, 5.5, 6.3, 7.5, 7.6, 7.7, 7.8, 11.1, 11.2, 11.3, 11.4_

  - [~] 6.2 Add the owner GET routes
    - `server/routes/event.js`: `router.get('/:id/settlement', auth, handler)` beside the existing `/earnings` route
    - `server/routes/venue.js`: `router.get('/:id/settlement', requireAuth(), handler)` beside the existing `/earnings` route
    - Ownership enforced inside the service, exactly as `getEventEarnings` does today; GET only, no write route on either file
    - _Requirements: 9.1, 9.2, 9.6, 11.5_

  - [ ]* 6.3 Write property test for owner-facing data confinement
    - **Property 12: No admin-internal data reaches an owner**
    - **Validates: Requirements 9.3, 10.3**
    - `supertest` over the real routers with sentinel `adminNotes` / override-reason values, asserting on the serialized body at any depth

  - [ ]* 6.4 Write property test for unauthorized settlement requests
    - **Property 16: Unauthorized requests are rejected and write nothing**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.6**
    - Generated role pairings including absent session and `moderator`

  - [ ]* 6.5 Write property test for owner read confinement
    - **Property 17: Owner reads are confined to owned listings**
    - **Validates: Requirements 11.5, 9.1**
    - Generated user/listing ownership pairings

- [~] 7. Checkpoint
  - Ensure all server tests pass, ask the user if questions arise.

- [ ] 8. Admin UI
  - [x] 8.1 Extract `getAdminRoleFromToken` to `admin/src/lib/adminRole.js`
    - Move the function out of `AdminDashboardLayout.jsx` and import it back there — one function, two callers, no copy
    - _Requirements: 11.3_

  - [x] 8.2 Add the three `adminApi` methods
    - `getListingSettlement(kind, listingId)`, `recordSettlement(kind, listingId, body)`, `reverseSettlement(kind, listingId, entryId, reason)` in `admin/src/api/adminApi.js`, following the existing method style
    - _Requirements: 1.1, 4.1, 7.1_

  - [~] 8.3 Create `admin/src/components/ListingSettlementPanel.jsx` with its state reducer and fetch
    - `<ListingSettlementPanel kind="event|venue" listingId={id} />`
    - Four mutually exclusive view states — `loading | ready | empty | error` — driven by a reducer, following the pattern the client earnings page already uses; retry control re-enters `loading`
    - Renders nothing at all for `adminRole === 'moderator'` using `getAdminRole()` from task 8.1
    - _Requirements: 11.3, 13.1, 13.2, 13.3, 13.4_

  - [~] 8.4 Render the figures, activity, and ledger in the panel
    - Money: buyer-side group (Gross collected, Platform fee collected, GST retained) and owner-side group (Owner gross, Platform commission, Net payable, Settled to date, Outstanding) as two labeled groups; `kind === 'venue'` labels gross as "Advance collected"; null renders as ₹0
    - State badge reusing the existing `EventDetail.jsx` badge classes; `over_settled` adds an "Excess settled" figure and pins Outstanding at ₹0; "Payout not initiated — nothing to settle yet" when `netPayable` is 0
    - Activity: the six counts plus the absolute last-payment date via the existing `formatDateTime`, or "No payments yet"
    - Payout status and recorded `netAmount` alongside the ledger; ledger table newest-first, reversed rows struck through with reason, reverser, and timestamp; empty-ledger indication
    - Every amount through `formatInr` from `admin/src/lib/formatInr.js`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.2, 2.3, 2.5, 2.6, 3.2, 3.3, 3.4, 5.6, 7.4, 12.6_

  - [~] 8.5 Add the record form and the reversal control
    - Fields: amount, reference, date, method, notes; `idempotencyKey` generated once per form session via `crypto.randomUUID()`; submit disabled while in flight
    - On success the figures, state, and ledger update without a page reload; on an `alreadyRecorded` response show "Already recorded"; on `notified: false` / `recipientMissing` show that no owner could be notified
    - On rejection show the returned message, keep every entered value, leave the displayed ledger untouched; the super-admin override flag and reason are only offered on an over-settlement rejection
    - Reversal control per row prompts for a mandatory reason
    - _Requirements: 4.3, 5.3, 6.4, 6.5, 7.1, 7.4, 10.5, 13.5_

  - [~] 8.6 Mount the panel on both admin detail pages
    - `admin/src/pages/EventDetail.jsx` → `<ListingSettlementPanel kind="event" listingId={id} />`
    - `admin/src/pages/VenueDetail.jsx` → `<ListingSettlementPanel kind="venue" listingId={id} />`
    - No new page or route is added
    - _Requirements: 1.1, 2.1, 3.1_

  - [~] 8.7 Surface the two new actions on the audit trail
    - `admin/src/pages/AuditTrail.jsx`: add `settle` and `reverse` to `ACTION_OPTIONS` and `getActionColor`, and render the amount and listing in the "What changed" cell for those rows
    - _Requirements: 8.5_

  - [ ]* 8.8 Write property test for the surface state machine
    - **Property 19: Exactly one surface state is shown**
    - **Validates: Requirements 13.1, 13.2, 13.3**
    - Drives the panel reducer directly over generated outcome sequences — no renderer

  - [ ]* 8.9 Write property test for rejected submissions
    - **Property 20: A rejected submission preserves the form and the ledger**
    - **Validates: Requirements 13.5, 4.11**
    - Generated form values and rejection payloads through the reducer

  - [ ]* 8.10 Write example tests for the admin panel rendering
    - Two-group money layout, state badge including `over_settled`, venue "Advance collected" label, `formatInr` output equality with the Payouts page, "No payments yet", empty ledger, moderator sees no controls
    - _Requirements: 2.3, 2.5, 3.4, 5.6, 11.3, 12.6_

- [ ] 9. Client UI (owner mirror)
  - [~] 9.1 Add `settlementApi` to `client/src/lib/api.ts`
    - `getEventSettlement(eventId)` and `getVenueSettlement(venueId)` plus the `OwnerSettlementDTO` type mirroring the owner response whitelist
    - _Requirements: 9.1, 9.2_

  - [~] 9.2 Create `client/src/components/dashboard/SettlementSummary.tsx`
    - Read-only: no form and no control that creates, edits, reverses, or disputes an entry
    - Same four mutually exclusive view states with a retry control; three headline figures (Net payable, Settled to date, Outstanding) plus state, the six activity counts, and the settlement history
    - Reversed rows marked and excluded from the total; "no settlement has been made yet" and "no payout is yet due" boundary indications; every amount through `client/src/lib/formatInr.ts`
    - _Requirements: 9.4, 9.5, 9.6, 9.7, 9.8, 12.6, 13.1, 13.2, 13.3, 13.4_

  - [~] 9.3 Mount `SettlementSummary` on the two existing owner surfaces
    - `client/src/app/dashboard/creator/earnings/page.tsx` (already scoped to one event via `?event=`) → `kind="event"`
    - `client/src/app/dashboard/venues/[id]/page.tsx` → `kind="venue"`
    - No new page or route is added
    - _Requirements: 9.1, 9.4_

  - [ ]* 9.4 Write example tests for the owner view
    - Three labeled headline figures, reversed-row indication excluded from the total, both empty-state indications, no write control present anywhere in the tree
    - _Requirements: 9.5, 9.6, 9.7, 9.8_

- [~] 10. Final checkpoint
  - Ensure all tests pass and every `.check.mjs` exits clean, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; core implementation tasks are never optional.
- All 20 correctness properties from the design are covered: 1, 2, 3, 5, 7 (3.5–3.9), 4, 6, 8, 9, 10, 11, 13, 14, 15 (5.4–5.12), 12, 16, 17 (6.3–6.5), 18 (2.2), and 19, 20 (8.8–8.9).
- Property tests run ≥100 iterations and are tagged `Feature: per-listing-settlement-tracking, Property N: <text>`.
- Task 3.4 is the ponytail check — the one runnable thing that fails if the ledger arithmetic breaks, with no framework.
- The design's `formatInr` conflict (Requirement 12.6 asks for no fractional portion, the existing helpers pin 2 digits) is resolved as the design states: reuse the helpers unchanged, so settlement amounts render as `₹5,000.00`.
- No new dependency is introduced anywhere in this plan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "8.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.1", "8.2"] },
    { "id": 2, "tasks": ["3.2", "3.5", "3.6", "3.7"] },
    { "id": 3, "tasks": ["3.3", "3.4", "3.8", "3.9"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "8.3"] },
    { "id": 6, "tasks": ["5.3", "5.8", "5.9", "8.4"] },
    { "id": 7, "tasks": ["5.4", "5.5", "5.6", "5.7", "5.10", "5.11", "5.12", "5.13", "8.5", "8.7"] },
    { "id": 8, "tasks": ["6.1", "6.2", "8.6", "8.8", "8.9", "9.1"] },
    { "id": 9, "tasks": ["6.3", "6.4", "6.5", "8.10", "9.2"] },
    { "id": 10, "tasks": ["9.3"] },
    { "id": 11, "tasks": ["9.4"] }
  ]
}
```
