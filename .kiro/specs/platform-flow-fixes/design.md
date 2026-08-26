# Platform Flow Fixes Bugfix Design

## Overview

Firaa's runtime money and flow paths have drifted apart from what buyers are shown and what owners are owed. The QA pass surfaced eight flow clusters where the system charges one number, records another, settles a third, or exposes/permits something it should not. This design fixes them at the **root**, not per-caller.

The organizing idea is lazy and already half-built: `paymentService.calculateBilling(ticketPrice, quantity, platformFeePercentage, discountAmount = 0)` already computes the full breakdown (`subtotal`, `discountedSubtotal`, `platformFee`, `gstAmount`, `totalAmount`) and `initiatePayment` already accepts and persists that breakdown plus `discountCode`/`discountAmount`, charging `chargeAmount = totalAmount || amount` to Razorpay. The bug is that three call sites don't feed it the truth:

- `ticketService.purchaseTicket` calls `calculateBilling` but never passes the applied discount.
- `ticketService.purchaseTicketByTier` charges **nothing** — it reserves inventory and returns.
- `bookingService.initiateBookingPayment` charges a bare `advanceAmount` with no breakdown, then records a disconnected `booking.platformFee = 5% of advance`.

So the fix is mostly *routing existing truth through the existing function* — `calculateBilling` becomes the single source of money math for tickets, tiers, and booking advances. The remaining flows (settlement commission source, discount bearer attribution, bank-detail capture/prefill, event visibility gates, combined-role account + dashboard switch, admin panel coordination) are targeted corrections to the functions and queries that own each behavior.

Settlement model is unchanged and confirmed: Razorpay collects the **full** amount into the platform account; owners are paid **later via manual payout** from their stored bank details. This spec makes the recorded numbers correct and wires the owner's `User.bankDetails` into `processPayout`. It does **not** adopt Razorpay Route/split settlement. Bank-detail encryption is owned by `industry-standard-upgrade` and only referenced here.

## Glossary

- **Bug_Condition (C)**: The set of inputs where a flow charges/records/settles/exposes something inconsistent with the confirmed rules (e.g. charged ≠ recorded, paid tier issued free, admin-created discount deducted from owner).
- **Property (P)**: The desired behavior — charged == recorded, discount applied to the charge and recorded on the Payment, commission sourced from config, bearer attributed correctly, gated visibility enforced server-side.
- **Preservation (¬C)**: Non-buggy inputs whose behavior must not change — no-discount flat purchase, free tickets, 10% advance rate, atomic inventory reservation, already-valid saved bank details, approved/future/public event listing.
- **F / F'**: Original (unfixed) / fixed function.
- **calculateBilling**: `server/services/paymentService.js` — pure money math; the single source of truth for subtotal/discount/fee/GST/total across all paid paths.
- **initiatePayment**: `server/services/paymentService.js` — creates the Razorpay order and the `Payment` record; charges `totalAmount || amount`.
- **processPayout**: `server/services/paymentService.js` — creates the manual `Payout` record (gross, commission, net, bankDetails); gateway disbursement is an unimplemented TODO.
- **Bearer**: Who absorbs a discount. Admin-created code → platform absorbs; event-owner-created code → owner's settlement absorbs. Determined by `DiscountCode.createdBy` and whether that user's `User.adminRole` is set.
- **Listed price**: The price the owner set (`event.ticketPrice` / tier price / booking `totalAmount`), before any discount.
- **Advance**: The 10% of `booking.totalAmount` charged for a venue booking.

## Bug Details

### Bug Condition

The platform manifests the bug whenever a paid flow produces an amount charged to Razorpay that diverges from the amount recorded on the `Payment`, whenever a paid entitlement is issued without a matching charge, whenever a settlement uses a commission or bank source disconnected from the event/venue config and owner, or whenever a visibility/permission gate is enforced only on the client. The two most money-sensitive, code-verified conditions are formalized below (matching `bugfix.md`).

**Formal Specification — Booking advance (Flow 1):**
```
FUNCTION isBugCondition(booking)
  INPUT: booking with totalAmount
  OUTPUT: boolean
  advanceCharged <- chargedAmount(booking)              // what initiatePayment sent to Razorpay
  recordedTotal  <- paymentRecord(booking).totalAmount  // what the Payment stored
  RETURN advanceCharged != recordedTotal
END FUNCTION
```

**Formal Specification — Ticket discount (Flow 2):**
```
FUNCTION isBugCondition(purchase)
  INPUT: purchase with ticketPrice, quantity, appliedDiscountAmount
  OUTPUT: boolean
  RETURN purchase.appliedDiscountAmount > 0
         AND chargedTotal(purchase) = calculateBilling(ticketPrice, quantity, feePct, 0).totalAmount
END FUNCTION
```

**Formal Specification — Paid tier issued free (Flow 2):**
```
FUNCTION isBugCondition(tierPurchase)
  INPUT: tierPurchase with tier.price
  OUTPUT: boolean
  RETURN tier.price > 0 AND chargedTotal(tierPurchase) = 0   // purchaseTicketByTier charges nothing today
END FUNCTION
```

### Examples

- **Booking (1.1/1.2)**: Booking `totalAmount = ₹10,000`. `initiateBookingPayment` charges Razorpay `advanceAmount = ₹1,000`, creates a Payment with no `subtotal`/`platformFee`/`gstAmount`/`totalAmount`, and separately writes `booking.platformFee = ₹50`. Charged ₹1,000, recorded breakdown ₹0 — out of sync. **Expected:** Payment carries the full breakdown for the ₹1,000 advance and `charged == Payment.totalAmount`.
- **Ticket discount (2.1/2.2)**: Event `ticketPrice = ₹1,000`, qty 1, fee 5%, valid code `SAVE200` (₹200 off). Buyer's summary shows ₹859 (₹800 + ₹40 fee + ₹8 GST... rounded per `calculateBilling`), but Razorpay is charged ₹1,058 (full, no discount) and the Payment records no discount. **Expected:** charge the discounted total; record `discountCode`/`discountAmount`.
- **Paid tier free (2.3)**: Event has tier `VIP @ ₹2,000`. `purchaseTicketByTier` increments `soldCount` and returns entitlement — ₹0 charged. **Expected:** require payment for `tier.price > 0` before entitlement, same as flat path.
- **Payout commission (3.1)**: Event configured at 8% platform fee, but `processPayout` computes commission at hardcoded 5% — settlement disagrees with what was charged. **Expected:** derive commission from the event/venue's `platformFeePercentage`.
- **Edge — free ticket (¬C)**: Event `ticketPrice = 0`. No payment required; ticket issued. **Must stay unchanged.**

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- No-discount flat paid purchase still charges `ticketPrice + platformFee + GST` exactly as `calculateBilling` computes today (Req 3.3).
- Free tickets (`ticketPrice = 0`) are still issued with no payment (Req 3.4).
- Inventory is still reserved atomically via the conditional `$inc` update, preventing oversell, releasing seats if issuing fails (Req 3.5).
- Venue booking advance stays **10%** of `booking.totalAmount` (Req 3.1).
- A successful booking advance still sets `paymentStatus = 'paid'`, transitions the booking to `accepted`, and links the Payment (Req 3.2).
- Payout still records `grossAmount`, `platformCommission`, `netAmount = grossAmount − platformCommission` (Req 3.6).
- No discount applied → full listed price + standard fees charged and recorded (Req 3.7).
- Already-valid saved bank details are honored for settlement without change (Req 3.8).
- Approved, not-completed, before-end-date public events still list and allow purchase (Req 3.9).
- A normal user with no owner role still sees the normal dashboard, no switcher, no venue-create option (Req 3.10).
- Genuinely pending events with a venue still count as pending in admin; unchanged admin filters return the same results (Req 3.11, 3.12).

**Scope:**
All inputs that do NOT involve the buggy conditions must be completely unaffected: zero-discount purchases, free events, non-owner users, approved public future events, valid pre-existing bank details, and every admin filter other than the specific ones being corrected.

## Hypothesized Root Cause

1. **Call sites bypass the shared money function (Flows 1, 2)**: `purchaseTicket` omits the `discountAmount` argument that `calculateBilling` already accepts; `purchaseTicketByTier` was written as an inventory-only path and never grew a payment branch; `initiateBookingPayment` predates the billing breakdown and passes only `amount`. Root cause is *missing data flow into an existing correct function*, not wrong math.

2. **Settlement hardcodes and takes bank details from the caller (Flow 3)**: `processPayout` has `const commissionPercentage = 5` and `bankDetails` as a parameter, disconnected from the event/venue config and the owner's stored `User.bankDetails`. The gateway disbursement is a `// TODO`, so a `pending`/`completed` status can imply a transfer that never happened.

3. **No bearer attribution exists (Flow 4)**: The discount reduces the buyer's charge (once Flow 2 is fixed) but nothing records *who absorbs it*. `DiscountCode.createdBy` and `User.adminRole` exist, but no code reads them to decide platform-vs-owner and no field stores the decision on the Payment for later settlement.

4. **Bank-detail capture/prefill not wired at create-time (Flow 5)**: `User.bankDetails` sub-doc exists but the first event/venue create flow doesn't reliably persist it, subsequent creates don't prefill it, and there's no IFSC/account-number validation at the trust boundary.

5. **Visibility gates are partial / client-side (Flow 6)**: `eventService.getAllEvents` public branch already filters `status: 'approved'` + future `startDateTime`, but private-link access, `completed` status, and past **end**-date exclusion are not consistently enforced on the server across every read/purchase path.

6. **Single-role account model (Flow 7)**: `User.role` is a single enum (`user` | `venue_owner` | `admin`), so a person who is both a normal user and a venue owner ends up as duplicate accounts, with no dashboard switcher and no clean gate for venue creation.

7. **Admin panel reads/counts are stale or dummy (Flow 8)**: pending count includes venue-less events, actions trigger `window.location.reload`, the user type column renders `-`, the audit trail shows placeholder data instead of real `AuditLog` rows, the completed filter doesn't return completed events, there's no venue-owners→venues list with bank visibility, and admin-vs-owner discounts aren't distinguished. Two display-only defects also live here: the venues list renders the `capacity` object directly (React prints `"[object Object]"`), and the venues page never renders a pending-count badge even though the events page does.

## Correctness Properties

Property 1: Bug Condition — Booking advance charged equals recorded

_For any_ booking where the bug condition holds (advance charged ≠ Payment.totalAmount), the fixed `initiateBookingPayment` SHALL build the advance billing via `calculateBilling` and pass the full breakdown into `initiatePayment`, so that the amount charged to Razorpay equals `Payment.totalAmount` and equals `subtotal + platformFee + gstAmount` for the 10% advance.

**Validates: Requirements 1.1, 1.2, 1.3**

Property 2: Bug Condition — Ticket discount applied to charge and recorded

_For any_ ticket purchase where a positive discount was applied, the fixed `purchaseTicket` SHALL pass `discountAmount`/`discountCode` into `calculateBilling` and `initiatePayment`, so that the amount charged equals `calculateBilling(price, qty, feePct, discountAmount).totalAmount` and the Payment records the `discountCode` and `discountAmount`.

**Validates: Requirements 2.1, 2.2**

Property 3: Bug Condition — Paid tier requires payment

_For any_ tier purchase where `tier.price > 0`, the fixed `purchaseTicketByTier` SHALL require and charge payment (via the same `calculateBilling` + `initiatePayment` path, with the same discount handling as the flat path) before issuing entitlement, so no paid tier is obtainable for free.

**Validates: Requirements 2.3, 2.4**

Property 4: Bug Condition — Payout commission from config and bank from owner

_For any_ payout, the fixed `processPayout` SHALL derive `platformCommissionPercentage` from the event/venue's configured `platformFeePercentage` (not a hardcoded 5), SHALL source `bankDetails` from the recipient owner's `User.bankDetails`, and SHALL set a status that reflects that funds are not yet disbursed (explicit manual-payout state), while still recording `grossAmount`, `platformCommission`, and `netAmount = grossAmount − platformCommission`.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 5: Bug Condition — Discount bearer attribution

_For any_ purchase with an applied discount, the fixed billing/settlement SHALL attribute the discount to the platform when the code's `createdBy` user has an `adminRole` set (owner settlement keeps the full listed price), and to the owner when `createdBy` is the event owner (owner settlement is reduced by the discount while platform records the full listed price).

**Validates: Requirements 4.1, 4.2**

Property 6: Preservation — Non-buggy money and flow paths unchanged

_For any_ input where the bug condition does NOT hold (no-discount flat purchase, free ticket, 10% advance rate, atomic reservation, valid saved bank details, approved/future/public event, non-owner user, unchanged admin filters), the fixed code SHALL produce the same observable result as the original code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**

Property 7: Bug Condition — Admin venues display (capacity formatting + pending badge)

_For any_ venue whose `capacity` is an object, the fixed venues list SHALL render a human-readable string (a `min–max` range when both bounds exist, otherwise the single number) and never `"[object Object]"`; and _for any_ set of venues, the fixed venues page SHALL show a pending-count badge computed with the same query/pattern as the events page. A capacity that is already a plain displayable value still renders as-is, and with no pending venues no badge (or zero) is shown — both matching current behavior. This is an admin display fix verified by example/interaction tests, not a money property.

**Validates: Requirements 8.8, 8.9, 3.13, 3.14**

## Fix Implementation

### Money Invariants (design contract for all paid paths)

For every paid transaction, after the fix:

```
charged_to_razorpay == Payment.totalAmount
Payment.totalAmount == Payment.subtotal - Payment.discountAmount + Payment.platformFee + Payment.gstAmount
```

(`calculateBilling` already returns `totalAmount = discountedSubtotal + platformFee + gstAmount` where `discountedSubtotal = max(0, subtotal − discountAmount)`, so the invariant is satisfied by construction whenever the breakdown flows unchanged from `calculateBilling` → `initiatePayment` → Razorpay. The fix is to make that flow unbroken on all three call sites.)

Money errors **fail closed**: if billing cannot be computed or the applied discount cannot be re-validated server-side, the purchase/booking is rejected rather than charged an unverified amount.

### Flow 1 — Booking advance (`server/services/bookingService.js` → `initiateBookingPayment`)

**Root cause:** charges bare `amount: advanceAmount`, no breakdown; writes disconnected `booking.platformFee = 5% of advance`.

**Fix (minimal):** Build the advance billing through the shared function and pass the breakdown through. Treat the 10% advance as the `subtotal` fed to `calculateBilling`:
```
const advanceAmount = Math.round(booking.totalAmount * 0.10);   // 10% advance preserved
const feePct = venue.platformFeePercentage ?? 5;                // config, not hardcoded
const billing = paymentService.calculateBilling(advanceAmount, 1, feePct); // advance as subtotal, qty 1
const paymentData = await paymentService.initiatePayment({
  userId, type: 'venue_booking', referenceId: bookingId, referenceModel: 'Booking',
  amount: billing.totalAmount,
  subtotal: billing.subtotal, platformFee: billing.platformFee,
  platformFeePercentage: feePct, gstAmount: billing.gstAmount, totalAmount: billing.totalAmount
});
booking.platformFee = billing.platformFee;   // now equals what was charged
```
Data flow: `booking.totalAmount → advanceAmount → calculateBilling → initiatePayment → Razorpay`. The disconnected `Math.round(advanceAmount * 0.05)` line is deleted. `completeBookingPayment` is untouched (preservation 3.2).

### Flow 2 — Ticket discount + paid tiers (`server/services/ticketService.js`)

**Root cause (2.1/2.2):** `purchaseTicket` never passes the discount into `calculateBilling`/`initiatePayment`.

**Fix:** Accept `discountCode` on the purchase call, re-validate it server-side via `discountService.validateAndApplyDiscount(code, eventId, subtotal)` (never trust a client-supplied amount — trust boundary), then feed the resulting `discountAmount` through:
```
const feePct = event.platformFeePercentage ?? 5;
let discountAmount = 0, appliedCode = null;
if (discountCode) {
  ({ discountAmount } = await discountService.validateAndApplyDiscount(discountCode, eventId, event.ticketPrice * quantity));
  appliedCode = discountCode.toUpperCase();
}
const billing = paymentService.calculateBilling(event.ticketPrice, quantity, feePct, discountAmount);
await paymentService.initiatePayment({ ...billing fields..., discountCode: appliedCode, discountAmount });
```

**Root cause (2.3/2.4):** `purchaseTicketByTier` reserves inventory and returns with no payment.

**Fix:** Reuse the exact same billing branch, keyed off `tier.price` instead of `event.ticketPrice`. When `tier.price > 0` and no `paymentId`, compute `calculateBilling(tier.price, quantity, feePct, discountAmount)`, call `initiatePayment`, and return `{ paymentRequired: true, paymentData }` **before** committing the `soldCount` increment — mirroring how the flat path returns payment data before creating the ticket. Free tiers (`tier.price === 0`) keep the current reserve-and-return behavior (preservation). The atomic `soldCount`/`currentAttendees` `$inc` reservation is preserved verbatim (Req 3.5). Both paths now share one money branch, so they agree by construction (Req 2.4).

> ponytail: the billing branch is identical for flat and tier — extract a tiny private helper `requirePaymentFor(priceUnit, quantity, feePct, discountAmount, ...)` inside `ticketService` so there is one branch, not two copies. Ceiling: helper stays in this file; no cross-service abstraction until a third caller appears.

### Flow 3 — Settlement / payout (`server/services/paymentService.js` → `processPayout`)

**Root cause:** hardcoded 5% commission; `bankDetails` passed by caller; TODO gateway step; status can imply a transfer that didn't happen.

**Fix:**
- Derive commission from config: `processPayout` accepts `platformFeePercentage` (sourced by the caller from the event/venue) and uses it instead of the literal `5`. Fallback to the recipient's Payment `platformFeePercentage` or 5 only if config is genuinely absent.
- Source bank details from the owner: look up `User.findById(recipientId).select('bankDetails')` and attach that to the payout rather than trusting a passed-in object. If the owner has no valid stored bank details, **fail closed** (throw) rather than create a payout with empty/placeholder details.
- Explicit manual state: keep the `Payout.status` at a value that clearly means "recorded, not yet disbursed". The existing enum (`pending`, `processing`, `completed`, `failed`) already models this — a manual payout is created as `pending` and only moved to `completed` when a human confirms disbursement. The design keeps `gatewayPayoutId = null` and adds a short `notes`/`method: 'manual'` marker so no record falsely implies an automated transfer. (Encryption of the stored bank details is owned by `industry-standard-upgrade`.)

### Flow 4 — Discount bearer attribution

**Root cause:** nothing records who absorbs the discount.

**Design:** Attribution is computed at purchase time (where `createdBy` and the applied discount are both known) and stored on the `Payment` so the later manual payout can read it without re-deriving.

- Look up the applied `DiscountCode` and its `createdBy` user's `adminRole`.
- Compute `discountBearer`:
  - `createdBy.adminRole` set → `'platform'` — owner settlement records the **full listed price**; platform revenue absorbs the discount.
  - else (event owner created it) → `'owner'` — owner settlement is **reduced by the discount**; platform still records the full listed price.
- Store `discountBearer` on the `Payment` (new field, below).
- `processPayout` computes owner `grossAmount` from the **listed price** and, when `discountBearer === 'owner'`, subtracts the discount from the owner's gross; when `'platform'`, leaves owner gross at full listed price. Platform-side records always reflect the full listed price the owner set. No discount applied → `discountBearer` unset, full listed price everywhere (preservation 3.7).

### Flow 5 — Bank details capture / persist / prefill

**Root cause:** create flow doesn't persist to `User.bankDetails`; subsequent creates don't prefill; no validation.

**Design (mostly client + one server validator):**
- On first event/venue create, capture bank details and persist to `User.bankDetails` (the sub-doc already exists).
- On subsequent creates, prefill from `User.bankDetails`, allow edit, re-save edits.
- Validate at the trust boundary (server): IFSC = 11-char `^[A-Z]{4}0[A-Z0-9]{6}$`, account number numeric. Reject malformed details before save (they would otherwise break payouts later). Storage encryption referenced to `industry-standard-upgrade`, not specified here. Valid pre-saved details are honored unchanged (preservation 3.8).

### Flow 6 — Event visibility / approval (`server/services/eventService.js`)

**Root cause:** gates partial / client-side.

**Design (server-side, on every public read and purchase):**
- Private events require `adminApproval.status === 'approved'` before link access resolves the event for a non-owner viewer; unapproved private links return not-available.
- Exclude `status === 'completed'` from public listing and reject purchase (the purchase-time guard in `purchaseTicket` already blocks `completed`/`cancelled` and past `startDateTime`; extend the **listing** query to match and add the same guard to the tier path).
- Exclude events whose `endDateTime < now` from public listing (today's query gates on `startDateTime >= now`; add/replace with an `endDateTime`-aware condition so an in-progress-but-ended event isn't listed). Approved, not-completed, before-end public events keep listing (preservation 3.9).

### Flow 7 — Combined role account + dashboard switching

**Root cause:** single `User.role` enum forces duplicate accounts.

**Design (single account carries both roles):**
- Introduce a `roles: [String]` array on `User` (values `user`, `venue_owner`, `admin`) as the source of truth, keeping the existing `role` field populated with the primary role for backward compatibility during migration. A user who is both is one account with `roles: ['user', 'venue_owner']`.
- Client: sidebar dropdown switcher shown only when `roles` includes `venue_owner`, toggling between the owner ("Fira Venue") dashboard and the normal user dashboard.
- Venue-create gating: the create ("plus") menu shows "create venue" and the server grants venue-creation only when `roles` includes `venue_owner`. Non-owners see neither switcher nor create-venue option (preservation 3.10).
- **Migration concern (called out, not over-engineered):** existing duplicate accounts (same person as separate normal + owner users) need a one-off merge migration to collapse into a single account with a `roles` array. Flagged here as a migration task; the merge heuristic (match by email/phone) and conflict handling are decided at implementation time. `ponytail:` do not build a general account-merge framework — a single idempotent script keyed on email is enough.

### Flow 8 — Admin panel coordination (`admin/src/pages/*`, `server/services/eventService.js`)

Targeted corrections, each small:
- **8.1 pending count**: exclude venue-less events from the pending filter (`getPendingEvents` adds `venue: { $exists: true, $ne: null }`). Events with a venue genuinely pending still count (preservation 3.11).
- **8.2 in-place updates**: replace `window.location.reload()` after admin actions with a client state refetch of the affected list (React state update / re-query), no full reload.
- **8.3 user type column**: render the user's `roles`/`role` (and `adminRole` where relevant) in the badge column instead of `-`.
- **8.4 audit trail**: `AuditTrail.jsx` reads real `AuditLog` rows via the admin API instead of dummy data (the model and indexes already exist).
- **8.5 completed filter**: the admin completed tab query returns `status: 'completed'` events (fix the filter mapping so the selected filter reaches the query).
- **8.6 venue-owners list + bank visibility**: add an admin view listing venue owners with their venues (dropdown/expansion) and surface `User.bankDetails` on the owner expansion and on individual event/venue detail (admin-only read).
- **8.7 admin vs owner discounts**: distinguish codes by `createdBy.adminRole` — admin-owned codes (apply to every event) vs event-owner codes — in `DiscountCodes.jsx`, using the `createdBy` population the admin route already provides.
- **8.8 capacity renders "[object Object]"** (`admin/src/pages/Venues.jsx`): the venues list cell renders the venue `capacity` value directly, but `capacity` is an object (e.g. `{min, max}` or `{seated, standing}`), so React stringifies it to `"[object Object]"`. Small render-formatting fix: format the capacity object into a human-readable string in the capacity cell — a `min–max` range when both bounds exist, otherwise the single number. A capacity that is already a plain displayable value (a number/string) still renders as-is (preservation 3.13). No server, model, or money change.
- **8.9 venues pending-count badge** (`admin/src/pages/Venues.jsx`): the admin events page shows a pending count but the venues page shows none. Compute and display a pending-venues count badge on the venues page, reusing the existing pending-count query/pattern the events page already uses (same shape as the events pending badge). This is distinct from 8.1, which corrects the pending *count* by excluding venue-less events; 8.9 only adds the *badge* to the venues page. When there are no pending venues, no badge (or a zero) is shown, matching the events-page behavior (preservation 3.14).

Unchanged admin filters return the same results (preservation 3.12).

## Data Model Changes

Only what the fixes require — no speculative fields.

- **`Payment`** (`server/models/Payment.js`): add
  - `discountBearer: { type: String, enum: ['platform', 'owner'], default: null }` — records who absorbs an applied discount (Flow 4), read by `processPayout`. `null` when no discount.
  - `listedPrice: { type: Number, default: 0 }` — the full listed price the owner set, so platform records preserve it even when the buyer was charged less (Flow 4). (`subtotal` already holds `ticketPrice * quantity`; `listedPrice` makes the platform-side intent explicit and survives if subtotal semantics change.)
- **`Payout`** (`server/models/Payout.js`): add
  - `method: { type: String, enum: ['manual', 'gateway'], default: 'manual' }` — marks that funds are disbursed manually and no gateway transfer is implied (Flow 3.3). Existing `status`/`gatewayPayoutId` are reused for the "not yet disbursed" state.
- **`User`** (`server/models/User.js`): add
  - `roles: { type: [String], enum: ['user', 'venue_owner', 'admin'], default: ['user'] }` — single account carrying multiple roles (Flow 7). Existing `role` retained for backward compatibility through migration.
- **`Event`/`Venue`**: no new fields required for money — `platformFeePercentage` is read where present, defaulting to 5. (If `Venue` lacks `platformFeePercentage`, the payout falls back to the recipient's Payment percentage, keeping charged==settled.)

No changes to `DiscountCode` (uses existing `createdBy`) or `AuditLog` (already complete).

## Error Handling

Money paths **fail closed** — the guiding rule for every paid branch:

- **Discount re-validation**: the server re-runs `validateAndApplyDiscount` from the code + event + server-computed subtotal. A client-supplied `discountAmount` is never trusted. Invalid/expired/exhausted code → reject the purchase, do not charge.
- **Billing consistency**: after `calculateBilling`, the charged amount is taken **only** from `billing.totalAmount`; there is no separate "amount" path that could diverge. If billing throws, the purchase/booking is aborted before any Razorpay order is created.
- **Payout bank source**: if the recipient owner has no valid stored `bankDetails` (fails IFSC/account validation), `processPayout` throws rather than creating a payout with empty details — a payout must be tied to real, valid bank details.
- **Paid tier**: if `tier.price > 0` and payment isn't completed, entitlement is not issued and inventory is not permanently committed (reservation released on failure, mirroring the flat path).
- **Visibility**: server-side gates reject purchase for completed/past/unapproved-private events even if a stale client allowed the action.
- **Bank-detail input**: IFSC/account-number validation rejects malformed input at the API boundary before persistence.

Non-money regressions (notifications, emails) remain best-effort and must never fail a purchase, matching current behavior.

## Testing Strategy

### Validation Approach

Two phases: first surface counterexamples that demonstrate each money bug on the **unfixed** code, confirming the root cause; then verify the fix satisfies the invariants and preserves non-buggy behavior. Property-based tests use **fast-check** (`fast-check@^4.1.1`, already a dev dependency) with **vitest** (`server/__tests__/`, run via `npm run test:unit`), matching the `platform-feature-overhaul` convention.

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples on UNFIXED code to confirm the hypothesized root causes; refute and re-hypothesize if they pass.

**Test Plan:** Drive the three money call sites with representative inputs and assert charged == recorded / paid-tier-charges / commission-from-config. Run against the current code to observe the failures.

**Test Cases:**
1. **Booking advance sync** — initiate a booking advance for `totalAmount = 10000`; assert charged == `Payment.totalAmount`. (Fails today: charged 1000, breakdown 0.)
2. **Ticket discount charge** — purchase with a valid ₹200 code; assert charged == `calculateBilling(price, qty, feePct, 200).totalAmount` and `Payment.discountAmount == 200`. (Fails today: full charge, no discount recorded.)
3. **Paid tier not free** — purchase a `VIP @ ₹2000` tier; assert a payment was required/charged. (Fails today: entitlement issued, ₹0 charged.)
4. **Payout commission from config** — payout for an event configured at 8%; assert `platformCommissionPercentage == 8`. (Fails today: hardcoded 5.)

**Expected Counterexamples:** charged ≠ recorded for bookings; discounted charge ignored for tickets; zero charge for paid tiers; commission ≠ config for payouts.

### Fix Checking

**Goal:** For all inputs where the bug condition holds, the fixed function produces the expected behavior.

```
FOR ALL booking WHERE isBugCondition(booking) DO
  result := initiateBookingPayment'(booking)
  ASSERT result.payment.totalAmount = result.chargedAmount
  ASSERT result.payment.subtotal + result.payment.platformFee + result.payment.gstAmount = result.chargedAmount
END FOR

FOR ALL purchase WHERE isBugCondition(purchase) DO
  billing := calculateBilling(price, qty, feePct, appliedDiscountAmount)
  result  := purchaseTicket'(purchase)
  ASSERT result.chargedAmount = billing.totalAmount
  ASSERT result.payment.discountAmount = appliedDiscountAmount
END FOR
```

### Preservation Checking

**Goal:** For all inputs where the bug condition does NOT hold, the fixed function equals the original.

```
FOR ALL booking WHERE NOT isBugCondition(booking) DO
  ASSERT chargedAmount'(booking) = round(booking.totalAmount * 0.10)   // 10% advance preserved
  ASSERT F(booking).paymentStatus = F'(booking).paymentStatus
END FOR

FOR ALL purchase WHERE NOT isBugCondition(purchase) DO
  ASSERT F(purchase).chargedAmount = F'(purchase).chargedAmount        // no-discount path unchanged
END FOR
```

**Testing Approach:** Property-based testing fits the money invariants because it sweeps the whole price/quantity/fee/discount domain and shrinks to the smallest failing example. `calculateBilling` is pure, so its invariant is tested directly; the call-site fixes are tested with the payment gateway mocked so the *charged* argument passed to Razorpay can be asserted against the recorded `Payment`.

**Test Cases:**
1. **Advance charged==recorded** — observe the 10% rate on unfixed code, then assert `charged == Payment.totalAmount` post-fix.
2. **No-discount flat purchase** — assert identical charge before/after fix.
3. **Free ticket** — assert no payment required before/after fix.
4. **Atomic reservation** — assert oversell is still prevented under concurrent increments.

### Property-Based Tests (fast-check)

Property tests, one per money invariant, in `server/__tests__/` (e.g. `paymentService.billing.property.test.ts`):

- **P1 charged==recorded (billing invariant)**: `fc.assert(fc.property(fc.nat, fc.integer({min:1,max:20}), fc.integer({min:0,max:30}), fc.nat, (price, qty, feePct, discount) => { const b = calculateBilling(price, qty, feePct, Math.min(discount, price*qty)); return b.totalAmount === b.discountedSubtotal + b.platformFee + b.gstAmount && b.discountedSubtotal === Math.max(0, price*qty - Math.min(discount, price*qty)); }))`.
- **P2 discount applied**: for `discount > 0`, `calculateBilling(...,discount).totalAmount < calculateBilling(...,0).totalAmount` (strictly less whenever `discountedSubtotal` drops), and the ticket path records `discountAmount`.
- **P3 paid tier charges**: generate `tier.price > 0` → the tier path returns `paymentRequired: true` with `paymentData.amount === calculateBilling(tier.price, qty, feePct, discount).totalAmount`.
- **P4 bearer attribution**: generate `createdBy.adminRole ∈ {set, null}` → `discountBearer === 'platform'` iff adminRole set; owner gross = full listed price when platform-borne, listed price − discount when owner-borne.
- **P5 payout commission from config**: generate `feePct ∈ [0,30]` → `platformCommission === round(grossAmount * feePct/100)` and `netAmount === grossAmount − platformCommission` (never hardcoded 5).

### Unit Tests

- `initiateBookingPayment`: 10% advance, breakdown present, `booking.platformFee == billing.platformFee`.
- `purchaseTicket`: discount passed through; no-discount unchanged; free ticket path.
- `purchaseTicketByTier`: paid tier requires payment; free tier reserves as before; discount parity with flat path.
- `processPayout`: commission from config; bank sourced from `User.bankDetails`; fail-closed on missing/invalid bank; `method: 'manual'`, status reflects not-yet-disbursed.
- Bank-detail validator: IFSC format + numeric account number accept/reject cases.
- Event visibility guards: reject purchase for completed/past-end/unapproved-private.
- Admin venues capacity formatter (8.8): example tests — `{min, max}` → `"min–max"`, `{seated, standing}` → readable string, single-bound object → the number, and an already-plain number/string renders unchanged (never `"[object Object]"`). Interaction/render assertion, not a money property.
- Admin venues pending badge (8.9): example tests — with pending venues the badge shows the count; with none it shows no badge (or zero), matching the events page. Interaction/render assertion, not a money property.

### Integration Tests

- Full ticket purchase with discount → Razorpay order amount == summary == `Payment.totalAmount`, discount recorded.
- Full booking advance → charged == recorded → `completeBookingPayment` marks paid/accepted/linked.
- Paid tier purchase end to end requires and records payment.
- Admin flow: pending count excludes venue-less events; completed filter returns completed; audit trail shows real `AuditLog` rows; in-place update (no reload).
- Admin venues page: capacity column shows a formatted range/number (no `"[object Object]"`) and a pending-count badge appears consistent with the events page.
- Combined-role account: owner sees switcher + create-venue; normal user sees neither.
