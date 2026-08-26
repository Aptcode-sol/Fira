# Implementation Plan

## Overview

Bottom-up and surgical (ponytail): data model first, then service-layer money fixes routed through the existing `calculateBilling` → `initiatePayment` flow, then routes, then admin/client UI, with checkpoints. Exploration and preservation tests are written and run against the UNFIXED code first, to confirm the root causes before any fix is applied.

Test infra (confirmed present): `vitest` + `fast-check@^4.1.1` in `server/`, run via `npm run test:unit` (config `vitest.unit.config.ts`). Property tests live in `server/__tests__/`. Property-based test tasks are marked `*` (optional). The payment gateway is mocked so the amount charged to Razorpay can be asserted against the recorded `Payment`.

## Tasks

---

## Phase A — Surface the bugs (write BEFORE any fix)

- [x] 1. Write bug condition exploration test (money invariant: charged == recorded)
  - **Property 1: Bug Condition** - Money paths charge what they record
  - **CRITICAL**: This test MUST FAIL on the current (unfixed) code — failure confirms the bugs exist.
  - **DO NOT attempt to fix the test or the code when it fails.**
  - **NOTE**: This test encodes the expected money invariant; it validates the fix once it passes after implementation.
  - **GOAL**: Surface counterexamples on the three money call sites.
  - **Scoped PBT approach**: for the deterministic call-site bugs, scope the property to concrete failing cases from the design's counterexamples; keep the pure-math sweep broad.
  - Create `server/__tests__/moneyInvariant.exploration.property.test.ts` with the gateway (`initiatePayment`/Razorpay) mocked to capture the charged amount.
  - Case A (Flow 1 — booking advance): initiate a booking advance for `totalAmount = 10000`; assert `charged == Payment.totalAmount` and `Payment.subtotal + Payment.platformFee + Payment.gstAmount == charged`. Expected FAIL: charged 1000, breakdown 0, `booking.platformFee = 50` disconnected. (`server/services/bookingService.js` `initiateBookingPayment`)
  - Case B (Flow 2 — ticket discount): purchase `ticketPrice = 1000`, qty 1, feePct 5, valid ₹200 code; assert `charged == calculateBilling(1000, 1, 5, 200).totalAmount` and `Payment.discountAmount == 200`. Expected FAIL: full charge, no discount recorded. (`server/services/ticketService.js` `purchaseTicket`)
  - Case C (Flow 2 — paid tier free): purchase a `VIP @ 2000` tier; assert a payment was required/charged (`paymentRequired === true`, `paymentData.amount > 0`). Expected FAIL: entitlement issued, ₹0 charged. (`server/services/ticketService.js` `purchaseTicketByTier`)
  - Case D (Flow 3 — payout commission): payout for an event configured at 8%; assert `platformCommissionPercentage == 8`. Expected FAIL: hardcoded 5. (`server/services/paymentService.js` `processPayout`)
  - Run `npm run test:unit` on UNFIXED code.
  - **EXPECTED OUTCOME**: Test FAILS (proves the bugs exist).
  - Document counterexamples found (charged ≠ recorded; discount ignored; paid tier free; commission ≠ config).
  - Mark complete when the test is written, run, and the failures are documented.
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-buggy money and flow paths unchanged
  - **IMPORTANT**: Follow observation-first methodology — observe actual outputs on UNFIXED code, then assert them.
  - Create `server/__tests__/moneyInvariant.preservation.property.test.ts` (gateway mocked).
  - Observe on unfixed code: booking advance rate is `round(totalAmount * 0.10)`; record it and assert `charged == round(booking.totalAmount * 0.10)` for the advance across a range of totals.
  - Observe: no-discount flat purchase (`ticketPrice > 0`, no code) charge value on unfixed code; assert identical charge is produced (property over price/qty/feePct).
  - Observe: free ticket (`ticketPrice = 0`) issues with no payment required; assert unchanged.
  - Observe: atomic inventory reservation still prevents oversell under concurrent `$inc` (assert oversell prevented).
  - Property-based sweep generates many price/qty/fee/discount combinations for stronger guarantees.
  - Run `npm run test:unit` on UNFIXED code.
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve).
  - Mark complete when tests are written, run, and passing on unfixed code.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

---

## Phase B — Data model changes (foundation, no behavior change yet)

- [x] 3. Add money/role fields to the models cited in the design
  - [x] 3.1 Add `Payment` fields for discount bearer attribution
    - `server/models/Payment.js`: add `discountBearer: { type: String, enum: ['platform', 'owner'], default: null }` and `listedPrice: { type: Number, default: 0 }`.
    - No writes yet — schema only; existing docs default cleanly.
    - _Bug_Condition: charged/recorded/settlement inconsistent with bearer rule (Flow 4)_
    - _Requirements: 4.1, 4.2_
    - _Correctness Property: 5_
  - [x] 3.2 Add `Payout.method` marker
    - `server/models/Payout.js`: add `method: { type: String, enum: ['manual', 'gateway'], default: 'manual' }`. Reuse existing `status`/`gatewayPayoutId` for the not-yet-disbursed state.
    - _Bug_Condition: payout record implies a transfer that did not occur (Flow 3.3)_
    - _Requirements: 3.3_
    - _Correctness Property: 4_
  - [x] 3.3 Add `User.roles` array
    - `server/models/User.js`: add `roles: { type: [String], enum: ['user', 'venue_owner', 'admin'], default: ['user'] }`. Keep existing `role` for backward compatibility.
    - _Bug_Condition: single `role` enum forces duplicate accounts (Flow 7)_
    - _Requirements: 7.1_

- [x] 4. Checkpoint — models load, existing tests still pass
  - Run `npm run test:unit`; confirm Phase A exploration still fails as documented and preservation still passes (no behavior changed yet).

---

## Phase C — Service-layer money fixes (route existing truth through `calculateBilling`)

- [x] 5. Fix booking advance billing (Flow 1)
  - [x] 5.1 Route the 10% advance through `calculateBilling` → `initiatePayment`
    - `server/services/bookingService.js` `initiateBookingPayment`: compute `advanceAmount = Math.round(booking.totalAmount * 0.10)`; `feePct = venue.platformFeePercentage ?? 5`; `billing = paymentService.calculateBilling(advanceAmount, 1, feePct)`.
    - Pass full breakdown into `initiatePayment` (`amount/subtotal/platformFee/platformFeePercentage/gstAmount/totalAmount` from `billing`). Set `booking.platformFee = billing.platformFee`.
    - Delete the disconnected `Math.round(advanceAmount * 0.05)` line. `completeBookingPayment` untouched.
    - Fail closed: if `calculateBilling` throws, abort before any Razorpay order.
    - _Bug_Condition: isBugCondition(booking) → advanceCharged != paymentRecord(booking).totalAmount_
    - _Expected_Behavior: charged == Payment.totalAmount == subtotal + platformFee + gstAmount for the 10% advance_
    - _Preservation: advance stays 10%; success still sets paid/accepted/linked (3.1, 3.2)_
    - _Requirements: 1.1, 1.2, 1.3_
    - _Correctness Property: 1_

- [x] 6. Fix ticket discount + paid tiers (Flow 2)
  - [x] 6.1 Extract shared billing helper and pass discount through flat purchase
    - `server/services/ticketService.js`: add a private helper `requirePaymentFor(priceUnit, quantity, feePct, discountAmount, ...)` that runs `calculateBilling` + `initiatePayment` and returns payment data — one branch, not two copies. (ponytail: helper stays in this file; no cross-service abstraction until a third caller appears.)
    - `purchaseTicket`: accept `discountCode`; re-validate server-side via `discountService.validateAndApplyDiscount(code, eventId, event.ticketPrice * quantity)` (never trust a client `discountAmount`); feed resulting `discountAmount`/`appliedCode` through the helper. Record `discountCode`/`discountAmount` on the Payment.
    - Fail closed: invalid/expired/exhausted code → reject purchase, do not charge.
    - _Bug_Condition: purchase.appliedDiscountAmount > 0 AND chargedTotal == calculateBilling(price, qty, feePct, 0).totalAmount_
    - _Expected_Behavior: charged == calculateBilling(price, qty, feePct, discountAmount).totalAmount; Payment records discountCode + discountAmount_
    - _Preservation: no-discount flat purchase and free ticket unchanged (3.3, 3.4, 3.7)_
    - _Requirements: 2.1, 2.2_
    - _Correctness Property: 2_
  - [x] 6.2 Charge paid tiers via the same helper
    - `purchaseTicketByTier`: when `tier.price > 0` and no `paymentId`, call `requirePaymentFor(tier.price, quantity, feePct, discountAmount, ...)` and return `{ paymentRequired: true, paymentData }` BEFORE committing the `soldCount` increment, mirroring the flat path. Apply the same discount handling as 6.1.
    - Free tiers (`tier.price === 0`) keep the reserve-and-return behavior. Preserve the atomic `soldCount`/`currentAttendees` `$inc` reservation verbatim; release on failure.
    - _Bug_Condition: tier.price > 0 AND chargedTotal == 0_
    - _Expected_Behavior: paid tier requires + charges payment before entitlement; both paths agree by sharing one money branch_
    - _Preservation: free tier reserves as before; atomic reservation preserved (3.5)_
    - _Requirements: 2.3, 2.4_
    - _Correctness Property: 3_

- [x] 7. Fix settlement/payout commission, bank source, and manual state (Flow 3)
  - [x] 7.1 Derive commission from config and source bank details from the owner
    - `server/services/paymentService.js` `processPayout`: accept `platformFeePercentage` from the caller (sourced from event/venue); use it instead of literal `5`. Fallback to the recipient's Payment `platformFeePercentage`, then 5, only if genuinely absent.
    - Source bank details via `User.findById(recipientId).select('bankDetails')`; attach to the payout instead of trusting a passed-in object.
    - Set `method: 'manual'`, keep `gatewayPayoutId = null`, create status `pending` (recorded, not yet disbursed). Still record `grossAmount`, `platformCommission`, `netAmount = grossAmount - platformCommission`.
    - Fail closed: if the owner has no valid stored bank details (fails IFSC/account validation), throw rather than create a payout with empty details.
    - _Bug_Condition: hardcoded 5% commission; bankDetails from caller; status implies transfer that didn't happen_
    - _Expected_Behavior: commission from config; bank from User.bankDetails; explicit manual not-yet-disbursed state_
    - _Preservation: payout still records gross/commission/net; valid saved bank honored (3.6, 3.8)_
    - _Requirements: 3.1, 3.2, 3.3_
    - _Correctness Property: 4_
  - [x] 7.2 Attribute discount bearer at purchase time (Flow 4)
    - At purchase (`ticketService`, where `createdBy` + applied discount are known): look up the applied `DiscountCode.createdBy` user's `adminRole`. Set `Payment.discountBearer = 'platform'` when `adminRole` is set, else `'owner'`. Set `Payment.listedPrice` to the full owner-set price. `null` bearer when no discount.
    - `processPayout`: compute owner `grossAmount` from `listedPrice`; when `discountBearer === 'owner'` subtract the discount from owner gross; when `'platform'` leave owner gross at full listed price. Platform-side records always reflect the full listed price.
    - _Bug_Condition: no code records who absorbs the discount_
    - _Expected_Behavior: admin code → platform absorbs, owner keeps full listed price; owner code → owner settlement reduced, platform records full listed price_
    - _Preservation: no discount → bearer unset, full listed price everywhere (3.7)_
    - _Requirements: 4.1, 4.2_
    - _Correctness Property: 5_

- [x] 8. Server-side bank-detail validation (Flow 5, trust boundary)
  - Add a server validator (in the create/settings route or a small shared validator): IFSC `^[A-Z]{4}0[A-Z0-9]{6}$` (11 chars), account number numeric. Reject malformed details before persisting to `User.bankDetails`. (Encryption owned by `industry-standard-upgrade` — not implemented here.)
  - _Bug_Condition: malformed bank details saved and later break payouts_
  - _Expected_Behavior: validate before save; reject malformed input at the API boundary_
  - _Preservation: valid pre-saved details honored unchanged (3.8)_
  - _Requirements: 5.3_

- [x] 9. Server-side event visibility gates (Flow 6)
  - `server/services/eventService.js`: extend the public listing query to exclude `status === 'completed'` and events whose `endDateTime < now` (today's query only gates on `startDateTime >= now`). Require `adminApproval.status === 'approved'` before a private-link event resolves for a non-owner viewer.
  - Add the same completed/past guard to the tier purchase path (flat `purchaseTicket` already blocks `completed`/`cancelled`/past `startDateTime`).
  - _Bug_Condition: private links bypass approval; completed/past-end events still listed/purchasable_
  - _Expected_Behavior: server-side gates reject unapproved-private, completed, and past-end events on read and purchase_
  - _Preservation: approved, not-completed, before-end public events still list and allow purchase (3.9)_
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 10. Checkpoint — run the property tests against fixed services
  - Run `npm run test:unit`. Exploration (task 1) should now PASS; preservation (task 2) should still PASS. Fix any regressions before proceeding to UI.

---

## Phase D — Routes wiring

- [x] 11. Wire config + payload through routes to the fixed services
  - Booking route: ensure `venue.platformFeePercentage` reaches `initiateBookingPayment`.
  - Ticket route: accept and forward `discountCode` to `purchaseTicket`/`purchaseTicketByTier`; forward `event.platformFeePercentage`.
  - Payout route: source and pass `platformFeePercentage` from the event/venue into `processPayout`.
  - Create/settings route: run the bank-detail validator (task 8) before persisting to `User.bankDetails`; grant venue-creation only when `roles` includes `venue_owner`.
  - _Bug_Condition: call sites do not feed the fixed functions the config/payload they need_
  - _Expected_Behavior: routes pass discount, fee percentage, and validated bank details through to services_
  - _Requirements: 1.1, 2.1, 2.3, 3.1, 5.3, 7.3_
  - _Correctness Property: 1, 2, 3, 4_

---

## Phase E — Admin & client UI

- [x] 12. Admin panel coordination (Flow 8, `admin/src/pages/*` + `server/services/eventService.js`)
  - [x] 12.1 Pending count + completed filter (server queries)
    - `getPendingEvents`: add `venue: { $exists: true, $ne: null }` so venue-less events aren't counted pending. Fix the completed-tab filter mapping so `status: 'completed'` reaches the query.
    - _Requirements: 8.1, 8.5_
    - _Preservation: genuinely pending events with a venue still count; other filters unchanged (3.11, 3.12)_
  - [x] 12.2 In-place updates, user type column, audit trail
    - Replace `window.location.reload()` after admin actions with a client state refetch of the affected list.
    - Render each user's `roles`/`role` (and `adminRole` where relevant) in the badge column instead of `-`.
    - `AuditTrail.jsx`: read real `AuditLog` rows via the admin API instead of dummy data.
    - _Requirements: 8.2, 8.3, 8.4_
  - [x] 12.3 Venue-owners list with bank visibility + admin-vs-owner discounts
    - Add an admin view listing venue owners with their venues (dropdown/expansion); surface `User.bankDetails` on owner expansion and on individual event/venue detail (admin-only read).
    - `DiscountCodes.jsx`: distinguish admin-owned codes (apply to every event) from event-owner codes by `createdBy.adminRole`, using the existing `createdBy` population.
    - _Requirements: 8.6, 8.7_
  - [x] 12.4 Format venue capacity object in the CAPACITY column (never "[object Object]")
    - `admin/src/pages/Venues.jsx`: the capacity cell renders `(venue.capacity || 0).toLocaleString()`; when `capacity` is an object (e.g. `{min, max}` / `{seated, standing}`) React prints `"[object Object]"`. Add a small `formatCapacity(capacity)` helper: a `min–max` range string when both bounds exist, otherwise the single number; a plain number/string renders as-is.
    - Use the helper in the capacity cell. Display-only fix — no server, model, or money change. (ponytail: one in-file helper, reused, no new dependency.)
    - _Bug_Condition: capacity is an object rendered directly → "[object Object]"_
    - _Expected_Behavior: human-readable min–max range or single number (design Flow 8.8)_
    - _Preservation: capacity already a plain displayable value still renders correctly (3.13)_
    - _Requirements: 8.8_
    - _Correctness Property: 7_
  - [x] 12.5 Add a pending-venues count badge on the admin venues page
    - `admin/src/pages/Venues.jsx`: add a pending-count badge mirroring the events-page pending-count pattern (same shape as the Events.jsx pending badge). Reuse/keep the existing `pendingCount` derivation so the badge reflects venues awaiting approval.
    - Distinct from 12.1: 12.1 corrects the pending *count* (excludes venue-less events); 12.5 only adds the *badge* to the venues page.
    - When there are no pending venues, show no badge (or zero), matching the events-page behavior.
    - _Bug_Condition: venues page shows no pending-count badge, unlike the events page_
    - _Expected_Behavior: pending-venues count badge using the events-page pattern (design Flow 8.9)_
    - _Preservation: no pending venues → no badge (or zero), consistent with events page (3.14)_
    - _Requirements: 8.9_
    - _Correctness Property: 7_

- [x] 13. Client combined-role account + dashboard switching (Flow 7, client dashboard + create flows)
  - [x] 13.1 Sidebar role switcher + create-venue gating
    - Show the sidebar dropdown switcher (owner "Fira Venue" ↔ normal user dashboard) only when `roles` includes `venue_owner`. Show "create venue" in the create ("plus") menu only for venue owners.
    - _Requirements: 7.2, 7.3_
    - _Preservation: normal user with no owner role sees the normal dashboard, no switcher, no create-venue (3.10)_
  - [x] 13.2 Bank-detail capture / prefill on create flows
    - First event/venue create: capture bank details and persist to `User.bankDetails`. Subsequent creates: prefill from `User.bankDetails`, allow edit, re-save edits (server validates per task 8).
    - _Requirements: 5.1, 5.2_
    - _Preservation: valid saved details honored without change (3.8)_

---

## Phase F — Single-account migration (⚠️ FLAGGED — data migration)

- [x] 14. ⚠️ One-off duplicate-account merge migration (idempotent, keyed on email)
  - **FLAGGED**: this task mutates existing user data. It is a one-off script, not part of runtime code paths.
  - Add `server/scripts/mergeDuplicateAccounts.js`: find users sharing the same email that exist as separate normal + owner accounts; collapse into a single account whose `roles` array carries both (`['user', 'venue_owner']`); repoint owned venues/events to the surviving account.
  - Idempotent: safe to re-run — already-merged accounts (single account with the correct `roles`) are skipped; keyed on email.
  - **ponytail**: do NOT build a general account-merge framework. Ceiling: single idempotent email-keyed script; conflict handling (differing profile fields) resolved by keeping the owner account as survivor. Upgrade path: phone-based matching only if email collisions prove insufficient.
  - Leave ONE runnable check: a small assert-based self-check that running the script twice on a seeded duplicate pair yields one account with both roles and no data loss.
  - _Bug_Condition: same person represented as separate/duplicate accounts (7.1)_
  - _Expected_Behavior: single sign-in account carrying both roles_
  - _Requirements: 7.1_

---

## Phase G — Property-based tests per money invariant (`*` optional, fast-check)

These are the fix-checking property tests, one per money invariant, in `server/__tests__/`. They re-run the SAME assertions the fix must satisfy across the generated input domain. Run via `npm run test:unit`.

- [ ]* 15.1 **Property 1: Expected Behavior** — charged == recorded (billing invariant)
  - `paymentService.billing.property.test.ts`: `fc.assert(fc.property(fc.nat, fc.integer({min:1,max:20}), fc.integer({min:0,max:30}), fc.nat, (price, qty, feePct, discount) => { const b = calculateBilling(price, qty, feePct, Math.min(discount, price*qty)); return b.totalAmount === b.discountedSubtotal + b.platformFee + b.gstAmount && b.discountedSubtotal === Math.max(0, price*qty - Math.min(discount, price*qty)); }))`.
  - Re-run booking case: charged == `Payment.totalAmount` == subtotal + platformFee + gstAmount. **EXPECTED OUTCOME: PASSES.**
  - _Requirements: 1.1, 1.2, 1.3_ · _Correctness Property: 1_
- [ ]* 15.2 **Property 2: Expected Behavior** — discount applied
  - For `discount > 0`: `calculateBilling(...,discount).totalAmount < calculateBilling(...,0).totalAmount` whenever `discountedSubtotal` drops; ticket path records `discountAmount`. **PASSES.**
  - _Requirements: 2.1, 2.2_ · _Correctness Property: 2_
- [ ]* 15.3 **Property 3: Expected Behavior** — paid tier charges
  - Generate `tier.price > 0` → tier path returns `paymentRequired: true` with `paymentData.amount === calculateBilling(tier.price, qty, feePct, discount).totalAmount`. **PASSES.**
  - _Requirements: 2.3, 2.4_ · _Correctness Property: 3_
- [ ]* 15.4 **Property 5: Expected Behavior** — payout commission from config
  - Generate `feePct ∈ [0,30]` → `platformCommission === round(grossAmount * feePct/100)` and `netAmount === grossAmount − platformCommission` (never hardcoded 5). **PASSES.**
  - _Requirements: 3.1, 3.6_ · _Correctness Property: 4_
- [ ]* 15.5 **Property 4: Expected Behavior** — bearer attribution
  - Generate `createdBy.adminRole ∈ {set, null}` → `discountBearer === 'platform'` iff adminRole set; owner gross = full listed price when platform-borne, listed price − discount when owner-borne. **PASSES.**
  - _Requirements: 4.1, 4.2_ · _Correctness Property: 5_
- [ ]* 15.6 **Property 2: Preservation** — non-buggy paths unchanged
  - Re-run the preservation properties from task 2 against fixed code: 10% advance rate, no-discount flat charge identical, free ticket no-payment, atomic reservation prevents oversell. **PASSES (no regressions).**
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_ · _Correctness Property: 6_
- [ ]* 15.7 **Property 7: Expected Behavior** — admin venues capacity format + pending badge (example/interaction test)
  - These are admin render assertions, NOT a fast-check money property. Cover the `formatCapacity` helper and the pending badge from tasks 12.4/12.5.
  - `formatCapacity`: `{min:100,max:500}` → `"100–500"`; `{min:100}` (or single-bound) → `"100"`; plain `250` → `"250"`; never `"[object Object]"`. Preservation: a plain number/string renders as-is (3.13).
  - Pending badge: venues with `status: 'pending'` → badge shows the count; zero pending → no badge (or zero), matching the events page (3.14).
  - ponytail: keep it minimal — a small assert-based check on `formatCapacity` (pure fn, no framework/fixtures) is the primary check; the badge is a light render/interaction assertion. **PASSES.**
  - _Requirements: 8.8, 8.9, 3.13, 3.14_ · _Correctness Property: 7_

- [x] 16. Verify bug condition exploration test now passes
  - **Property 1: Expected Behavior** - Money paths charge what they record
  - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test.
  - Run `npm run test:unit`. **EXPECTED OUTCOME**: task 1 test PASSES (bugs fixed).
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1_

- [x] 17. Verify preservation tests still pass
  - **Property 2: Preservation** - Non-buggy money and flow paths unchanged
  - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests.
  - Run `npm run test:unit`. **EXPECTED OUTCOME**: task 2 tests PASS (no regressions).
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 18. Checkpoint — Ensure all tests pass
  - Run the full `server` suite (`npm run test:unit`) and admin/client builds. Ensure all tests pass; ask the user if questions arise.

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "name": "Surface bugs (tests before fix)",
      "tasks": ["1", "2"],
      "dependsOn": []
    },
    {
      "wave": 2,
      "name": "Data model foundation",
      "tasks": ["3.1", "3.2", "3.3"],
      "dependsOn": ["1", "2"]
    },
    {
      "wave": 3,
      "name": "Data model checkpoint",
      "tasks": ["4"],
      "dependsOn": ["3.1", "3.2", "3.3"]
    },
    {
      "wave": 4,
      "name": "Service-layer money fixes",
      "tasks": ["5.1", "6.1", "6.2", "7.1", "7.2", "8", "9"],
      "dependsOn": ["4"]
    },
    {
      "wave": 5,
      "name": "Service checkpoint",
      "tasks": ["10"],
      "dependsOn": ["5.1", "6.1", "6.2", "7.1", "7.2", "8", "9"]
    },
    {
      "wave": 6,
      "name": "Routes wiring",
      "tasks": ["11"],
      "dependsOn": ["10"]
    },
    {
      "wave": 7,
      "name": "Admin & client UI",
      "tasks": ["12.1", "12.2", "12.3", "12.4", "12.5", "13.1", "13.2"],
      "dependsOn": ["11"]
    },
    {
      "wave": 8,
      "name": "Single-account migration (flagged)",
      "tasks": ["14"],
      "dependsOn": ["3.3", "13.1"]
    },
    {
      "wave": 9,
      "name": "Property-based tests per invariant (optional)",
      "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5", "15.6", "15.7"],
      "dependsOn": ["10", "12.4", "12.5"]
    },
    {
      "wave": 10,
      "name": "Verify fix + preservation, final checkpoint",
      "tasks": ["16", "17", "18"],
      "dependsOn": ["11", "12.1", "12.2", "12.3", "12.4", "12.5", "13.1", "13.2", "14"]
    }
  ]
}
```

## Notes

- **Single source of money truth**: the money fix is mostly routing existing truth through `paymentService.calculateBilling` (the pure breakdown fn) into `initiatePayment`, which already charges `totalAmount || amount`. The invariant `charged_to_razorpay == Payment.totalAmount == subtotal - discountAmount + platformFee + gstAmount` holds by construction once the breakdown flows unbroken on all three call sites (booking advance, flat ticket, paid tier).
- **Fail closed**: money paths reject rather than charge an unverified amount — discount is re-validated server-side (client `discountAmount` never trusted), billing errors abort before any Razorpay order, and `processPayout` throws if the owner has no valid stored bank details.
- **Shared helper**: `requirePaymentFor(...)` is extracted inside `ticketService.js` (task 6.1) so flat and tier paths share one billing branch and agree by construction. Ceiling: stays in-file; no cross-service abstraction until a third caller appears.
- **Migration (task 14)** is the only data-mutating task and is explicitly flagged: idempotent, email-keyed, no general merge framework (ponytail).
- **Out of scope** (owned elsewhere): bank-detail encryption → `industry-standard-upgrade`; pure UI/layout defects → `ui-ux-responsive-validation`; the underlying tier/discount/notification features → `platform-feature-overhaul`.
- Correctness Property numbers referenced throughout map to design.md: P1 booking charged==recorded, P2 ticket discount, P3 paid tier charges, P4 payout commission from config, P5 bearer attribution, P6 preservation.
