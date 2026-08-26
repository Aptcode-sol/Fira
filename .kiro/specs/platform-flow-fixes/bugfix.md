# Bugfix Requirements Document

## Introduction

Firaa (Next.js client, React + Vite admin, Express + MongoDB server) went through a full end-to-end QA pass. This spec fixes the defects found in the **core runtime flows and money handling**, so the platform behaves correctly, exception-free, and production-grade end to end. It also covers the role/dashboard restructure that these flows depend on.

**Scope: FLOW + MONEY CORRECTNESS (plus the role/dashboard restructure).** The bugs here are about what the system *does* at runtime — what gets charged to Razorpay, what gets recorded, who gets settled, what is visible, and who can do what — not about how anything looks.

**Explicitly out of scope (belongs to `.kiro/specs/ui-ux-responsive-validation`):** pure UI/layout defects — padding, spacing, input focus-loss while typing, page zoom-on-submit, dropdown styling, and horizontal overflow. Any purely visual nit is handled there, not here.

**Settlement model (confirmed).** Razorpay collects the **full** amount into the platform (admin) account. Event/venue owners are settled **later via manual payout** using their captured bank details. This spec does **not** move to Razorpay Route / split settlements. The fix is to make the recorded numbers correct and to wire the owner's stored bank details into the payout/settlement records.

**Discount bearer rule (confirmed).** An **admin-created** discount code is absorbed by the **platform** (platform revenue takes the hit; the listed price the owner set is preserved in full). An **event-owner-created** discount is deducted from the **owner's settlement**, while the platform still records the full listed price the owner set.

**Venue advance rule (confirmed).** The venue booking advance stays at **10%**. The amount charged to Razorpay MUST equal the amount recorded in the Payment record for that booking.

**Related specs (referenced, not duplicated here):**
- `platform-feature-overhaul` — custom ticket tiers, scanning links, discount CRUD, the creator bank-details field, notifications. This spec assumes those features exist and fixes how they behave in the runtime money/flow paths.
- `industry-standard-upgrade` — security, **encryption of bank details**, testing, resilience. Bank-detail encryption is owned there; this spec references it and does not re-specify encryption.
- `ui-ux-responsive-validation` — all pure layout/overflow defects.

## Bug Analysis

Bugs are grouped by flow:
1. Venue booking flow (money in sync)
2. Event ticketing flow (discount charge + tiered payment)
3. Settlement / payout flow
4. Discount coordination (bearer rule)
5. Bank details capture / persist / prefill
6. Event visibility / approval
7. Combined role account + dashboard switching
8. Admin panel coordination

Verified code facts are cited inline against each bug condition.

---

### Current Behavior (Defect)

#### Flow 1 — Venue booking flow

> Verified: `server/services/bookingService.js` `initiateBookingPayment` charges `amount: advanceAmount` (10%) to `paymentService.initiatePayment` with **no** `subtotal`/`platformFee`/`gstAmount`/`totalAmount`, then separately sets `booking.platformFee = Math.round(advanceAmount * 0.05)` and saves it on the booking.

1.1 WHEN a user pays the advance for an accepted booking THEN the system charges Razorpay only the 10% advance while separately recording a `platformFee` on the booking, so the amount charged does not match the amount recorded (billing out of sync).

1.2 WHEN the booking advance payment is initiated THEN the system creates the Payment record without `subtotal`, `platformFee`, `platformFeePercentage`, or `gstAmount`, so the Payment carries no billing breakdown for the booking.

1.3 WHEN the platform fee for a booking is computed THEN the system derives it as 5% of the advance only and stores it on the booking, disconnected from what was actually charged.

#### Flow 2 — Event ticketing flow

> Verified: `server/services/ticketService.js` `purchaseTicket` calls `paymentService.calculateBilling(event.ticketPrice, quantity, platformFeePercentage)` and never passes a `discountAmount`/`discountCode`, even though `calculateBilling(ticketPrice, quantity, platformFeePercentage, discountAmount = 0)` supports it.

2.1 WHEN a buyer applies a valid discount code to a ticket purchase THEN the system charges Razorpay the full undiscounted total because the discount is never passed into billing, so the buyer is charged the original amount instead of the discounted amount.

2.2 WHEN a discount code is applied to a ticket purchase THEN the system does not record the discount code or discount amount on the Payment, so the reduction is invisible in records.

> Verified: `server/services/ticketService.js` `purchaseTicketByTier` reserves inventory via an atomic `soldCount`/`currentAttendees` increment and returns, with **no** call to `calculateBilling` or `initiatePayment` — unlike the flat `purchaseTicket` path which requires payment when `ticketPrice > 0`.

2.3 WHEN a buyer purchases a paid tier via the tier-based path THEN the system reserves the tier inventory and issues entitlement without charging any money, so paid tiered tickets can be obtained for free.

2.4 WHEN the tier-based purchase path is used THEN the system applies no discount handling at all, so it disagrees with the flat purchase path that does handle payment and (once 2.1 is fixed) discounts.

#### Flow 3 — Settlement / payout flow

> Verified: `server/services/paymentService.js` `processPayout` hardcodes `const commissionPercentage = 5`, carries a `// TODO: Integrate with payment gateway payout API`, and accepts `bankDetails` as a passed-in parameter rather than sourcing it from the event/venue owner's stored bank details.

3.1 WHEN a payout is processed THEN the system uses a hardcoded 5% commission regardless of the event's/venue's configured platform fee, so the settlement figure can disagree with what was actually charged.

3.2 WHEN a payout record is created THEN the system relies on `bankDetails` being passed in by the caller instead of sourcing the owner's saved bank details, so settlements are not reliably tied to the owner's stored bank details.

3.3 WHEN a payout is created THEN the system records it without actually disbursing funds (the gateway payout step is an unimplemented TODO), so a payout record does not reflect a real transfer.

#### Flow 4 — Discount coordination (bearer rule)

4.1 WHEN an admin-created discount code is applied to a purchase THEN the system does not attribute the discount cost to the platform, so it is unclear who bears an admin discount.

4.2 WHEN an event-owner-created discount code is applied to a purchase THEN the system does not deduct the discount from the owner's settlement nor preserve the full listed price in platform records, so an owner discount is not correctly borne by the owner.

#### Flow 5 — Bank details capture / persist / prefill

5.1 WHEN an owner creates their first event or venue THEN the system does not reliably capture their bank details for settlement at that point.

5.2 WHEN an owner has previously saved bank details and creates a subsequent event or venue THEN the system does not prefill the saved bank details, forcing re-entry.

5.3 WHEN bank details are entered THEN the system does not validate them (IFSC format, numeric account number), so malformed details can be saved and later break payouts.

#### Flow 6 — Event visibility / approval

6.1 WHEN a private event is shared via its link THEN the system makes it accessible without admin approval, so private events bypass the approval gate.

6.2 WHEN an event has status `completed` THEN the system still shows it as available and bookable/purchasable to users.

6.3 WHEN the current time is past an event's end date/time THEN the system still lists the event as visible to users.

#### Flow 7 — Combined role account + dashboard switching

7.1 WHEN a person is both a venue owner and a normal user THEN the system represents them as separate/duplicate accounts instead of one sign-in, so they cannot move between roles under a single identity.

7.2 WHEN a signed-in user views the dashboard THEN the system provides no switcher to move between the owner ("Fira Venue") dashboard and the normal user dashboard.

7.3 WHEN a normal (non-owner) user opens the create ("plus") menu THEN the system does not correctly gate the "create venue" option and venue-creation permission to venue owners only.

#### Flow 8 — Admin panel coordination

8.1 WHEN an event has no associated venue THEN the admin panel still counts it as pending, inflating the pending count.

8.2 WHEN an admin performs an action in the panel THEN the system triggers a full page reload after the action instead of updating in place.

8.3 WHEN the admin user list is displayed THEN the badge/type column shows "-" instead of the user's actual type/role.

8.4 WHEN the admin audit trail is viewed THEN the system shows dummy/placeholder entries rather than real admin actions.

8.5 WHEN an event is `completed` THEN the system does not show it under the admin "completed" tab despite the filter being selected.

8.6 WHEN an admin looks for owners and their venues THEN the system provides no venue-owners list with each owner's venues, and bank details are not viewable on an individual event/venue or on venue-owner expansion.

8.7 WHEN discounts are managed in the admin panel THEN the system does not distinguish admin-owned codes (a create-discount that applies to every event) from event-owner-created codes.

8.8 WHEN the admin venues list renders the CAPACITY column THEN the system prints "[object Object]" because the venue capacity value is an object being rendered directly instead of being formatted.

8.9 WHEN the admin views the venues page THEN the system does not show a count of pending venues, unlike the events page which shows a pending number.

---

### Expected Behavior (Correct)

#### Flow 1 — Venue booking flow

1.1 WHEN a user pays the advance for an accepted booking THEN the system SHALL charge Razorpay an amount equal to the amount recorded on that booking's Payment record (charged == recorded).

1.2 WHEN the booking advance payment is initiated THEN the system SHALL create the Payment record with the full billing breakdown (`subtotal`, `platformFee`, `platformFeePercentage`, `gstAmount`, `totalAmount`) consistent with the 10% advance model.

1.3 WHEN the platform fee for a booking is computed THEN the system SHALL derive and record it consistently with the charged amount, not as a value disconnected from what was charged.

#### Flow 2 — Event ticketing flow

2.1 WHEN a buyer applies a valid discount code to a ticket purchase THEN the system SHALL pass the discount into billing and charge Razorpay the discounted total (the amount the buyer sees in the summary).

2.2 WHEN a discount code is applied to a ticket purchase THEN the system SHALL record the `discountCode` and `discountAmount` on the Payment.

2.3 WHEN a buyer purchases a paid tier via the tier-based path THEN the system SHALL require and charge payment for the tier price before issuing entitlement, consistent with the flat purchase path (no free paid tickets).

2.4 WHEN the tier-based purchase path is used THEN the system SHALL apply the same discount handling as the flat purchase path so both paths agree.

#### Flow 3 — Settlement / payout flow

3.1 WHEN a payout is processed THEN the system SHALL use the commission/platform-fee percentage that applies to that event/venue rather than a hardcoded value, so settlement matches what was charged.

3.2 WHEN a payout record is created THEN the system SHALL source the recipient owner's saved bank details from their stored settings and attach them to the payout, so every settlement is tied to the owner's stored bank details. (Encryption of those bank details is owned by `industry-standard-upgrade`.)

3.3 WHEN a payout is created THEN the system SHALL represent it as an explicit manual-payout record in a state that accurately reflects whether funds have been disbursed (no record implying a transfer that did not occur).

#### Flow 4 — Discount coordination (bearer rule)

4.1 WHEN an admin-created discount code is applied to a purchase THEN the system SHALL absorb the discount as a platform cost and SHALL preserve the full listed price the owner set in the owner's settlement records.

4.2 WHEN an event-owner-created discount code is applied to a purchase THEN the system SHALL deduct the discount from the owner's settlement while still recording the full listed price the owner set on the platform side.

#### Flow 5 — Bank details capture / persist / prefill

5.1 WHEN an owner creates their first event or venue THEN the system SHALL capture their bank details and persist them to their Settings.

5.2 WHEN an owner who has saved bank details creates a subsequent event or venue THEN the system SHALL prefill the saved bank details, allow editing, and re-save any edits back to Settings.

5.3 WHEN bank details are entered THEN the system SHALL validate them (IFSC 11-character format, numeric account number) before saving. (Storage encryption is owned by `industry-standard-upgrade`.)

#### Flow 6 — Event visibility / approval

6.1 WHEN a private event is shared via its link THEN the system SHALL require admin approval before the event is accessible.

6.2 WHEN an event has status `completed` THEN the system SHALL NOT present it as available or bookable/purchasable to users.

6.3 WHEN the current time is past an event's end date/time THEN the system SHALL NOT list the event as visible to users.

#### Flow 7 — Combined role account + dashboard switching

7.1 WHEN a person is both a venue owner and a normal user THEN the system SHALL represent them as a single sign-in account that carries both roles.

7.2 WHEN a signed-in user with the owner role views the dashboard THEN the system SHALL provide a sidebar dropdown switcher to move between the owner ("Fira Venue") dashboard and the normal user dashboard.

7.3 WHEN a user opens the create ("plus") menu THEN the system SHALL show the "create venue" option and grant venue-creation permission only to venue owners.

#### Flow 8 — Admin panel coordination

8.1 WHEN an event has no associated venue THEN the admin panel SHALL NOT count it as pending.

8.2 WHEN an admin performs an action in the panel THEN the system SHALL update the affected data in place without a full page reload.

8.3 WHEN the admin user list is displayed THEN the system SHALL show each user's actual type/role in the badge/type column.

8.4 WHEN the admin audit trail is viewed THEN the system SHALL show real recorded admin actions, not dummy entries.

8.5 WHEN an event is `completed` THEN the system SHALL show it under the admin "completed" tab when that filter is selected.

8.6 WHEN an admin looks for owners and their venues THEN the system SHALL provide a venue-owners list with each owner's venues in a dropdown, and SHALL make bank details viewable on an individual event/venue and on venue-owner expansion.

8.7 WHEN discounts are managed in the admin panel THEN the system SHALL distinguish admin-owned codes (a create-discount that applies to every event) from event-owner-created codes.

8.8 WHEN the admin venues list renders the CAPACITY column THEN the system SHALL format the capacity object into a human-readable value (e.g. a min–max range or a single number), never "[object Object]".

8.9 WHEN the admin views the venues page THEN the system SHALL show a pending-count badge/number for venues consistent with how the events page shows its pending count.

---

### Unchanged Behavior (Regression Prevention)

#### Flow 1 — Venue booking flow

3.1 WHEN a booking has no discount and standard fees THEN the system SHALL CONTINUE TO charge a 10% advance of the booking total.

3.2 WHEN a booking advance payment succeeds THEN the system SHALL CONTINUE TO mark `paymentStatus = 'paid'`, transition the booking to `accepted`, and link the Payment.

#### Flow 2 — Event ticketing flow

3.3 WHEN a buyer purchases a paid flat-price ticket with no discount THEN the system SHALL CONTINUE TO charge ticket price + platform fee + GST as computed today.

3.4 WHEN a free ticket (price is zero) is requested THEN the system SHALL CONTINUE TO issue it without requiring payment.

3.5 WHEN inventory is reserved THEN the system SHALL CONTINUE TO reserve atomically and prevent overselling past capacity, releasing seats if issuing fails.

#### Flow 3 — Settlement / payout flow

3.6 WHEN a payout is created for a valid recipient THEN the system SHALL CONTINUE TO record `grossAmount`, `platformCommission`, and `netAmount = grossAmount - platformCommission` on the payout.

#### Flow 4 — Discount coordination

3.7 WHEN no discount code is applied THEN the system SHALL CONTINUE TO charge and record the full listed price with standard fees.

#### Flow 5 — Bank details

3.8 WHEN valid bank details are already saved THEN the system SHALL CONTINUE TO honor them for settlement without requiring change.

#### Flow 6 — Event visibility / approval

3.9 WHEN a public event is approved, not completed, and before its end date THEN the system SHALL CONTINUE TO list it and allow purchase.

#### Flow 7 — Combined role account

3.10 WHEN a normal user with no owner role signs in THEN the system SHALL CONTINUE TO show the normal user dashboard with no owner switcher and no venue-creation option.

#### Flow 8 — Admin panel

3.11 WHEN an event has a venue and is genuinely pending approval THEN the admin panel SHALL CONTINUE TO count it as pending.
3.12 WHEN existing admin filters (other than the fixed ones) are used THEN the system SHALL CONTINUE TO return the same results as today.
3.13 WHEN capacity is already a plain displayable value THEN the system SHALL CONTINUE TO display it correctly.
3.14 WHEN there are no pending venues THEN the system SHALL CONTINUE TO show no pending badge (or zero) consistent with the events-page behavior.

---

## Deriving the Bug Conditions

Structured pseudocode for the two most money-sensitive, code-verified bugs. **F** = original (unfixed) function; **F'** = fixed function.

### Booking advance: charged must equal recorded (Flow 1)

```pascal
FUNCTION isBugCondition(booking)
  INPUT: booking with totalAmount
  OUTPUT: boolean
  // The advance charged to the gateway and the amount recorded on the
  // Payment for that booking diverge.
  advanceCharged  <- chargedAmount(booking)      // what initiatePayment sent to Razorpay
  recordedTotal   <- paymentRecord(booking).totalAmount
  RETURN advanceCharged != recordedTotal
END FUNCTION
```

```pascal
// Property: Fix Checking - booking billing in sync
FOR ALL booking WHERE isBugCondition(booking) DO
  result <- initiateBookingPayment'(booking)
  ASSERT result.payment.totalAmount = result.chargedAmount
  ASSERT result.payment.subtotal + result.payment.platformFee + result.payment.gstAmount = result.chargedAmount
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL booking WHERE NOT isBugCondition(booking) DO
  ASSERT chargedAmount'(booking) = round(booking.totalAmount * 0.10)   // advance stays 10%
  ASSERT F(booking).paymentStatus = F'(booking).paymentStatus
END FOR
```

### Ticket discount: charge the discounted total (Flow 2)

```pascal
FUNCTION isBugCondition(purchase)
  INPUT: purchase with ticketPrice, quantity, appliedDiscountAmount
  OUTPUT: boolean
  // A discount was applied but was not passed into billing.
  RETURN purchase.appliedDiscountAmount > 0
         AND chargedTotal(purchase) = calculateBilling(ticketPrice, quantity, feePct, 0).totalAmount
END FUNCTION
```

```pascal
// Property: Fix Checking - discounted charge
FOR ALL purchase WHERE isBugCondition(purchase) DO
  billing <- calculateBilling'(ticketPrice, quantity, feePct, appliedDiscountAmount)
  result  <- purchaseTicket'(purchase)
  ASSERT result.chargedAmount = billing.totalAmount
  ASSERT result.payment.discountAmount = appliedDiscountAmount
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL purchase WHERE NOT isBugCondition(purchase) DO
  ASSERT F(purchase).chargedAmount = F'(purchase).chargedAmount   // no-discount path unchanged
END FOR
```
