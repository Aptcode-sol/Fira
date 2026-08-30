# Design Document

## Overview

This feature adds the first write path over money records in the platform: an append-only per-listing settlement ledger, plus the per-listing statistics representation that justifies each settlement, mirrored read-only to the listing owner.

The shape of the change is deliberately narrow:

| Layer | Change |
| --- | --- |
| Data | One new model, `server/models/Settlement.js`. Two enum values added to `AuditLog.action`, two to `Notification.type`. |
| Money | One new method on the existing `server/services/earningsService.js` — `getListingFigures` — so there is still exactly one place money is read. |
| Logic | One new service, `server/services/settlementService.js`, split into pure helpers + DB readers/writers exactly like `earningsService`. |
| API | Three admin routes appended to the existing `EARNINGS & PAYOUTS` section of `server/routes/admin.js`, plus one owner GET each on `routes/event.js` and `routes/venue.js` beside the existing `/earnings` routes. |
| Admin UI | One new component, `admin/src/components/ListingSettlementPanel.jsx`, mounted on `EventDetail.jsx` and `VenueDetail.jsx`. Three methods on `adminApi`. |
| Client UI | One new component, `client/src/components/dashboard/SettlementSummary.tsx`, mounted on the existing organizer earnings page and owner venue detail page. One `settlementApi` block in `client/src/lib/api.ts`. |

Nothing computes money a second way, no existing surface is replaced, and no listing page is created that does not already exist.

## Architecture

Three layers, one money path. `settlementService` is the only new decision-making layer; it reads money through `earningsService` and owns the ledger, the guard, the audit write, and the two projections.

```
Payment / Payout records (written elsewhere: paymentService)
        │  verbatim sums, no re-derivation
        ▼
earningsService.getListingFigures({ kind, listingId })   ← the only money path
        │  { money: {...}, activity: {...} }
        ▼
settlementService
        ├── getListingSettlement()  → figures + ledger + state       (admin)
        ├── getOwnerSettlement()    → owner-safe projection          (owner)
        ├── recordEntry()           → audit → Settlement → notify
        └── recordReversal()        → audit → Settlement → notify
        │
        ├──► admin.js  /admin/listings/:kind/:id/settlement[/entries]
        └──► event.js / venue.js  /:id/settlement (GET only)
```

## Design Decisions

### 1. Net_Payable comes from `Payout` records, not from a percentage

Requirement 12.1 forbids re-deriving money from percentages, and the glossary pins Platform_Commission to `Payout.platformCommission` and Net_Payable to `Payout.netAmount`. `paymentService.processPayout` is the only writer of those fields, and it takes `grossAmount` from its caller and applies the configured commission once.

So the owner-side figures for a listing are verbatim sums over that listing's `Payout` records:

- event listing → `Payout { referenceModel: 'Event', referenceId: <eventId> }`
- venue listing → `Payout { referenceModel: 'Booking', referenceId: ∈ that venue's bookings }`

**Consequence, stated plainly:** a listing that has collected payments but has no `Payout` record yet has `Net_Payable = ₹0`. The panel renders that as "Payout not initiated — nothing to settle yet", the submit control is disabled, and a submitted request is rejected by the over-settlement guard with `maxRecordable: 0` (Requirements 1.7, 5.2). This is correct behavior for the platform as it stands: money is owed once a payout has been raised, and settlement records the transfer of that payout. The alternative — inventing a commission for a listing that has no payout record — is exactly the second computation path Requirement 12.1 forbids.

`earningsService.computePayeeGross` already exists and encodes the discount-bearer owner-gross contract. It is left where it is and not used as a second Net_Payable source.

### 2. Rupee units and the comparison epsilon

`settledAmount` is stored as a whole number of rupees (Requirement 4.6). Recorded `Payout` figures go through `roundMoney` (2 decimals), so `Net_Payable` may carry paise. Comparisons therefore use the same `0.01` tolerance `earningsService.buildOverview` already uses for its reconciliation residual:

```js
const EPSILON = 0.01;   // one paisa — same tolerance as earningsService reconciliation
```

`Outstanding_Amount` and `Settled_To_Date` are computed once, in one function, and handed unchanged to both the admin and the owner projection — which is what makes Requirement 9.9 hold by construction rather than by coincidence.

### 3. `formatInr` is reused verbatim — note the wording conflict

Requirement 12.6 asks for "no fractional portion, matching the existing `formatInr` helpers". The three existing helpers (`server/utils/formatInr.js`, `admin/src/lib/formatInr.js`, `client/src/lib/formatInr.ts`) pin both fraction digits at 2, so `₹5,000.00`. Those two clauses cannot both hold.

Decision: **reuse the existing helpers unchanged.** A settlement figure that renders differently from the same amount on the Payouts page would be worse than a `.00` suffix, and forking the formatter would create the divergence Requirement 12.6 exists to prevent. Integer-rupee settlement amounts render as `₹5,000.00`. Flagged here rather than silently resolved.

### 4. Audit record is written before the settlement entry

`adminService.recordAdminAction` deliberately swallows audit failures — correct for its callers, wrong here: Requirement 8.4 says no settlement may exist without an audit record. `settlementService` therefore calls `AuditLog.create` directly and lets it throw.

Ordering: **idempotency pre-read → validation → guard → audit write → settlement insert → notify.**

- A duplicate submission is answered from the pre-read, so a retry never writes a spurious audit record.
- If the audit write fails, no entry is created (Requirement 8.4).
- If the insert then fails, the audit record stands as evidence of an attempt and the ledger is unchanged (Requirement 4.11). An audit row for an attempt is strictly better for an auditor than an unaudited transfer, and the codebase has no replica-set transactions to lean on (`grep startSession` → nothing).
- The unique `(listingKind, listing, idempotencyKey)` index is the race backstop: on `E11000` the service re-reads and returns the existing entry (Requirement 6.1).

### 5. Correction is a second row, never a mutation

There is no update and no delete route or service method for a `Settlement`. `isReversalOf` on a new row is the only correction mechanism, and `Settled_To_Date` skips both members of a reversed pair (Requirement 7.2). The append-only guarantee is a property of the API surface, not of a code comment.

### 6. Where the UI goes (no new pages)

Admin: `EventDetail.jsx` and `VenueDetail.jsx` already fetch one listing and render metric cards. Both mount the same `<ListingSettlementPanel kind="event|venue" listingId={id} />`.

Owner: the surfaces already exist and are already linked.

- events → `client/src/app/dashboard/creator/earnings/page.tsx` (already scoped to one event via `?event=`)
- venues → `client/src/app/dashboard/venues/[id]/page.tsx` (already the click-through target of `venue-portal/earnings`)

Both mount the same `<SettlementSummary kind listingId />`.

`getAdminRoleFromToken` currently lives inside `AdminDashboardLayout.jsx`. It moves to `admin/src/lib/adminRole.js` and both the layout and the panel import it — one function, two callers, no copy.

## Data Models

`server/models/Settlement.js` — one collection, append-only.

```js
const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
    // --- what was settled ---
    listingKind: { type: String, enum: ['event', 'venue'], required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'listingModel' },
    listingModel: { type: String, enum: ['Event', 'Venue'], required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // resolved owner at record time; null when unresolvable (Req 10.5)

    // --- the recorded fact about the transfer ---
    settledAmount: { type: Number, required: true },        // whole rupees; negative on a reversal row
    settlementReference: { type: String, required: true },  // UTR / bank reference
    settledAt: { type: Date, required: true },
    method: { type: String, enum: ['manual', 'gateway'], default: 'manual' },

    // --- admin-internal (never leaves the admin surface) ---
    adminNotes: { type: String, default: null },
    isOverSettlement: { type: Boolean, default: false },
    overrideReason: { type: String, default: null },

    // --- correction linkage ---
    isReversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null },
    reversalReason: { type: String, default: null },

    // --- provenance ---
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, required: true },
}, { timestamps: true });

// Req 6.2 — one transfer per (listing, key), enforced by the store, not by the caller.
settlementSchema.index({ listingKind: 1, listing: 1, idempotencyKey: 1 }, { unique: true });
// Req 1.3 — the ledger is always read newest-first for one listing.
settlementSchema.index({ listingKind: 1, listing: 1, settledAt: -1 });
// Req 7.5 — "is this entry already reversed?" is a single indexed lookup.
settlementSchema.index({ isReversalOf: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);
```

A reversal row reuses `settlementReference` and `settledAt` from its target and carries `settledAmount = -target.settledAmount`, so the collection stays a flat list of signed facts. `idempotencyKey` on a reversal is derived (`reversal:<targetId>`), which makes double reversal impossible at the store level as well as at the guard level.

### Enum additions

```js
// server/models/AuditLog.js — action
enum: ['approve', 'reject', 'block', 'unblock', 'feature', 'unfeature', 'delete', 'update',
       'settle', 'reverse']

// server/models/Notification.js — type
'settlement_recorded', 'settlement_reversed'
```

Both files carry comments explaining that a missing enum value means a silently unrecorded action; adding the values rather than overloading `update` keeps the audit surface able to filter money movement, which is the whole point of Requirement 8.5.

## Components and Interfaces

### `earningsService.getListingFigures({ kind, listingId })`

The single money path, extended per listing. Reads only. No ownership check — callers own authorization.

```js
/**
 * Per-listing money + activity figures. Money is summed verbatim from recorded
 * Payment/Payout fields; nothing is re-derived from a percentage (Req 12.1).
 *
 * Buyer side  ← Payment (status 'success' / 'refunded')
 * Owner side  ← Payout  (every payout referencing this listing)
 *
 * @param {{ kind: 'event'|'venue', listingId: string }} params
 * @returns {Promise<{ money: ListingMoney, activity: ListingActivity, payout: PayoutSummary|null }>}
 * @throws when the listing does not exist, the id is malformed, or any sum is non-finite
 */
```

```js
/** @typedef {{
 *   grossCollected: number,        // Σ Payment.totalAmount   (success)
 *   platformFeeCollected: number,  // Σ Payment.platformFee    (success)
 *   gstRetained: number,           // Σ Payment.gstAmount      (success)
 *   ownerGross: number,            // Σ Payout.grossAmount
 *   platformCommission: number,    // Σ Payout.platformCommission
 *   netPayable: number,            // Σ Payout.netAmount
 *   refundedTotal: number,         // Σ Payment.totalAmount    (refunded)
 * }} ListingMoney */

/** @typedef {{
 *   successfulPayments: number,
 *   unitsSold: number,             // Σ Ticket.quantity | count(Booking)
 *   confirmed: number,             // Ticket.status ∈ {active,used} | Booking.status ∈ {accepted,completed}
 *   cancelled: number,             // Ticket.status 'cancelled'     | Booking.status ∈ {cancelled,rejected}
 *   refundedPayments: number,
 *   lastPaymentAt: Date|null,      // max Payment.paidAt (success); null when none (Req 3.4)
 * }} ListingActivity */

/** @typedef {{ payoutId: string, status: string, netAmount: number }} PayoutSummary */
```

Scoping, mirroring the existing `getEventEarnings` / `getVenueEarnings` reads:

| kind | Payment scope | Payout scope | Activity source |
| --- | --- | --- | --- |
| `event` | `referenceModel: 'Event', referenceId: eventId` | `referenceModel: 'Event', referenceId: eventId` | `Ticket { event: eventId }` |
| `venue` | `referenceModel: 'Booking', referenceId: ∈ bookingIds` | `referenceModel: 'Booking', referenceId: ∈ bookingIds` | `Booking { venue: venueId }` |

Fails closed on a non-finite sum, exactly like the existing `build*` helpers, so a corrupt field never becomes a settlement basis (Requirement 12.5).

### `settlementService`

Pure helpers first (no Mongo), DB methods after — the same split `earningsService` uses, so the arithmetic can be exercised by a `.check.mjs` and by property tests without a database.

```js
// --- pure ---

/**
 * Fold a listing's rows into the derived ledger figures (Req 12.2, 12.3).
 * A reversal row and its target both contribute zero: the pair nets out.
 * @param {Settlement[]} rows
 * @param {number} netPayable
 * @returns {{ settledToDate: number, outstandingAmount: number, excessAmount: number,
 *             state: 'not_settled'|'partially_settled'|'fully_settled'|'over_settled' }}
 */
buildLedger(rows, netPayable)

/**
 * Over-settlement guard (Req 5). Returns the decision, never mutates.
 * @returns {{ allowed: true } | { allowed: false, code: 'over_settlement', netPayable, settledToDate, maxRecordable }}
 */
checkOverSettlement({ settledToDate, netPayable, settledAmount, override, adminRole })

/** Field-level validation of a recording request (Req 4.7–4.9, 6.3, 5.5). */
validateEntry(input, now)

/** Admin ledger row projection, newest-first (Req 1.2, 1.3, 7.4). */
toAdminRow(row, reversalByTarget)

/**
 * Owner-safe projection (Req 9.3). Whitelist, not blacklist: only the four
 * named keys are ever emitted, so a field added to the schema later cannot leak.
 * @returns {{ settledAmount: number, settlementReference: string, settledAt: Date, reversed: boolean }}
 */
toOwnerRow(row, reversalByTarget)

// --- DB ---

getListingSettlement({ kind, listingId })              // Req 1, 2, 3
getOwnerSettlement({ kind, listingId, requesterId })   // Req 9, 11.5
recordEntry({ kind, listingId, input, admin })         // Req 4, 5, 6, 8, 10
recordReversal({ kind, listingId, entryId, reason, admin }) // Req 7, 8, 10
```

`recordEntry` sequence:

```
1. resolve listing (404 if absent/malformed)                      Req 4.10
2. existing = Settlement.findOne({ listing, idempotencyKey })
   → if found: return { entry: toAdminRow(existing), alreadyRecorded: true }   Req 6.1
3. validateEntry → 400 with the offending field name               Req 4.7–4.9, 6.3
4. figures = earningsService.getListingFigures(...)  (throws → 502 naming the listing)  Req 12.5
5. ledger = buildLedger(rows, figures.money.netPayable)
6. checkOverSettlement → 409 over_settlement | 403 override-not-super_admin   Req 5.2, 5.4
7. AuditLog.create({ action: 'settle', ... })  → throws ⇒ stop, no entry      Req 8.4
8. Settlement.create({...})  (E11000 ⇒ re-read and return existing)           Req 6.2
9. notificationService.createNotification(...) in try/catch → notified flag   Req 10.1, 10.4, 10.5
10. return { entry, ledger: buildLedger(rows + entry, netPayable), notified }  Req 4.2
```

`recordReversal` follows the same skeleton with its own rejections: target missing or belonging to another listing → 404 (7.6), target already reversed → 409 (7.5), target is itself a reversal → 400 (7.8), empty reason → 400 (7.7).

### HTTP API

Admin — appended to the existing `EARNINGS & PAYOUTS` section of `server/routes/admin.js`, which already sits behind `router.use(adminAuth)`:

```js
router.get('/listings/:kind/:id/settlement',
    roleGuard(['super_admin', 'admin']), handler);                       // Req 11.1
router.post('/listings/:kind/:id/settlement/entries',
    roleGuard(['super_admin', 'admin']), validate(entrySchema), handler); // Req 11.2
router.post('/listings/:kind/:id/settlement/entries/:entryId/reversal',
    roleGuard(['super_admin', 'admin']), validate(reversalSchema), handler);
```

Owner — GET only, beside the existing `/earnings` route in each file, ownership enforced inside the service exactly as `getEventEarnings` does today:

```js
// server/routes/event.js
router.get('/:id/settlement', auth, handler);          // 403 for non-organizer, no figures
// server/routes/venue.js
router.get('/:id/settlement', requireAuth(), handler); // 403 for non-owner, no figures
```

Request body (zod via the existing `validate` middleware, so a malformed body never reaches the service):

```js
const entrySchema = z.object({
    settledAmount: z.number().int().positive(),
    settlementReference: z.string().trim().min(1),
    settledAt: z.coerce.date(),
    method: z.enum(['manual', 'gateway']).optional(),
    adminNotes: z.string().trim().optional(),
    idempotencyKey: z.string().trim().min(1),
    override: z.boolean().optional(),
    overrideReason: z.string().trim().optional(),
});
```

Admin response DTO:

```js
{
  listing: { kind: 'event', id: '...', name: 'Sunburn Arena' },
  money: { grossCollected, platformFeeCollected, gstRetained,
           ownerGross, platformCommission, netPayable, refundedTotal,
           settledToDate, outstandingAmount, excessAmount },
  activity: { successfulPayments, unitsSold, confirmed, cancelled, refundedPayments, lastPaymentAt },
  state: 'partially_settled',
  payout: { payoutId, status, netAmount } | null,
  entries: [ { _id, settledAmount, settlementReference, settledAt, method, adminNotes,
               recordedBy: { _id, name }, isOverSettlement, overrideReason,
               isReversalOf, reversedBy: { _id, reason, recordedBy: { name }, createdAt } | null } ]
}
```

Owner response DTO — the whitelist, and nothing else:

```js
{
  listing: { kind, id, name },
  money: { ownerGross, platformCommission, netPayable, settledToDate, outstandingAmount, refundedTotal },
  activity: { ... same six figures ... },
  state: 'partially_settled',
  entries: [ { settledAmount, settlementReference, settledAt, reversed } ]
}
```

### Admin UI — `admin/src/components/ListingSettlementPanel.jsx`

```jsx
<ListingSettlementPanel kind="event" listingId={id} />
```

- Four view states, mutually exclusive: `loading | ready | empty | error` — the pattern `client/dashboard/creator/earnings` already uses (Requirement 13.1).
- Money block: buyer-side group (Gross collected, Platform fee collected, GST retained) and owner-side group (Owner gross, Platform commission, Net payable, Settled to date, Outstanding) as two labeled groups (Requirement 2.3). `kind === 'venue'` labels gross as "Advance collected" (2.5).
- State badge reusing the existing badge classes from `EventDetail.jsx`; `over_settled` adds an "Excess settled" figure and pins Outstanding at ₹0 (5.6).
- Activity block: six counts plus the absolute last-payment date via the existing `formatDateTime` helper, or "No payments yet" (3.4).
- Ledger table, newest first, reversed rows struck through with reason + reverser + timestamp (7.4).
- Record form (amount, reference, date, method, notes) with `idempotencyKey` generated once per form session via `crypto.randomUUID()`; the submit button is disabled while in flight (6.4). On rejection the entered values stay put and the ledger is untouched (13.5). On an `alreadyRecorded` response the panel shows "Already recorded" (6.5).
- Hidden entirely for `adminRole === 'moderator'` using the extracted `getAdminRole()` (11.3) — the server guard is the boundary, this is just not showing a control that would 403.
- All amounts through `formatInr` from `admin/src/lib/formatInr.js`.

`adminApi` additions:

```js
getListingSettlement(kind, listingId)
recordSettlement(kind, listingId, body)
reverseSettlement(kind, listingId, entryId, reason)
```

### Client UI — `client/src/components/dashboard/SettlementSummary.tsx`

Read-only. No form, no button that writes (Requirement 9.6). Same four view states with a retry control (13.3, 13.4), three headline figures plus state and history, reversed rows marked and excluded from the total, `formatInr` for every amount. Mounted on the organizer earnings page and the owner venue detail page. `settlementApi` in `client/src/lib/api.ts`:

```ts
export const settlementApi = {
    getEventSettlement: (eventId: string) => request<OwnerSettlementDTO>(`/events/${eventId}/settlement`),
    getVenueSettlement: (venueId: string) => request<OwnerSettlementDTO>(`/venues/${venueId}/settlement`),
};
```

## Error Handling

| Condition | Status | Body | Side effect |
| --- | --- | --- | --- |
| Malformed / unknown listing | 404 | `{ error: 'Listing not found' }` | none (4.10) |
| Bad `settledAmount` / reference / date / idempotency key | 400 | `{ error, field }` | none (4.7–4.9, 6.3) |
| Would over-settle, no override | 409 | `{ error, code: 'over_settlement', netPayable, settledToDate, maxRecordable }` | none (5.2) |
| Override by non-super_admin | 403 | `{ error: 'Only a super admin can override the settlement limit' }` | none (5.4) |
| Override without reason | 400 | `{ error, field: 'overrideReason' }` | none (5.5) |
| Duplicate idempotency key | 200 | existing entry + `alreadyRecorded: true` | none (6.1) |
| Reversal target absent / other listing | 404 | `{ error }` | none (7.6) |
| Target already reversed | 409 | `{ error }` | none (7.5) |
| Target is a reversal | 400 | `{ error }` | none (7.8) |
| Audit write fails | 500 | `{ error: 'Settlement not recorded: audit write failed' }` | no entry (8.4) |
| Insert fails after audit | 500 | `{ error: 'Settlement was not recorded' }` | ledger unchanged (4.11) |
| Notification fails | 200 | entry + `notified: false` | entry retained (10.4) |
| No resolvable recipient | 200 | entry + `notified: false, recipientMissing: true` | entry retained (10.5) |
| Figures unavailable | 502 | `{ error: 'Earnings figures unavailable for listing <id>' }` | no entry, no figures (12.5) |
| Moderator / no session | 403 / 401 | `{ error }` | nothing written (11.3, 11.4, 11.6) |
| Owner requests a listing they do not own | 403 | `{ error }` | no figures (11.5) |

Route handlers use the existing `res.status(error.status || 500).json({ error: error.message })` style, with service errors carrying `status` — the same convention as `getEventEarnings`.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Ledger conservation

For any listing, any recorded Net_Payable, and any sequence of settlement and reversal rows, Settled_To_Date equals the sum of the effective rows' `settledAmount`, Outstanding_Amount equals `Net_Payable − Settled_To_Date` floored at zero, and when the state is not `over_settled`, Settled_To_Date plus Outstanding_Amount equals Net_Payable within one paisa.

**Validates: Requirements 1.1, 1.6, 1.7, 4.2, 12.2, 12.3**

### Property 2: Settlement state is a total classification

For any Settled_To_Date and Net_Payable pair, exactly one Settlement_State is returned — `not_settled` when nothing is settled, `partially_settled` below Net_Payable, `fully_settled` at Net_Payable, `over_settled` above it — and in the `over_settled` case the reported excess equals `Settled_To_Date − Net_Payable` while Outstanding_Amount is zero.

**Validates: Requirements 1.1, 5.6, 5.7**

### Property 3: Reversal is the inverse of recording

For any listing ledger and any effective entry in it, recording an entry and then reversing it returns Settled_To_Date to the value it held before that entry was recorded, and the reversed pair contributes zero to every subsequent read.

**Validates: Requirements 7.1, 7.2, 9.5**

### Property 4: A recorded settlement is an untouched whole-rupee fact

For any accepted settlement recording request, reading the ledger back yields exactly one new entry whose `settledAmount` is the whole-rupee value submitted, whose `settlementReference`, `settledAt`, `method` (defaulting to `manual` when absent) and `adminNotes` match the submission, and whose `recordedBy` is the submitting administrator — and that stored amount is never adjusted toward Net_Payable by any later read or write.

**Validates: Requirements 4.1, 4.4, 4.5, 4.6, 12.4**

### Property 5: The over-settlement guard is exact

For any Net_Payable, any current Settled_To_Date, and any requested `settledAmount`, the request is accepted without an override if and only if `Settled_To_Date + settledAmount` does not exceed Net_Payable; otherwise it is accepted only when the requester is a `super_admin` supplying a non-empty override reason, in which case the created entry is flagged as an over-settlement and stores that reason, and in every rejected case no entry is created and the rejection reports Net_Payable, Settled_To_Date, and the maximum recordable amount.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7**

### Property 6: Recording is idempotent in the Idempotency_Key

For any settlement recording request and any number of repeated submissions of it, exactly one Settlement_Entry exists for that listing and key, every submission returns that same entry, and Settled_To_Date is identical to the value after a single submission.

**Validates: Requirements 6.1, 6.2**

### Property 7: An invalid request changes nothing

For any settlement recording request carrying an absent, non-integer, or non-positive `settledAmount`, a blank or absent `settlementReference`, an absent, unparseable, or future `settledAt`, or an absent Idempotency_Key, the request is rejected with an error naming the offending field, no Settlement_Entry is created, and the listing's ledger is byte-identical to its state before the request.

**Validates: Requirements 4.7, 4.8, 4.9, 6.3**

### Property 8: An invalid reversal changes nothing

For any reversal request naming an entry that is already reversed, does not exist, belongs to a different listing, or is itself a Reversal_Entry, or carrying a blank reason, the request is rejected and the listing's ledger is byte-identical to its state before the request.

**Validates: Requirements 7.5, 7.6, 7.7, 7.8**

### Property 9: The ledger is append-only

For any listing and any sequence of settlement, reversal, and read operations, every previously stored Settlement_Entry is unchanged afterward, and the service exposes no operation that edits or deletes a Settlement_Entry.

**Validates: Requirements 7.3**

### Property 10: Money figures are reproduced verbatim from Earnings_Service

For any set of figures Earnings_Service returns for a listing, every money figure the Settlement_Service reports other than Settled_To_Date, Outstanding_Amount, and the excess equals the Earnings_Service value exactly, with no arithmetic re-derivation; and when Earnings_Service cannot produce figures for a listing, the service returns an error naming that listing, reports no money figures, and rejects any settlement recording request for it.

**Validates: Requirements 2.1, 2.4, 12.1, 12.5**

### Property 11: The admin ledger projection is complete and ordered

For any listing ledger, the admin read returns one row per stored entry, each carrying `settledAmount`, `settlementReference`, `settledAt`, `method`, `adminNotes`, the recording administrator's display name, and its reversal linkage, ordered by `settledAt` descending.

**Validates: Requirements 1.2, 1.3, 7.4**

### Property 12: No admin-internal data reaches an owner

For any listing ledger, no owner-facing settlement response and no Settlement_Notification payload contains `adminNotes`, an override reason, the recording administrator's identity, or Recipient_Party bank details, at any depth.

**Validates: Requirements 9.3, 10.3**

### Property 13: Admin and owner agree on every shared figure

For any listing, every money figure present in both the admin and the owner response holds the same value, and the owner response carries the owner-side figures and all six activity counts.

**Validates: Requirements 9.1, 9.2, 9.9**

### Property 14: No settlement exists without its audit record

For any sequence of accepted settlement and reversal operations, including ones whose audit write fails, every stored Settlement_Entry has exactly one matching Audit_Log record carrying the acting administrator, the action, the listing kind and identifier, the amount, the settlement reference or reversed entry identifier with its reason, any override reason, and the action timestamp; and no entry exists whose audit record is missing.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 15: Every recorded action notifies the owner, and delivery never rolls it back

For any accepted settlement or reversal on a listing with a resolvable Recipient_Party, exactly one Settlement_Notification is sent to that party naming the listing and, for a settlement, the amount, date, and reference, or, for a reversal, the reversal and the updated Settled_To_Date; and for any delivery failure the entry remains stored and the operation still reports success.

**Validates: Requirements 10.1, 10.2, 10.4**

### Property 16: Unauthorized requests are rejected and write nothing

For any settlement read or write request whose session is absent or whose Admin_Role is `moderator`, the request is rejected, no money or settlement figures appear in the response, and every `Payment`, `Payout`, and Settlement_Entry record is unchanged.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.6**

### Property 17: Owner reads are confined to owned listings

For any authenticated user and any listing, the owner settlement response returns figures if and only if that user is the listing's Recipient_Party; every other pairing is rejected with no money or settlement figures.

**Validates: Requirements 11.5, 9.1**

### Property 18: Activity counts match the underlying records

For any set of payment, ticket, and booking records for a listing, the reported count of successful payments, units sold, confirmed units, cancelled units, and refunded payments each equal the count over those records, and the reported last payment timestamp equals the latest successful payment's timestamp, or is absent when there is none.

**Validates: Requirements 3.1, 3.4**

### Property 19: Exactly one surface state is shown

For any retrieval outcome and any transition between outcomes, the settlement surfaces render exactly one of a loading, empty, error, or populated indication, and no money figure is rendered while in the loading or error state.

**Validates: Requirements 13.1, 13.2, 13.3**

### Property 20: A rejected submission preserves the form and the ledger

For any values entered into the settlement form and any rejection returned for them, the surface displays the returned error message, every entered value remains in its field, and the displayed Settlement_Ledger is unchanged.

**Validates: Requirements 13.5, 4.11**

## Testing Strategy

Existing tooling, no new dependency: `vitest` + `fast-check` + `mongodb-memory-server` under `server/__tests__/` (the pattern in `moneyInvariant.preservation.property.test.ts`), and assert-based `*.check.mjs` files beside the source for pure logic (the pattern in `earningsService.check.mjs`).

**Property tests** (≥100 iterations each, tagged `Feature: per-listing-settlement-tracking, Property N: <text>`):

- Properties 1–5, 7, 8 run against the pure helpers (`buildLedger`, `checkOverSettlement`, `validateEntry`) with no database — cheap, so generators cover the empty ledger, exact-equality, over-settlement, whitespace-only strings, fractional amounts, and future dates.
- Properties 6, 9, 14, 15 run against an in-memory Mongo instance because they are statements about the store and its unique index; the audit and notification sinks are stubbed and made to fail at random.
- Properties 10, 13, 18 stub `earningsService.getListingFigures` with generated figures, which is what makes "verbatim" checkable at all.
- Properties 12, 16, 17 use `supertest` over the real routers with generated role and ownership pairings and sentinel `adminNotes` values, asserting on the serialized response body.
- Properties 19, 20 are the two UI properties; they drive the panel's state reducer directly rather than the DOM, so the state machine is exercised without a renderer.

**Example / integration tests** (1–3 cases each, not property tests): panel and owner-view rendering of labels, groups, badges, and empty states; the venue advance label; `formatInr` output equality; audit trail rendering of the two new action types; the disabled-while-in-flight and already-recorded indications; the no-resolvable-recipient branch; and the insert-fails-after-audit branch.

**Ponytail checks** (the one runnable check per piece of non-trivial logic): `server/services/settlementService.check.mjs` asserting the ledger fold, the reversal net-out, the state lattice at its boundaries, and the guard's accept/reject split — runnable with plain `node`, no framework.
