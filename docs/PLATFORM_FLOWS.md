# FIRA — Platform Flows

This document describes the end-to-end flows for the FIRA platform, grounded in
the actual server services (`bookingService`, `ticketService`, `paymentService`,
`eventService`, `adminService`) and the client apps (`client/` for users/owners,
`admin/` for platform admins).

## Actors

| Actor | App | Description |
|-------|-----|-------------|
| **Normal User** | `client/` | Books venues, buys event tickets, submits inquiries. |
| **Venue Owner** | `client/` (venue-portal) | Lists venues, approves event requests, receives booking settlements. |
| **Creator / Organizer** | `client/` (brand + create/event) | Applies as a creator, gets a brand page, posts, creates events, receives ticket settlements. |
| **Admin** | `admin/` | Approves venues/events/brands, collects money via Razorpay, settles owners via bank details. |

## Money model (single source of truth)

All money math runs through **`paymentService.calculateBilling(price, qty, feePct, discount)`**, so what the buyer is charged equals what is recorded:

```
subtotal           = price × qty
discountedSubtotal = max(0, subtotal − discountAmount)
platformFee        = round(discountedSubtotal × platformFeePercentage / 100)   // feePct config, default 5
gstAmount          = round(platformFee × 0.18)                                 // 18% GST on the fee
totalAmount        = discountedSubtotal + platformFee + gstAmount              // what Razorpay charges
```

- **Collection**: Razorpay collects the **full `totalAmount`** into the platform account. There is no Razorpay Route/split.
- **Settlement**: the platform pays owners **manually** via captured bank details (`paymentService.processPayout`), recording gross, commission, and net. `method: 'manual'`, `gatewayPayoutId: null` — disbursement is done by an admin, by design.
- **Discount attribution** (`discountBearer`): `platform` → owner keeps the full listed price; `owner` → the discount is deducted from the owner's settlement. Payout gross is derived from `Payment.listedPrice`, not the discounted amount the buyer paid.
- **Payout guard**: `processPayout` fails closed if the recipient has no valid bank details (`accountNumber` 9–18 digits, IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`).

---

## Flow 1 — Venue lifecycle: creation → admin approval → booking → payment → settlement

### 1a. Venue creation (Venue Owner)
1. Owner signs in to the venue portal (`/venue-portal`).
2. Owner creates a venue via the stepper form (`venue-portal/venues/create`): basic info → location (maps link, URL-validated client + server) → capacity & pricing → images → **payout bank details** (saved to `User.bankDetails`).
3. Venue is created with `status: 'pending'`.

### 1b. Admin approval (Admin)
1. Admin sees the venue under pending venues (`adminService.getVenues({ status: 'pending' })`).
2. Admin approves/rejects (`adminService.updateVenueStatus(venueId, 'approved' | 'rejected')`).
3. Only `approved` + `isActive` venues appear in the public venue listing.

### 1c. User booking request (Normal User)
1. User browses `/venues`, opens a venue, and requests a booking (date, time, expected guests, purpose).
2. `bookingService.createBooking` creates the booking:
   - If the venue has `autoApproveBookings`, status → `accepted` immediately; otherwise `pending`.
   - Owner is notified (email + in-app + push → `/dashboard/requests`); booker gets a WhatsApp confirmation if a phone is on file.

### 1d. Owner accepts/rejects (Venue Owner)
1. Owner reviews the request in `/dashboard/requests`.
2. `bookingService.updateBookingStatus`:
   - **Accepted** → the booked date/time is added to the venue's `blockedDates` (prevents double-booking); booker notified "Booking confirmed".
   - **Rejected** → booker notified with the reason.

### 1e. Advance payment via Razorpay (Normal User → Platform)
1. For an accepted booking, the user pays a **10% advance** (`bookingService.initiateBookingPayment`).
2. The advance is routed through `calculateBilling(advance, 1, feePct)` — advance is the subtotal, qty 1 — so **charged == recorded**. Fails closed before any Razorpay order if billing throws.
3. `paymentService.initiatePayment` creates a Razorpay order + a `Payment` record (`type: 'venue_booking'`, `status: 'pending'`); the booking's `platformFee` is saved.
4. Client opens Razorpay checkout; on success, `bookingService.completeBookingPayment` verifies the signature (`paymentService.verifyPayment`), sets `paymentStatus: 'paid'`, `status: 'accepted'`, and links the `Payment`.
5. The remaining 90% is settled with the owner off-platform on the booking date (per the Refund & Cancellation policy).

### 1f. Settlement to the venue owner (Admin → Venue Owner)
1. Admin views venue owners and their stored bank details (`adminService.getVenueOwners` — admin-only read).
2. Admin triggers a payout (`paymentService.processPayout`) for the settled booking:
   - `grossAmount` derived from the settled `Payment` (full listed price per the discount-bearer contract).
   - `platformCommission = round(gross × feePct/100)`, `netAmount = gross − commission`.
   - Payout recorded with the owner's `bankDetails`, `method: 'manual'`, `status: 'pending'`.
3. Admin disburses the net to the owner's bank account manually and marks the payout done.

```
Venue Owner ──create venue──▶ (pending)
Admin ──approve──▶ (approved, listed publicly)
User ──request booking──▶ Owner ──accept──▶ blockedDates updated
User ──pay 10% advance (Razorpay)──▶ Platform account
Admin ──processPayout (bank details)──▶ Venue Owner (manual net disbursement)
```

---

## Flow 2 — Event lifecycle: creation → approvals → listing → ticket purchase → issuing → settlement

### 2a. Event creation (Creator / Organizer)
1. Signed-in user creates an event via the stepper (`/create/event`): basic info → date/time & venue (existing venue OR custom venue) → tickets & privacy (free/paid, tiers, discount setup entry point) → additional options (F&F stay, alcohol, **owner payout bank details**).
2. `eventService.createEvent`:
   - Rejects past start dates and end-before-start; checks the venue for time-slot conflicts.
   - **Custom venue** (`isCustom`) → venue side auto-approved (`venueApproval.status: 'approved'`).
   - **Tagged/verified organizer** → admin side auto-approved (fast-track); if the venue is also approved, the whole event goes straight to `approved`.
   - Otherwise the event is created `pending`.
   - For a non-custom venue, the venue owner is emailed the event request.

### 2b. Venue owner approval (Venue Owner)
1. Owner reviews event requests for their venues (`eventService.getVenueEventRequests`, surfaced in `/venue-portal/events`).
2. `eventService.venueApproveEvent`:
   - **Rejected** → event `status: 'rejected'`, organizer notified.
   - **Approved** and admin already approved → event `status: 'approved'`, venue availability updated, a backing booking created.

### 2c. Admin approval (Admin)
1. Admin reviews events pending admin approval (`eventService.getPendingAdminApproval` — venue-less events are excluded from the pending count).
2. `eventService.adminApproveEvent`:
   - **Rejected** → `status: 'rejected'`, organizer notified.
   - **Approved** and venue approved (or no venue owner to approve) → `status: 'approved'`, venue availability updated, backing booking created, and **brand followers notified** if the organizer has a brand page.

### 2d. Event listing (Public)
- Only `status: 'approved'`, `isActive`, not-yet-ended, public events appear in `/events` (`eventService.getAllEvents` / `getUpcomingEvents`).
- Private events are resolvable by link only after admin approval; the owner can always see their own.

### 2e. Ticket purchase via Razorpay (Normal User → Platform)
1. User opens an approved event and selects a tier (or general admission) and quantity.
   - Quantity is capped at remaining seats / tier remaining (never oversells at checkout).
2. `ticketService.purchaseTicket` / `purchaseTicketByTier`:
   - **Price is the source of truth**: any `ticketPrice > 0` requires payment, regardless of the `ticketType` flag (fails closed against giving away paid inventory).
   - Any discount code is **re-validated server-side** (`discountService.validateAndApplyDiscount`) — a client-supplied amount is never trusted; invalid/expired/exhausted codes reject the purchase before any charge.
   - Paid path → `requirePaymentFor` runs `calculateBilling` then `paymentService.initiatePayment` (`type: 'ticket'`), passing the full breakdown + `discountBearer` + `listedPrice`. Returns `{ paymentRequired: true, paymentData }` **before** reserving seats.
3. Client opens Razorpay; on success it verifies the payment, then calls purchase again **with the `paymentId`** to actually issue the ticket.

### 2f. Ticket issuing (Platform → Normal User)
1. Seats are **atomically reserved** (`findOneAndUpdate` conditional on remaining capacity / tier `soldCount`) so the last seat is sold exactly once.
2. A `Ticket` is created with a unique `ticketId` and a **QR code**; if issuing fails, the reserved seats are released.
3. Buyer notified "Ticket confirmed 🎟️"; organizer notified "Ticket sold".
4. At the event, staff scan the QR (`ticketService.scanTicket`): validates event match, not-already-used, not cancelled, and date window; marks the ticket `used`.

### 2g. Settlement to the event owner (Admin → Creator/Organizer)
1. Admin views the event and its ticket revenue (`adminService.getEventById` — includes organizer `bankDetails`, admin-only read).
2. Admin triggers `paymentService.processPayout` for the settled ticket payments:
   - Gross from `Payment.listedPrice` per the discount-bearer contract (owner-absorbed discounts reduce the owner's gross; platform-absorbed discounts do not).
   - Commission + net computed; payout recorded against the organizer's `bankDetails`, `method: 'manual'`.
3. Admin disburses the net to the organizer's bank account manually.

```
Creator ──create event──▶ (pending)
Venue Owner ──approve venue side──▶  ┐
Admin ──approve admin side──────────▶ (approved → listed)
User ──buy ticket (Razorpay, discount re-validated)──▶ Platform account
Platform ──atomic reserve + issue QR ticket──▶ User
Admin ──processPayout (bank details)──▶ Creator/Organizer (manual net disbursement)
```

---

## Flow 3 — Creator application: apply → brand page → brand details → post & create events

1. A normal user **applies as a creator** (verification/brand application).
2. On approval, the user gets a **brand page** (`BrandProfile`, `status: 'pending'` → admin-approved).
3. The creator fills **brand details** (bio, socials, cover/profile photos, cities) via the brand dashboard.
4. With an approved brand the creator can:
   - **Post** to the brand page (`/creators/[id]` / `/brands/[id]` — image add/remove/replace supported).
   - **Create events** (Flow 2). If verified/tagged, their events are **admin fast-tracked** on creation.
   - Reach followers automatically: when a fast-tracked/approved event goes live, `notificationService.notifyBrandFollowers` alerts everyone following the brand (in-app + email).

```
User ──apply as creator──▶ Admin approves ──▶ Brand page (pending → approved)
Creator ──fill brand details──▶ Creator ──post / create events──▶ Followers notified
```

---

## Flow 4 — Normal user flow (summary)

1. Sign up / sign in.
2. Browse venues (`/venues`) and events (`/events`); filter with a draft-state filter that fires a single API call on "Show Results".
3. **Book a venue**: request → owner accepts → pay 10% advance via Razorpay → settle remainder at the venue (Flow 1c–1e).
4. **Buy event tickets**: select tier + quantity → pay via Razorpay (discount re-validated) → receive QR ticket (Flow 2e–2f).
5. **Ask a question**: submit an inquiry on a venue/event; if signed in, it opens an in-app conversation bound to that inquiry (chat is bound to the inquiry reference).
6. Manage everything in the dashboard: **My Bookings**, **My Tickets**, **Payments** (Transactions = money paid; Earnings = money settled to them as an owner), **Settings** (change password, delete account → `DELETE /api/users/me`).

---

## Flow 5 — Venue owner flow (summary)

1. Sign in to the venue portal.
2. List venues (Flow 1a) and keep payout **bank details** current in Settings.
3. Review and **approve/reject booking requests** and **event requests** for their venues.
4. Receive **manual settlements** from the platform to their bank account (Flow 1f / 2g).
5. A user can hold **both roles** (normal user + venue owner); a dashboard switcher moves between the user dashboard and the "Fira Venue" owner dashboard.

---

## Flow 6 — Admin coordination (the hub for every money + approval path)

The admin app is the coordination point where approvals gate visibility and where all money is collected and settled.

| Responsibility | Service call |
|----------------|--------------|
| Approve/reject **venues** | `adminService.updateVenueStatus` |
| Approve/reject **events** (admin side) | `eventService.adminApproveEvent` |
| Approve/reject **brands** | `adminService.updateBrandStatus` |
| Block/unblock **users** | `adminService.blockUser` / `unblockUser` |
| Feature events | `adminService.toggleFeatured` (audit-logged) |
| See owners + **bank details** for settlement | `adminService.getVenueOwners`, `getVenueById`, `getEventById` (admin-only reads) |
| **Collect** money | Razorpay collects full `totalAmount` into the platform account (all `Payment`s) |
| **Settle** owners | `paymentService.processPayout` → records gross/commission/net against `bankDetails`, then manual bank disbursement |
| Audit trail | `adminService.getAuditTrail` |

### Coordination invariants
- **Approval gates visibility**: a venue/event is only publicly listed once admin-approved (and, for events, venue-approved).
- **Money is collected centrally, settled manually**: Razorpay → platform account; platform → owner via captured bank details. No automatic split.
- **Charged == recorded**: every charge flows through `calculateBilling`, so the buyer's total matches the stored `Payment`.
- **Fail closed on trust boundaries**: server re-validates discounts; payouts require valid bank details; paid inventory is never issued without a verified payment; seats are reserved atomically.

---

## End-to-end coordination diagram

```
                         ┌───────────────────────── ADMIN (hub) ─────────────────────────┐
                         │  approvals · Razorpay collection · manual bank settlement       │
                         └───────▲───────────────▲───────────────▲───────────────▲─────────┘
                                 │ approve venue  │ approve event │ settle owner  │ settle owner
                                 │                │               │ (bank)        │ (bank)
   VENUE OWNER ──list venue──────┘                │               │               │
      ▲                                           │               │               │
      │ approve booking/event request             │               │               │
      │                                    CREATOR/ORGANIZER ──create event────────┘
      │                                           ▲
   NORMAL USER ──book venue (10% advance, Razorpay)┤
              └──buy ticket (Razorpay, QR issued)──┘
```

---

## Notes & known boundaries

- Payout **disbursement is manual** by design; `processPayout` records the payout but does not call a disbursement gateway.
- Two long-standing, unrelated TypeScript errors exist in the event create/edit pages (`tiers[i].maxQuantity` `string | number` comparison) and predate the flow work.
- Chat/messaging is **bound to inquiries** and re-enabled across the app (Navbar, inbox, brand/creator pages).
