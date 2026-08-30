# FIRA — End-to-End Manual Test Plan

Ordered, step-by-step verification of every flow from **venue/event creation → approval → booking/ticketing → cancellation → payout settlement**, across User, Venue Owner, Creator and Admin.

**Read this first:**

- The phases are ordered so each one produces the data the next one needs. Run them top to bottom the first time.
- Every case is grounded in the actual code (`server/services/*`, `server/routes/*`, `client/src/app/*`, `admin/src/pages/*`). Where the code does **not** do what you'd expect, the case is marked **⚠️ KNOWN GAP** with what actually happens. Those are documentation of current behaviour, not instructions to "make it pass".
- Tick the result column. Anything that deviates from "Expected" is a bug — capture the request/response and the DB document.

**Companion doc:** [`docs/PLATFORM_FLOWS.md`](./PLATFORM_FLOWS.md) describes the flows narratively. This doc is the executable checklist for them.

---

## 0. Setup

### 0.1 Start the three apps

| # | Command (from repo root) | Serves |
|---|---|---|
| 1 | `npm run dev:server` | API on `http://localhost:5000` (check your `server/.env` `PORT`) |
| 2 | `npm run dev:client` | User + Venue Portal on `http://localhost:3000` |
| 3 | `npm run dev:admin` | Admin app (Vite, usually `http://localhost:5173`) |

Run each in its own terminal. Do not background them into one.

### 0.2 Required environment

| Variable (server/.env) | Needed for | If missing |
|---|---|---|
| `MONGODB_URI` | everything | server won't boot |
| `JWT_SECRET` | all auth | every authed call 401s |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Phases 3, 6, 8 | `initiatePayment` throws `Razorpay credentials not configured`; refunds silently mark themselves `completed` without hitting the gateway |
| `SMTP_*` | notification assertions | emails skipped, flows still pass |
| `REDIS_HOST` | token blocklist | skipped entirely when unset (dev-friendly) |

Use **Razorpay test mode** keys. Test card: `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`. Never point this plan at live keys.

### 0.3 ⚠️ The seed scripts are broken — create data by hand

Every file in `server/seeds/` requires model paths with a doubled final letter (`../models/Userr`, `../models/Venuee`, `../models/Eventt`, `../models/Bookingg`, `../models/Tickett`, `../models/BrandProfilee`, `../models/Postt`). They all crash on `require`. **Do not rely on `seedAll.js` / `seedTestUser.js`.** Build test data through the UI as this plan describes — that is also better coverage.

### 0.4 Test accounts to create up front

Create these via the UI in Phase 1. Keep them for the whole run.

| Label | Role | Created at | Purpose |
|---|---|---|---|
| `owner@test.com` | Venue Owner | `/venue-portal/signup` | Lists venues, approves requests, receives payouts |
| `buyer@test.com` | Normal User | `/signup` | Books venues, buys tickets |
| `buyer2@test.com` | Normal User | `/signup` | Second buyer — oversell + access-control cases |
| `creator@test.com` | Creator/Organizer | `/signup` then `/create/creator` | Brand page, creates events |
| admin | Admin | seeded/created directly in Mongo with `role: 'admin'` | Approvals + settlement |

There is no admin self-signup. Promote a user directly:

```js
// mongosh
db.users.updateOne({ email: 'admin@test.com' }, { $set: { role: 'admin', adminRole: 'super_admin' } })
```

`adminRole: 'super_admin'` is required for `/api/admin/audit-trail`, `/earnings/*` and `PATCH /users/:id/role` (guarded by `roleGuard`).

### 0.5 Test data ledger — fill this in as you go

| Slot | Value | Set in |
|---|---|---|
| `OWNER_ID` | | TC-1.2 |
| `BUYER_ID` | | TC-1.3 |
| `VENUE_ID` (approved) | | TC-2.5 |
| `BOOKING_ID` (paid advance) | | TC-3.6 |
| `PAYMENT_ID` (booking advance) | | TC-3.6 |
| `EVENT_ID` (approved, paid) | | TC-5.7 |
| `TICKET_ID` | | TC-6.4 |
| `PAYMENT_ID` (ticket) | | TC-6.4 |
| `BRAND_ID` | | TC-9.4 |
| `PAYOUT_ID` (booking) | | TC-11.3 |
| `PAYOUT_ID` (event) | | TC-11.5 |

### 0.6 The money formula — memorise this before Phase 3

Every charge on the platform runs through `paymentService.calculateBilling(price, qty, feePct, discount)`:

```
subtotal           = price × qty
discountedSubtotal = max(0, subtotal − discount)
platformFee        = round(discountedSubtotal × feePct / 100)      // feePct default 5
gstAmount          = round(platformFee × 0.18)                      // 18% GST on the FEE only
totalAmount        = discountedSubtotal + platformFee + gstAmount    // what Razorpay charges
```

Razorpay is charged `totalAmount × 100` paise. Payouts run through `processPayout`:

```
platformCommission = round(grossAmount × feePct / 100)
netAmount          = grossAmount − platformCommission
```

**Reference numbers used throughout this plan.** Create the Phase 2 venue with `pricePerDay = ₹100,000` and leave `platformFeePercentage = 5` so these hold:

| Quantity | Value |
|---|---|
| Booking `totalAmount` (1 day) | ₹100,000 |
| 10% advance (`round(100000 × 0.10)`) | ₹10,000 |
| `platformFee` on advance | ₹500 |
| `gstAmount` | ₹90 |
| **Razorpay charge** | **₹10,590** (`1059000` paise) |
| Remaining, settled off-platform | ₹90,000 |
| Payout on gross ₹10,000 | commission ₹500, net ₹9,500 |

---

## Phase 1 — Accounts and roles

| ID | Actor | Step | Expected | ✅ |
|---|---|---|---|---|
| TC-1.1 | — | `GET /api/health` (or root) | 200, server reachable | |
| TC-1.2 | Owner | Sign up at `/venue-portal/signup` as `owner@test.com` | Account created; lands in venue portal. Record `OWNER_ID` (`db.users.findOne({email})._id`) | |
| TC-1.3 | Buyer | Sign up at `/signup` as `buyer@test.com` | Account created, `role: 'user'`. Record `BUYER_ID` | |
| TC-1.4 | Buyer2 | Sign up as `buyer2@test.com` | Account created | |
| TC-1.5 | Creator | Sign up as `creator@test.com` | Account created | |
| TC-1.6 | Admin | Promote `admin@test.com` per 0.4, then log in to the admin app | Dashboard loads; `GET /api/admin/stats` returns 200 | |
| TC-1.7 | Buyer | Log in to the admin app with `buyer@test.com` | **Rejected.** `adminAuth` gates the whole admin router via `router.use(adminAuth)` | |
| TC-1.8 | Owner | From the user dashboard, use the dashboard switcher to move between "user" and "Fira Venue" views | Both views reachable with one account — a user may hold multiple roles (`user.roles[]`, legacy `user.role` kept for compat) | |
| TC-1.9 | Buyer | Log out, then call any authed endpoint with the old token | 401. (Blocklist only enforced when `REDIS_HOST` is set — otherwise the token stays valid until expiry. Note which mode you tested.) | |

---

## Phase 2 — Venue creation → admin approval → public listing

### 2A. Creation (Venue Owner)

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-2.1 | At `/venue-portal/venues/create`, complete the stepper: basics → location (maps link) → capacity & pricing (`pricePerDay = 100000`) → images → payout bank details | Venue created, 201. Record `VENUE_ID`. `status: 'pending'`, `isActive: true` | |
| TC-2.2 | Check the created document | `pricing.pricePerDay = 100000` **and** `pricing.basePrice = 100000` (mirrored for back-compat). `platformFeePercentage = 5`. `cancellationPolicy = { freeCancellationHours: 48, partialRefundPercentage: 50, noCancellationHours: 24 }` | |
| TC-2.3 | Confirm the bank details saved in the last step | `db.users.findOne({_id: OWNER_ID}).bankDetails` has `accountName`, `accountNumber` (9–18 digits), `ifscCode` matching `^[A-Z]{4}0[A-Z0-9]{6}$`, `bankName`. **Phase 11 fails closed without this** | |
| TC-2.4 | Submit a venue with `locationLink = "not-a-url"` | 400, `locationLink must be a valid URL` (zod guard on the route). Empty string is allowed | |
| TC-2.4b | Submit a venue with no `capacity.max` / no `address.city` | 400 — both are `required` in the schema | |
| TC-2.4c | Check `location` (GeoJSON) on the created venue | **Absent / undefined.** The form collects a maps link, not coordinates. This is deliberate: an un-geocoded venue drops out of `/api/venues/nearby` `$near` results instead of poisoning them with fake Delhi coordinates | |

### 2B. Approval (Admin)

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-2.5 | Admin app → Venues, filter pending. Approve `VENUE_ID` (`PUT /api/admin/venues/:id/status`, body `{status:'approved'}`) | 200, venue `status: 'approved'` | |
| TC-2.6 | Send `{status: 'banana'}` | 400 — the route validates against the status enum | |
| TC-2.7 | Reject a second throwaway venue | `status: 'rejected'` | |
| TC-2.8 | Suspend a third throwaway venue | `status: 'suspended'` | |
| TC-2.9 | **Access control:** call `PUT /api/venues/:id/status` (the *venue* router, not admin) | **404 / no such route.** This unguarded endpoint was removed — status changes are admin-only. If it responds 200, that is a broken-access-control regression | |
| TC-2.10 | Unauthenticated `PUT /api/admin/venues/:id/status` | 401 | |

### 2C. Public visibility

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-2.11 | Log out, open `/venues` | Only the **approved** venue appears. Pending / rejected / suspended are absent | |
| TC-2.12 | Open `/venues/{VENUE_ID}` | Detail page renders: images, `pricePerDay`, capacity, amenities, rules, and a **Cancellation Policy** block reading `48h free / 50% partial / 24h no-cancel` | |
| TC-2.13 | `GET /api/venues/sections` | `topRated`, `inDemand`, `latest` arrays, approved-only | |
| TC-2.14 | Owner edits the venue (`PUT /api/venues/:id`) | 200; public listing reflects the change (route calls `invalidateCache('venues')`) | |
| TC-2.15 | Buyer attempts `PUT /api/venues/{VENUE_ID}` with their own token | 403 `You do not own this venue` | |
| TC-2.16 | Owner `PATCH /api/venues/:id/cancellation-policy` with `{freeCancellationHours: 24, partialRefundPercentage: 50, noCancellationHours: 48}` | 400 `noCancellationHours must be less than freeCancellationHours` | |
| TC-2.17 | Same call with `{freeCancellationHours: 72, partialRefundPercentage: 40, noCancellationHours: 12}` | 200, persisted. **Revert to 48/50/24 before Phase 4** | |
| TC-2.18 | Owner `POST /api/venues/:id/cancel` | ⚠️ **KNOWN GAP** — despite the name, this **deletes** the venue (`deleteVenue`), it does not cancel anything. Test on a throwaway venue only | |

---

## Phase 3 — Venue booking request → owner acceptance → 10% advance payment

Uses `VENUE_ID` from Phase 2. Owner has `autoApproveBookings: false` (default).

### 3A. Request (Buyer)

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-3.1 | On `/venues/{VENUE_ID}`, request a booking for a date **more than 48h away**: date, start/end time, expected guests, purpose | 201. Record `BOOKING_ID`. `status: 'pending'`, `paymentStatus: 'pending'`, `totalAmount: 100000` | |
| TC-3.2 | Check the owner's side | Owner receives: email (`sendVenueBookingEmail`), in-app notification `booking_request` linking to `/dashboard/requests`, and push. Buyer gets a WhatsApp confirmation **if** a phone is on file | |
| TC-3.3 | Owner opens `/dashboard/requests` | The request is listed with buyer name, date, time, guests, amount | |
| TC-3.4 | Set `autoApproveBookings: true` on a throwaway venue and book it | Booking is created already `accepted` — `createBooking` flips it immediately | |

### 3B. Owner decision

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-3.5 | Owner accepts `BOOKING_ID` (`PUT /api/bookings/:id/status`, `{status:'accepted'}`) | `status: 'accepted'`, `ownerResponse.respondedAt` set. Venue `blockedDates` now has an entry for that date with a slot `{startTime, endTime, type:'booked'}`. Buyer notified "Booking confirmed 🎉" | |
| TC-3.5b | Buyer2 tries to book the **same venue, same date and time** | Should conflict. ⚠️ **VERIFY** — `createBooking` does not itself re-check `blockedDates`; only `eventService.createEvent` checks venue time overlap. If the second booking is created, log it as a double-booking bug | |
| TC-3.6 | Owner rejects a second throwaway booking with a reason | `status: 'rejected'`, `rejectionReason` stored, buyer notified with the reason | |
| TC-3.7 | Owner accepts with `modifiedDates` in the body | `ownerResponse.modifiedDates` persisted | |
| TC-3.8 | **Access control:** send `PUT /api/bookings/{BOOKING_ID}/status` `{status:'accepted'}` with **no Authorization header** | ⚠️ **KNOWN GAP — expect this to succeed (200).** The route has no `auth` middleware and no ownership check, so any anonymous caller can accept or reject any booking. Log as a broken-access-control finding | |
| TC-3.9 | `GET /api/bookings` and `GET /api/bookings/venue/{VENUE_ID}` unauthenticated | ⚠️ **KNOWN GAP — expect 200 with data.** Neither route is guarded; booking lists including buyer name/email/phone leak publicly | |
| TC-3.10 | `GET /api/bookings/user/{OTHER_USER_ID}` with the buyer's token | 403 `Unauthorized` — this route *is* guarded and ownership-checked | |

### 3C. 10% advance payment (Buyer → Platform)

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-3.11 | Buyer initiates payment on the accepted booking (`POST /api/bookings/{BOOKING_ID}/initiate-payment`) | 200. Response `booking.advanceAmount = 10000`, `remainingAmount = 90000`. A `Payment` is created: `type:'venue_booking'`, `referenceModel:'Booking'`, `status:'pending'`, `subtotal: 10000`, `platformFee: 500`, `gstAmount: 90`, `totalAmount: 10590`, `gatewayOrderId` present | |
| TC-3.12 | Compare the Razorpay checkout amount to the record | Razorpay order amount = `1059000` paise = ₹10,590 = `Payment.totalAmount`. **Charged == recorded** | |
| TC-3.13 | Check `Booking.platformFee` after initiate | `500` — written back from the billing breakdown | |
| TC-3.14 | Complete checkout with the test card, then `POST /api/bookings/{BOOKING_ID}/verify-payment` | `Payment.status: 'success'`, `paidAt` set, `gatewayTransactionId` present. `Booking.paymentStatus: 'paid'`, `status: 'accepted'`, `payment` linked. **Record `PAYMENT_ID`** | |
| TC-3.15 | Call initiate-payment again on the same booking | 400 `Advance already paid` | |
| TC-3.16 | Buyer2 calls initiate-payment on the buyer's booking | 400 `Unauthorized: This booking belongs to another user` | |
| TC-3.17 | Initiate payment on a `rejected` or `cancelled` booking | 400 `Booking must be pending or accepted before payment` | |
| TC-3.18 | Post verify-payment with a **tampered** `gatewaySignature` | Rejected: `Payment verification failed: Invalid signature`, `Payment.status: 'failed'`, booking stays unpaid | |
| TC-3.19 | Buyer opens `/dashboard/payments` → Transactions | The ₹10,590 advance appears with its breakdown | |
| TC-3.20 | Buyer opens `/dashboard/bookings` | Booking shows accepted + advance paid, remaining ₹90,000 flagged as settled at the venue | |
| TC-3.21 | Unset the Razorpay env vars and retry initiate-payment | 400 `Razorpay credentials not configured` — **and no `Payment` row is created** (fails closed before the order). Restore the vars afterwards | |

---

## Phase 4 — Booking cancellation and the refund policy tiers

Policy on the venue: `freeCancellationHours: 48`, `partialRefundPercentage: 50`, `noCancellationHours: 24`. Enforced by `venueService.processCancellation` behind `POST /api/bookings/:id/cancel`.

Create one paid booking per tier (repeat Phase 3 with different `bookingDate`). `hoursRemaining` is computed from `bookingDate` + `startTime`.

| ID | Booking start is… | Step | Expected | ✅ |
|---|---|---|---|---|
| TC-4.1 | **72h away** (> 48) | Buyer `POST /api/bookings/:id/cancel` | 200 `{ refundType: 'full', refundPercentage: 100 }`; booking `status: 'cancelled'` | |
| TC-4.2 | **36h away** (24 < h ≤ 48) | Same | 200 `{ refundType: 'partial', refundPercentage: 50 }`; booking `status: 'cancelled'` | |
| TC-4.3 | **exactly 48h away** | Same | Boundary: `hoursRemaining > freeCancellationHours` is **false** at exactly 48 → **partial**, not full | |
| TC-4.4 | **12h away** (≤ 24) | Same | 400 `Cancellation window has passed`; booking **stays** in its previous status | |
| TC-4.5 | **exactly 24h away** | Same | Boundary: `hoursRemaining <= noCancellationHours` is **true** at exactly 24 → 400, rejected | |
| TC-4.6 | Policy changed to 72/40/12 first (TC-2.17) | Cancel at 60h out | Partial at **40%**, not 50% — the venue's configured policy is what's applied | |
| TC-4.7 | Venue with no `cancellationPolicy` at all | Cancel at 60h out | Defaults 48/50/24 apply | |

### ⚠️ KNOWN GAPS in cancellation — verify and record each

| ID | Check after a successful TC-4.1 / TC-4.2 cancel | Actual behaviour | ✅ |
|---|---|---|---|
| TC-4.8 | Is a `Refund` document created? | **No.** `processCancellation` returns a percentage and nothing else. No `Refund` row, no Razorpay refund call | |
| TC-4.9 | Is `Booking.paymentStatus` updated? | **No.** It stays `'paid'` even though the booking is cancelled | |
| TC-4.10 | Is the venue's `blockedDates` slot released? | **No.** The date stays blocked, so the slot is unsellable after cancellation | |
| TC-4.11 | Does the buyer get a cancellation notification? | **No** — the notification lives in `refundService.initiateBookingRefund`, which this route never calls | |
| TC-4.12 | Does `refundService.initiateBookingRefund` (which *does* create the Refund, release the date and notify) run from anywhere? | It's only reachable via `bookingService.cancelBooking`, which **no route calls**. Two cancellation implementations exist; the wired one is the incomplete one | |
| TC-4.13 | `POST /api/bookings/:id/cancel` for a booking belonging to another user | ⚠️ `processCancellation` takes `userId` but **never compares it to `booking.user`**. Expect the cancel to succeed for a stranger. Log as broken access control | |

### Admin-side refund handling

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-4.14 | Admin `GET /api/payments/refunds` | 200, paginated refund list (admin-only) | |
| TC-4.15 | Buyer calls the same endpoint | 403 | |
| TC-4.16 | Create a `pending` refund (see Phase 8), then admin `POST /api/payments/refunds/:id/process` `{action:'approve'}` | `Refund.status: 'completed'`, `processedAt` set, linked `Payment.status: 'refunded'`, user notified "Refund Approved" | |
| TC-4.17 | Same with `{action:'reject', notes:'...'}` | `status: 'rejected'`, `rejectionReason` = notes, user notified | |
| TC-4.18 | Process an already-completed refund | 400 `Refund is not pending` | |
| TC-4.19 | With Razorpay **unconfigured**, approve a refund | ⚠️ Refund is marked `completed` **without any gateway call**. Convenient in dev, dangerous in prod — confirm prod always has keys | |
| TC-4.20 | Refund the same payment twice via `refundService.processRefund` | 400 `Refund already exists for this payment` | |
| TC-4.21 | Refund an amount greater than `Payment.amount` | `Refund amount cannot exceed payment amount` | |
| TC-4.22 | Refund a `pending` (never-succeeded) payment | `Can only refund successful payments` | |

---

## Phase 5 — Event creation → dual approval → public listing

Events need **two** approvals: `venueApproval` (venue owner) and `adminApproval` (admin). `status` only becomes `approved` when both are.

### 5A. Creation (Creator/Organizer)

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-5.1 | Creator opens `/create/event` and completes the stepper: basics → date/time + **existing venue** (`VENUE_ID`) → tickets (paid, ₹2,000) → extras (F&F stay, alcohol, payout bank account) | 201. Record `EVENT_ID`. `status: 'pending'`, `venueApproval.status: 'pending'`, `adminApproval.status: 'pending'` | |
| TC-5.2 | Create an event with `startDateTime` in the past | 400 `Event start date/time cannot be in the past` | |
| TC-5.3 | Create an event with `endDateTime` ≤ `startDateTime` | 400 `End date/time must be after start date/time` | |
| TC-5.4 | Create a second event at the **same venue with an overlapping window** | 400 `Time slot conflict: This venue is already booked from … for "<name>"`. Cancelled and rejected events are excluded from the conflict check | |
| TC-5.5 | Create an event with a **custom venue** (`customVenue.isCustom = true`, maps link mandatory) | `venueApproval.status: 'approved'`, `respondedBy: 'system'` — auto-approved because there is no owner to ask. `adminApproval` stays `pending` | |
| TC-5.6 | Create an event as a **verified** organizer (`isVerified: true` or `verificationBadge !== 'none'`) | Fast track: `adminApproval.status: 'approved'`, `respondedBy: 'system'`. If the venue side is also approved (e.g. custom venue) the event goes straight to `status: 'approved'` | |
| TC-5.7 | Set `ticketPrice: 999` but `ticketType: 'free'` | Model pre-save reconciles them — **price wins**: `ticketType` becomes `'paid'`. Conversely `ticketType: 'free'` with price 0 forces `ticketPrice: 0` | |
| TC-5.8 | Submit `ticketTiers` with 11 entries | 400 `ticketTiers must contain between 1 and 10 tiers` | |
| TC-5.9 | Submit two tiers named `VIP` and `vip` | 400 `Duplicate tier names are not allowed` (case-insensitive) | |
| TC-5.10 | Submit a tier with `price: -1` or `maxQuantity: 0` | 400 on each (`price >= 0`, `maxQuantity >= 1`, integer) | |
| TC-5.11 | Submit `payoutAccount` pointing at **someone else's** bank account id | Silently sanitised to `null` (`sanitizePayoutAccount`), meaning "use my default". Trust boundary holds | |
| TC-5.12 | Owner's inbox after TC-5.1 | Venue owner receives `sendEventRequestEmail` with event + organizer details (only for non-custom venues) | |

### 5B. Venue owner approval

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-5.13 | Owner opens `/venue-portal/events` (`GET /api/events/venue-requests?userId=OWNER_ID`) | The pending event request is listed | |
| TC-5.14 | Owner approves (`POST /api/events/:id/venue-approve` `{venueOwnerId, status:'approved'}`) | `venueApproval.status: 'approved'`. Event `status` stays `pending` because admin hasn't approved yet. Organizer notified "Venue Approved Your Event … Waiting for admin approval" | |
| TC-5.15 | Owner rejects a throwaway event with a reason | Event `status: 'rejected'` immediately — one rejection kills it. Organizer notified with the reason | |
| TC-5.16 | Approve using a `venueOwnerId` that doesn't own the venue | 400 `You do not own this venue` | |
| TC-5.17 | **Access control:** call `POST /api/events/:id/venue-approve` with **no token**, passing the real owner's id in the body | ⚠️ **KNOWN GAP — expect 200.** The route has no `auth` middleware and trusts `venueOwnerId` from the request body. Anyone who knows the owner's id can approve on their behalf | |

### 5C. Admin approval

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-5.18 | Admin app → Events → pending admin approval (`GET /api/events/admin-pending`) | The event is listed. Venue-less events are excluded from the pending count | |
| TC-5.19 | Admin approves (`POST /api/events/:id/admin-approve` `{adminId, status:'approved'}`) | `adminApproval.status: 'approved'` **and** since venue already approved → event `status: 'approved'`; venue `daySlots` marked booked (`updateVenueAvailability`); a backing `Booking` is auto-created and linked as `event.booking` | |
| TC-5.20 | Verify the auto-created booking | `db.bookings.findOne({_id: event.booking})` exists and points at the venue and dates | |
| TC-5.21 | Admin rejects a throwaway event | `status: 'rejected'`, `adminApproval.rejectionReason` set, organizer notified | |
| TC-5.22 | Approve admin-side **before** the venue approves | `adminApproval` approved but event `status` stays `pending`. Then when the owner approves, `venueApproveEvent` flips it to `approved` and creates the booking. Either order must reach the same end state | |
| TC-5.23 | Admin-approve an event whose organizer has a **brand profile** | Brand followers notified `brand_new_event` (in-app + email) via `notifyBrandFollowers` | |
| TC-5.24 | **Access control:** `POST /api/events/:id/admin-approve` with **no token** and any `adminId` in the body | ⚠️ **KNOWN GAP — expect 200.** No `auth`, no `adminAuth`, `adminId` taken from the body. **An organizer can approve their own event.** This is the most serious finding in the approval chain — record it explicitly | |

### 5D. Public listing and visibility gates

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-5.25 | Logged out, open `/events` | Only `approved` + `isActive` + not-yet-ended **public** events appear. `pending`, `rejected`, `draft`, `cancelled` are absent | |
| TC-5.26 | Open `/events/{EVENT_ID}` while it is still `pending` | Not publicly resolvable; the organizer can always see their own | |
| TC-5.27 | Create a **private** event and check `privateCode` | 8-char uppercase hex generated on save. The event does not appear in `/events` | |
| TC-5.28 | Buyer `POST /api/events/:id/access` with the correct `accessCode` | `PrivateEventAccess` request created | |
| TC-5.29 | Same with a wrong code | 400 `Invalid access code` | |
| TC-5.30 | Same against a **public** event | 400 `This is not a private event` | |
| TC-5.31 | `PUT /api/events/:id/access/:requestId` `{status:'approved'}` **with no token** | ⚠️ **KNOWN GAP — expect 200.** Unguarded; anyone can grant private-event access | |
| TC-5.32 | `GET /api/events?includeCompleted=true` | Response includes a `completedEvents` array (up to 20, newest-ended first) | |
| TC-5.33 | Admin `PATCH /api/admin/events/:id/featured` `{isFeatured:true}` | 200; event appears in featured slots; an `AuditLog` entry is written | |
| TC-5.34 | Organizer edits `startDateTime` **after** tickets are sold (`currentAttendees > 0`) | 400 `Cannot change event date or time after tickets have been sold. Please contact support.` | |
| TC-5.35 | Organizer edits `name` / `description` / `venue` on an event with ticket holders | 200, and ticket holders receive update notifications for the changed fields | |

---

## Phase 6 — Ticket purchase (free, paid, tiered, discounted)

Uses the approved paid event from Phase 5 (`EVENT_ID`, ₹2,000 per ticket, `platformFeePercentage: 5`).

### 6A. Free tickets

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-6.1 | Buyer claims a ticket on a **free** approved event (`POST /api/tickets`) | 201 with the ticket directly — no payment step. `Ticket.price: 0`, `payment: null`, `status: 'active'`, `ticketId` matches `TKT-[0-9A-F]{12}`, `qrCode` is a data URL | |
| TC-6.2 | Check the event counter | `currentAttendees` incremented by `quantity`, atomically | |

### 6B. Paid tickets — the two-call flow

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-6.3 | Buyer purchases 2 tickets at ₹2,000 (`POST /api/tickets` with `eventId`, `quantity: 2`, **no** `paymentId`) | 200 `{ paymentRequired: true, paymentData }`. **No ticket issued yet, no seats reserved yet.** `Payment`: `subtotal 4000`, `platformFee 200`, `gstAmount 36`, `totalAmount 4236`, `listedPrice 4000`, `status 'pending'`, `type 'ticket'`, `referenceModel 'Event'` | |
| TC-6.4 | Complete Razorpay checkout, verify the payment, then call `POST /api/tickets` **again with `paymentId`** | 201 ticket issued. `Ticket.price = 4000` (unit × qty), `payment` linked. Record `TICKET_ID` and the ticket `PAYMENT_ID` | |
| TC-6.5 | Compare the Razorpay charge to the record | `423600` paise = ₹4,236 = `Payment.totalAmount`. Charged == recorded | |
| TC-6.6 | Notifications after issue | Buyer: "Ticket confirmed 🎟️" → `/dashboard/tickets`. Organizer: "Ticket sold" → `/dashboard/events/{EVENT_ID}` | |
| TC-6.7 | Try to skip payment: call `POST /api/tickets` with a **fabricated** `paymentId` | Should not issue a valid ticket. **Verify** — the code only checks that `paymentId` is truthy, it does not confirm the payment succeeded. If a ticket is issued for an unpaid/nonexistent payment id, log it as free-inventory exposure | |
| TC-6.8 | Buy a ticket for an event whose `startDateTime` is in the past | 400 `Tickets cannot be purchased for past events` | |
| TC-6.9 | Buy a ticket for a `completed` or `cancelled` event | 400 `This event is completed/cancelled. Tickets are no longer available.` | |

### 6C. Tiers

Create an event with tiers: `Early Bird` ₹1,000 / max 5, `VIP` ₹5,000 / max 2.

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-6.10 | Buy 1 `VIP` | Charged on the **tier** price: subtotal 5000, fee 250, gst 45, total **₹5,295**. `Ticket.ticketType = 'VIP'`, `price = 5000` | |
| TC-6.11 | Buy `ticketType: 'Platinum'` (not a tier on this event) | 400 `"Platinum" is not a ticket tier for this event` | |
| TC-6.12 | Buy `ticketType: 'VIP'` on an event with **no** tiers | 400 `This event does not have ticket tiers` | |
| TC-6.13 | Buy `ticketType: 'general'` on an event with no tiers | Allowed — back-compat for every pre-tiers ticket | |
| TC-6.14 | Buy 3 × `VIP` when `maxQuantity` is 2 | 400 `"VIP" is sold out` — the tier cannot oversell | |
| TC-6.15 | Sell both VIP seats, then check counters | `ticketTiers[VIP].soldCount = 2` **and** `currentAttendees` incremented by 2 in the **same** conditional update — the two counters can never disagree | |
| TC-6.16 | Buy a quantity that fits the tier but exceeds event `maxAttendees` | Rejected — the reservation filter requires both the event cap and the tier cap | |

### 6D. Capacity and race conditions

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-6.17 | Event with `maxAttendees: 10`, `currentAttendees: 9`. Buy 2 | 400 `Not enough tickets available` | |
| TC-6.18 | Two buyers race for the **last seat** (fire both requests simultaneously) | Exactly one succeeds; the other gets `Not enough tickets available`. `currentAttendees` never exceeds `maxAttendees` (atomic `findOneAndUpdate` guarded by `$expr`) | |
| TC-6.19 | Force a QR-generation failure after reservation | Seats are **released** (`$inc` reversed on both `currentAttendees` and tier `soldCount`) so capacity doesn't leak | |
| TC-6.20 | Client-side quantity selector at near-capacity | Capped at remaining seats / remaining tier — never offers more than exists | |

### 6E. Discount codes

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-6.21 | Admin creates a ₹500 code on `EVENT_ID` with `discountBearer: 'platform'` | Code created and visible in the admin Discount Codes page | |
| TC-6.22 | Buyer `POST /api/payments/apply-discount` `{code, eventId, subtotal}` | 200 with `discountAmount` and `discountBearer` | |
| TC-6.23 | Buy 1 ticket at ₹2,000 with the ₹500 code | `subtotal 2000`, `discountAmount 500`, `discountedSubtotal 1500`, `platformFee 75`, `gstAmount 14` (`round(13.5)`), `totalAmount 1589`. `listedPrice 2000`, `discountBearer 'platform'` | |
| TC-6.24 | Send a **client-inflated** `discountAmount` in the purchase body | Ignored. The server re-validates the code and derives the amount itself (`discountService.validateAndApplyDiscount`) | |
| TC-6.25 | Use an expired / exhausted / wrong-event code | Purchase **rejected before any charge** (throws, fails closed) | |
| TC-6.26 | Use a code with `discountBearer: 'owner'` | `Payment.discountBearer = 'owner'`. Phase 11 must then pay the owner `listedPrice − discountAmount` | |
| TC-6.27 | Discount larger than the subtotal | `discountedSubtotal` floors at 0; `totalAmount` = fee + GST only, never negative | |

### 6F. Buyer's own view

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-6.28 | `/dashboard/tickets` | Ticket listed with QR, event name, venue, date | |
| TC-6.29 | `GET /api/tickets/user/{OTHER_ID}` with the buyer's token | 403 `Unauthorized` | |
| TC-6.30 | `GET /api/tickets` and `GET /api/tickets/event/{EVENT_ID}` unauthenticated | ⚠️ **KNOWN GAP — expect 200 with attendee names and emails.** Neither route is guarded | |

---

## Phase 7 — Check-in / QR scanning

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-7.1 | Organizer creates scanning codes (`POST /api/events/:id/scanning-codes` with labels) | 201, codes created | |
| TC-7.2 | Non-organizer tries the same | 403 `Only the event organizer can…` | |
| TC-7.3 | Organizer lists codes (`GET /api/events/:id/scanning-codes`) | 200 for the organizer, 403 for anyone else | |
| TC-7.4 | Open `/scan/{code}` and scan `TICKET_ID`'s QR (`POST /api/tickets/scan` with `qrData`, `eventId`) | 200 `Check-in successful!`. `Ticket.isUsed: true`, `usedAt` set, `status: 'used'`, `checkedInBy = scannerId` | |
| TC-7.5 | Scan the same ticket again | 400 `Ticket already scanned at <time>` | |
| TC-7.6 | Scan a ticket from a **different** event | 400 `This ticket is for a different event` | |
| TC-7.7 | Scan a `cancelled` ticket | 400 `This ticket has been cancelled` | |
| TC-7.8 | Scan malformed `qrData` (not JSON) | 400 `Invalid QR code format` | |
| TC-7.9 | Scan valid JSON with no `ticketId` | 400 `Invalid ticket QR code` | |
| TC-7.10 | Scan a ticket on a day that is **not** the event day | ⚠️ **KNOWN GAP — expect the scan to succeed.** The date guard reads `ticket.event.date`, a field that does not exist on the `Event` model (it has `startDateTime` / `endDateTime`). `new Date(undefined)` → Invalid Date → `daysDiff` is `NaN` → `NaN > 0` is false → the check never fires. **Tickets are scannable on any date.** Record this | |
| TC-7.11 | `POST /api/tickets/:id/validate` with **no token** | ⚠️ **KNOWN GAP — expect 200 and the ticket marked used.** Unguarded, and it does no event/date/cancel checks at all — anyone with a ticket id can burn it | |
| TC-7.12 | `GET /api/tickets/event/:eventId/stats` | Returns `totalTickets`, `scannedTickets`, `totalAttendees`, `scannedAttendees`, `pending`; consistent with the scans performed | |
| TC-7.13 | Organizer deactivates a scanning code, then scans with it | Deactivated code rejected | |

---

## Phase 8 — Ticket and event cancellation refunds

### 8A. Single ticket cancellation

`refundService.calculateRefundAmount` tiers (hardcoded, **not** the venue policy): ≥48h → 100%, 24–48h → 50%, <24h → 0%.

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-8.1 | `GET /api/tickets/:id/refund-eligibility` on an active paid ticket, event 72h away | 200 JSON (**not** an HTML 404 — this route was missing once and broke the modal with `Unexpected token '<'`). ⚠️ **KNOWN GAP** — expect `refundAmount: 0` / `No refund…`: the tier maths reads `ticket.event.date`, which does not exist, so `hoursUntilEvent` is `NaN` and every comparison falls through to 0%. **Ticket refunds always compute zero regardless of timing** | |
| TC-8.2 | Eligibility for a **free** ticket | `eligible: false`, `Free tickets are not eligible for refund` | |
| TC-8.3 | Eligibility for a **used** ticket | `eligible: false`, `Ticket has already been used` | |
| TC-8.4 | Eligibility for a `cancelled` ticket | `eligible: false`, `Ticket is not active` | |
| TC-8.5 | Buyer calls `POST /api/tickets/:id/cancel` | 403 `Ticket cancellation is not available for non-admin users` — cancellation is **admin-only** by route guard | |
| TC-8.6 | Admin calls `POST /api/tickets/:id/cancel` | Ticket `status: 'cancelled'`; event `currentAttendees` decremented by `quantity`; buyer notified `ticket_cancelled`. Per TC-8.1 the refund amount will be 0, so no `Refund` is created | |
| TC-8.7 | Admin cancels a **used** ticket | 400 `Cannot cancel used ticket` | |
| TC-8.8 | Admin cancels an already-cancelled ticket | 400 `Ticket is not active` | |
| TC-8.9 | ⚠️ Check `refundService.initiateTicketRefund`'s ownership guard | It compares `ticket.user` to the passed `userId` — but the route passes the **admin's** id, so `Unauthorized: This ticket belongs to another user` may fire for admins cancelling someone else's ticket. Verify which happens and record it | |

### 8B. Event cancellation → bulk refunds

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-8.10 | Sell 3 paid tickets on a test event, then organizer `POST /api/events/:id/cancel` with a reason | Event: `status: 'cancelled'`, `isDeleted: true`, `isActive: false`, `currentAttendees: 0`, `cancellationReason` set | |
| TC-8.11 | Check the refund sweep | `initiateEventCancellationRefunds` returns `{ totalRefunds, successCount, failedCount }`. Each paid ticket gets a **full** `Refund` (`reason: 'event_cancelled'`), its `Payment.status → 'refunded'`, and the ticket `status → 'cancelled'` | |
| TC-8.12 | Free tickets on the cancelled event | Cancelled with no `Refund` created, counted in `successCount` | |
| TC-8.13 | Each affected buyer's notifications | "Event Cancelled - Refund Processed" with the amount | |
| TC-8.14 | Cancel the same event twice | 400 `Event is already cancelled` | |
| TC-8.15 | Force one refund to fail (e.g. a paid ticket whose payment has no `gatewayTransactionId`) | `failedCount` increments; the sweep **continues** for the rest. Event stays cancelled | |
| TC-8.16 | The cancelled event on `/events` | Gone from public listings | |
| TC-8.17 | ⚠️ `POST /api/events/:id/cancel` as a user who is **not** the organizer | The route only requires `auth`, with no organizer check. Expect any authenticated user to be able to cancel any event and trigger mass refunds. Record as broken access control | |

---

## Phase 9 — Creator listing (apply → brand page → posts → fast-track events)

| ID | Actor | Step | Expected | ✅ |
|---|---|---|---|---|
| TC-9.1 | Creator | Open `/create/creator` and submit the creator application | Application created (`VerificationRequest`), status pending | |
| TC-9.2 | Admin | `GET /api/verification?status=pending` | The request is listed | |
| TC-9.3 | — | `POST /api/verification` and `PUT /api/verification/:id/review` with **no token** | ⚠️ **KNOWN GAP — expect 200.** The whole verification router is unguarded, so anyone can approve their own verification and thus become fast-tracked. Record it | |
| TC-9.4 | Admin | Review/approve the request | User gets `isVerified: true` / a `verificationBadge`; a `BrandProfile` exists with `status: 'pending'`. Record `BRAND_ID` | |
| TC-9.5 | Admin | Admin app → Brands → approve (`PUT /api/admin/brands/:id/status` `{status:'approved'}`) | `BrandProfile.status: 'approved'` | |
| TC-9.6 | Admin | Try `{status:'banana'}` | 400 — validated against `['pending','approved','rejected','blocked']` | |
| TC-9.7 | Public | Open `/creators` and `/brands` | Only **approved** brands are listed. Pending/rejected/blocked absent | |
| TC-9.8 | Public | Open `/creators/{BRAND_ID}` | Brand page renders: profile + cover photo, bio, `type` (organizer/dj/artist/…), cities, social links, members, follower/event/view stats | |
| TC-9.9 | Creator | Fill brand details from the brand dashboard (`POST /api/brands`) | Persisted. `userId` in the body is ignored — the authenticated user is used | |
| TC-9.10 | Creator | Bio longer than 1000 chars | Rejected (`maxLength: 1000`) | |
| TC-9.11 | Creator | Create a post on the brand page (`POST /api/brands/:id/posts`) with images | 201; post appears on `/creators/{BRAND_ID}` | |
| TC-9.12 | Buyer | Post to a brand they don't own | Rejected — the route verifies brand ownership | |
| TC-9.13 | Creator | Edit the post: add / remove / replace images | All three persist correctly | |
| TC-9.14 | Buyer | Like and comment on the post; then delete the comment | Like toggles; comment added then removed | |
| TC-9.15 | Buyer | Delete someone else's post or comment | Rejected | |
| TC-9.16 | Buyer | `POST /api/brands/{BRAND_ID}/follow`, then check `/follow/status` | Follower count +1; status `true`. Unfollow reverses both | |
| TC-9.17 | Creator | Create an event now that they're verified | `adminApproval` auto-approved (fast track, TC-5.6) | |
| TC-9.18 | Buyer | After that event reaches `approved` | Follower receives `brand_new_event` in-app **and** email | |
| TC-9.19 | Public | `GET /api/brands/{BRAND_ID}/events` | Only that brand's events | |
| TC-9.20 | Public | `GET /api/brands/sections` | Homepage brand sections populated | |
| TC-9.21 | Admin | Block the brand (`{status:'blocked'}`) | Disappears from `/creators`; its events' visibility follows the event rules | |

---

## Phase 10 — Earnings visibility (before any money moves)

| ID | Actor | Step | Expected | ✅ |
|---|---|---|---|---|
| TC-10.1 | Owner | `GET /api/venues/{VENUE_ID}/earnings` | 200, per-booking breakdown for the owner's venue | |
| TC-10.2 | Buyer | Same call | 403, **and no earnings data in the body** — ownership is enforced inside `earningsService.getVenueEarnings`, not just at the route | |
| TC-10.3 | Owner | `/venue-portal/earnings` | Gross, platform commission, GST, net, and payout status per booking | |
| TC-10.4 | Creator | `GET /api/events/{EVENT_ID}/earnings` | `grossTicketSales` = Σ `Payment.totalAmount` (`status: 'success'`), `platformCommissionDeducted` = Σ `platformFee`, `gst` = Σ `gstAmount`, `netEarnings = gross − commission − gst` | |
| TC-10.5 | Creator | Cross-check against Phase 6 | With TC-6.4 alone: gross 4236, commission 200, gst 36, net **4000**. Add TC-6.10 (5295/250/45) and the totals must sum exactly — figures are read **verbatim** from stored fields, never re-derived from percentages | |
| TC-10.6 | Buyer | `GET /api/events/{EVENT_ID}/earnings` | 403, no data | |
| TC-10.7 | Creator | Earnings for an event with no sales | All zeros; `payoutStatus: 'not yet initiated'` | |
| TC-10.8 | Creator | Malformed event id | 403 (fails closed as "no data" rather than a 500 CastError) | |
| TC-10.9 | Creator | `/dashboard/creator/earnings` | Matches the API figures | |
| TC-10.10 | Buyer | `/dashboard/payments` | **Transactions** = money the buyer paid. **Earnings** = money settled to them as an owner. The two are not mixed | |

---

## Phase 11 — Settlement: payout to venue owner and organizer

This is the end of the money chain. Collection is central (Razorpay → platform account); **disbursement is manual by design** — `processPayout` records the payout but calls no disbursement gateway (`method: 'manual'`, `gatewayPayoutId: null`).

### 11A. Pre-flight

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-11.1 | Admin `GET /api/admin/venue-owners` | Owners with their venues and **masked** bank details. `accountNumberMasked` shows only the last 4 digits, preserves overall length, and keeps non-digit separators | |
| TC-11.2 | Admin `GET /api/admin/earnings/recipients` | Two sections, `event_tickets` and `venue_booking`. Each row: `grossEarnings`, `commissionDeducted`, `netPayable = gross − commission`, `owedNow`, masked `bankDetails`, `bankDetailsMissing`. `readyToPayTotal` sums `owedNow` **only** for rows with all four bank fields present | |

### 11B. Venue booking payout

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-11.3 | Admin `POST /api/payments/payouts` `{recipientId: OWNER_ID, type:'venue_booking', referenceId: BOOKING_ID, referenceModel:'Booking', grossAmount: 10000}` | 201. `platformCommission: 500`, `platformCommissionPercentage: 5`, `netAmount: 9500`, `status: 'pending'`, `method: 'manual'`, `gatewayPayoutId: null`. Record `PAYOUT_ID` | |
| TC-11.4 | Inspect `Payout.bankDetails` | A **snapshot** of the owner's account (name, number, IFSC, bank) — not a reference. Deleting the account later must not rewrite this payout's history | |

### 11C. Event ticket payout and discount attribution

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-11.5 | Admin payout for the event: `{recipientId: CREATOR_ID, type:'event_tickets', referenceId: EVENT_ID, referenceModel:'Event', grossAmount: <listedPrice sum>}` | Commission and net computed from the **event's** `platformFeePercentage` (the route resolves it from the entity, overriding any body value). Record `PAYOUT_ID` | |
| TC-11.6 | Payout for a sale that used a `discountBearer: 'platform'` code | Owner gross = **`listedPrice`** (full ₹2,000 in TC-6.23). The platform absorbs the ₹500 | |
| TC-11.7 | Payout for a sale that used a `discountBearer: 'owner'` code | Owner gross = **`listedPrice − discountAmount`** (₹1,500). The owner absorbs it | |
| TC-11.8 | Payout with no discount | Owner gross = `listedPrice` | |
| TC-11.9 | Set the event's `platformFeePercentage` to 10 and repeat TC-11.5 | Commission = `round(gross × 0.10)`. The rate comes from config, never a hardcoded 5 | |

### 11D. Payout guards — all should fail closed

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-11.10 | Payout for a recipient with **no** `bankDetails` | 400 `Recipient has no valid bank details on file; cannot process payout`. **No `Payout` row created** | |
| TC-11.11 | Recipient whose `accountNumber` is `12345` (too short) | Rejected — must match `^[0-9]{9,18}$` | |
| TC-11.12 | Recipient whose `ifscCode` is `HDFC123456` | Rejected — must match `^[A-Z]{4}0[A-Z0-9]{6}$` | |
| TC-11.13 | Buyer calls `POST /api/payments/payouts` | 403 — admin only | |
| TC-11.14 | Unauthenticated call | 401 | |

### 11E. Listing-level payout account routing

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-11.15 | Owner saves **two** bank accounts, sets `venue.payoutAccount` to the second, then admin pays out that venue's booking | `Payout.bankDetails` snapshots the **second** account — "pay this venue's earnings into a different account" actually takes effect | |
| TC-11.16 | Delete the account a venue points at, then pay out | Falls back to the owner's default (`User.bankDetails`). A deleted account degrades to "pay the default", it does not fail | |
| TC-11.17 | Venue created before `payoutAccount` existed (`payoutAccount: null`) | Uses `User.bankDetails`. No migration needed | |

### 11F. Payout lifecycle and admin visibility

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-11.18 | Admin `GET /api/admin/earnings/payouts` | Every payout, newest first. Each row always exposes `grossAmount`, `platformCommission`, `platformCommissionPercentage`, `netAmount` | |
| TC-11.19 | Filter `?status=pending` and `?status=pending,failed` | Only matching stored statuses | |
| TC-11.20 | Filter with an **empty** selection | Empty list (matches nothing), not "everything" | |
| TC-11.21 | Corrupt a payout's `status` in Mongo to `'weird'`, then list | Displayed as `'unknown'`, other fields still exposed. It is excluded from any valid-value filter | |
| TC-11.22 | Mark a payout `completed` (`processedAt` set) | Row exposes `processedAt` | |
| TC-11.23 | Mark a payout `failed` with a `failureReason` | Row exposes `failureReason` and **omits** `processedAt` | |
| TC-11.24 | Refund a Payment whose reference already has a **completed** payout | The payout row carries `refundAfterCompleted: true` — money went out and then came back, and the admin must be able to see it | |
| TC-11.25 | Admin `GET /api/payments/payouts/all` | Paginated payouts with recipient name/email | |
| TC-11.26 | Owner opens `/venue-portal/earnings` after TC-11.3 | Payout status now shows `pending` instead of "not yet initiated" | |

---

## Phase 12 — Reconciliation (do this last)

`GET /api/admin/earnings/overview` (super_admin/admin). All figures are **verbatim sums** of stored fields:

```
grossCollected           = Σ Payment.totalAmount   where status = 'success'
gstCollected             = Σ Payment.gstAmount      where status = 'success'
platformCommissionEarned = Σ Payment.platformFee    where status = 'success'
refundedTotal            = Σ Payment.amount         where status = 'refunded'
paidOut                  = Σ Payout.netAmount       where status = 'completed'
pendingPayout            = Σ Payout.netAmount       where status ∈ {pending, processing}

netPayable       = grossCollected − platformCommissionEarned − gstCollected
platformRetained = platformCommissionEarned + gstCollected
payeeAttributed  = netPayable + paidOut
residual         = grossCollected − (platformRetained + payeeAttributed + refundedTotal)
discrepancy      = |residual| > 0.01
```

| ID | Step | Expected | ✅ |
|---|---|---|---|
| TC-12.1 | Admin `GET /api/admin/earnings/overview` | Six headline figures + a `reconciliation` block | |
| TC-12.2 | Hand-total every `Payment` and `Payout` you created and compare | Exact match. No figure is re-derived from a percentage | |
| TC-12.3 | Check `reconciliation.discrepancy` | Record its value. If `true`, the residual is shown rather than hidden or silently "corrected" — that is the intended behaviour, and the residual is the number to investigate | |
| TC-12.4 | `?from=<today>&to=<today>` | The same date window is applied identically to **every** figure | |
| TC-12.5 | Invalid range (`from` after `to`, or a non-date) | Rejects with an error; **no partial or stale totals** | |
| TC-12.6 | Null out a `Payment.gstAmount` in Mongo, then reload | Fails closed with "refusing to return partial totals" rather than reporting a silently wrong number | |
| TC-12.7 | Buyer or a non-super admin calls the endpoint | 403 (`roleGuard(['super_admin','admin'])`) | |
| TC-12.8 | Admin `GET /api/admin/audit-trail` | Records the featured toggles and role changes from this run | |
| TC-12.9 | Admin `GET /api/admin/stats` | Counts line up with what you created | |

---

## Phase 13 — Cross-cutting access control sweep

Run every row **twice**: once with no `Authorization` header, once with a plain buyer token. Nothing here should return data or mutate state.

| ID | Endpoint | Should be | Actually (record) | ✅ |
|---|---|---|---|---|
| TC-13.1 | `GET /api/admin/*` (all) | 401 / 403 | | |
| TC-13.2 | `GET /api/payments` | 403 for non-admin | | |
| TC-13.3 | `GET /api/payments/refunds` | 403 for non-admin | | |
| TC-13.4 | `POST /api/payments/payouts` | 403 for non-admin | | |
| TC-13.5 | `PUT /api/bookings/:id/status` | should be owner-only | ⚠️ expect **200 unauthenticated** | |
| TC-13.6 | `GET /api/bookings` | should be admin-only | ⚠️ expect **200 unauthenticated** | |
| TC-13.7 | `GET /api/bookings/venue/:id` | should be owner/admin | ⚠️ expect **200 unauthenticated** | |
| TC-13.8 | `POST /api/bookings/:id/cancel` (someone else's booking) | should be 403 | ⚠️ expect **success** (no ownership check) | |
| TC-13.9 | `POST /api/events/:id/venue-approve` | should be owner-only | ⚠️ expect **200 unauthenticated**, `venueOwnerId` from body | |
| TC-13.10 | `POST /api/events/:id/admin-approve` | should be admin-only | ⚠️ expect **200 unauthenticated**, `adminId` from body | |
| TC-13.11 | `PUT /api/events/:id/access/:requestId` | should be organizer-only | ⚠️ expect **200 unauthenticated** | |
| TC-13.12 | `POST /api/events/:id/cancel` (not the organizer) | should be 403 | ⚠️ expect **success** — triggers mass refunds | |
| TC-13.13 | `DELETE /api/events/:id` (not the organizer) | should be 403 | ⚠️ verify — route only requires `auth` | |
| TC-13.14 | `GET /api/tickets` | should be admin-only | ⚠️ expect **200 unauthenticated** | |
| TC-13.15 | `GET /api/tickets/event/:id` | should be organizer/admin | ⚠️ expect **200** with attendee PII | |
| TC-13.16 | `POST /api/tickets/:id/validate` | should be scanner-only | ⚠️ expect **200 unauthenticated**, ticket burned | |
| TC-13.17 | `POST /api/tickets/scan` | should be scanner-authenticated | ⚠️ verify — no `auth` on the route | |
| TC-13.18 | `POST /api/verification` + `PUT /api/verification/:id/review` | should be admin-only for review | ⚠️ expect **200 unauthenticated** — self-verification possible | |
| TC-13.19 | `GET /api/verification` (all requests) | should be admin-only | ⚠️ expect **200 unauthenticated** | |
| TC-13.20 | `PUT /api/venues/:id/status` | route should not exist | 404 (it was removed deliberately) | |
| TC-13.21 | Any state-changing request without the CSRF token | Rejected by `csrfProtection`. Get one from `GET /api/v1/csrf-token` | | |
| TC-13.22 | Hammer `/api/auth/login` with wrong credentials | Rate-limited (`rateLimiters`) | | |
| TC-13.23 | Every endpoint above via `/api/v1/...` as well as `/api/...` | Identical behaviour — both are mounted from the same route table | | |

---

## Appendix A — Known gaps summary

Findings this plan expects to reproduce, grouped by severity. Each links to its test case.

### Broken access control (fix first)

| Where | What | Case |
|---|---|---|
| `POST /api/events/:id/admin-approve` | No auth; `adminId` from the request body. **An organizer can approve their own event.** | TC-5.24 |
| `POST /api/events/:id/venue-approve` | No auth; `venueOwnerId` from the request body | TC-5.17 |
| `PUT /api/bookings/:id/status` | No auth, no ownership check — anyone can accept/reject any booking | TC-3.8 |
| `POST /api/bookings/:id/cancel` | `userId` is accepted but never compared to `booking.user` | TC-4.13 |
| `POST /api/events/:id/cancel` | Any authenticated user can cancel any event and trigger mass refunds | TC-8.17 |
| `/api/verification/*` | Entire router unguarded — self-approval into verified/fast-track status | TC-9.3 |
| `POST /api/tickets/:id/validate` | No auth and no event/date/cancel checks — burns any ticket by id | TC-7.11 |
| `GET /api/bookings`, `/bookings/venue/:id`, `/tickets`, `/tickets/event/:id` | Unguarded reads leaking buyer/attendee names, emails and phones | TC-3.9, TC-6.30, TC-13.15 |

### Money and lifecycle correctness

| Where | What | Case |
|---|---|---|
| `venueService.processCancellation` | Returns a refund **percentage** only. Creates no `Refund`, calls no gateway, leaves `paymentStatus: 'paid'`, and never releases the venue's `blockedDates` slot | TC-4.8 → TC-4.11 |
| `refundService.initiateBookingRefund` | The complete implementation (refund + date release + notification) is unreachable — no route calls `bookingService.cancelBooking` | TC-4.12 |
| `refundService.calculateRefundAmount` | Called with `ticket.event.date`, a field the `Event` model does not have (`startDateTime`/`endDateTime`). `hoursUntilEvent` is `NaN`, so **every ticket refund computes 0%** regardless of timing | TC-8.1 |
| `ticketService.scanTicket` | Same nonexistent `event.date`; the event-day guard never fires, so **tickets scan on any date** | TC-7.10 |
| `ticketService.purchaseTicket` | A truthy `paymentId` is accepted without confirming the payment succeeded | TC-6.7 |
| `bookingService.createBooking` | Does not re-check `blockedDates`, so a second booking on an accepted slot may be creatable | TC-3.5b |
| `refundService.initiateTicketRefund` | Ownership check compares the ticket owner to the **admin's** id on the admin-only cancel route | TC-8.9 |

### Tooling and naming

| Where | What | Case |
|---|---|---|
| `server/seeds/*.js` | Every seed script requires model paths with a doubled final letter (`Userr`, `Venuee`, `Eventt`, `Bookingg`, `Tickett`, `BrandProfilee`, `Postt`) and crashes | §0.3 |
| `POST /api/venues/:id/cancel` | Named "cancel", actually **deletes** the venue | TC-2.18 |
| Refunds without Razorpay keys | Marked `completed` with no gateway call | TC-4.19 |
| Payout disbursement | Recorded only; no gateway call. **By design** — confirm the ops runbook covers the manual step | Phase 11 intro |

---

## Appendix B — Verification queries

```js
// mongosh — swap in the ids from your ledger

// Booking + its payment
db.bookings.findOne({ _id: ObjectId(BOOKING_ID) })
db.payments.findOne({ referenceId: ObjectId(BOOKING_ID), referenceModel: 'Booking' })

// Is the advance exactly 10% and is charged == recorded?
db.payments.aggregate([
  { $match: { referenceModel: 'Booking', referenceId: ObjectId(BOOKING_ID) } },
  { $project: { subtotal: 1, platformFee: 1, gstAmount: 1, totalAmount: 1,
                sums: { $eq: ['$totalAmount', { $add: ['$subtotal','$platformFee','$gstAmount'] }] } } }
])

// Venue blocked slots (should shrink after a cancellation — see TC-4.10)
db.venues.findOne({ _id: ObjectId(VENUE_ID) }, { blockedDates: 1, daySlots: 1 })

// Event counters never exceed capacity
db.events.aggregate([
  { $match: { _id: ObjectId(EVENT_ID) } },
  { $project: { currentAttendees: 1, maxAttendees: 1, ticketTiers: 1,
                oversold: { $gt: ['$currentAttendees', '$maxAttendees'] } } }
])

// Every payout: commission and net must hold
db.payouts.find({}, { grossAmount: 1, platformCommission: 1, netAmount: 1,
                      platformCommissionPercentage: 1, status: 1, 'bankDetails.accountNumber': 1 })

// Reconciliation, computed independently of the API
db.payments.aggregate([{ $group: { _id: '$status',
  total: { $sum: '$totalAmount' }, fee: { $sum: '$platformFee' },
  gst: { $sum: '$gstAmount' }, amount: { $sum: '$amount' } } }])
db.payouts.aggregate([{ $group: { _id: '$status', net: { $sum: '$netAmount' } } }])
```

## Appendix C — Automated coverage that already exists

Run these before manual testing; they catch regressions faster than clicking.

```bash
npm test --workspace=server          # vitest + coverage
npm run test:unit --workspace=server # unit only
npm run test:e2e                     # playwright: registration, venue-creation, event-booking
```

Existing property tests worth knowing about: `moneyInvariant.preservation`, `moneyInvariant.exploration`, `discountBearer`, `pendingApprovalVenue`, `adminPendingCompleted`, `eventVisibilityGate`, plus `*.check.mjs` self-checks next to `earningsService`, `scanTicket`, `venueUpdate`, `formatInr` and `roleUtils`.
