// @ts-check

// settlementService — the per-listing settlement ledger. It owns the ledger
// fold, the over-settlement guard, the audit write, and the admin/owner
// projections. It reads money figures through earningsService.getListingFigures
// and never recomputes money a second way (Requirement 12.1).
//
// Layout mirrors earningsService: pure helpers first (no Mongo, so the
// arithmetic is exercisable by settlementService.check.mjs and by property tests
// without a database), DB readers/writers after.
//
// This module is built method-by-method per the spec tasks. Task 3.1 adds
// buildLedger; 3.2 the guard and request validation; 3.3 the two row
// projections; 5.1–5.3 the DB methods.

const mongoose = require('mongoose');
const Settlement = require('../models/Settlement');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const earningsService = require('./earningsService');
const notificationService = require('./notificationService');
const { roundMoney } = require('../utils/money');
const { formatInr } = require('../utils/formatInr');

// Every money comparison uses the same tolerance earningsService.buildOverview
// uses for its reconciliation residual: rupee figures are stored to paise, so
// anything inside one paise is the same amount (Requirements 5.7, 12.3).
const EPSILON = 0.01;

/** @typedef {'not_settled'|'partially_settled'|'fully_settled'|'over_settled'} SettlementState */

const settlementService = {
    EPSILON,

    // --- pure ---

    /**
     * Fold a listing's settlement rows into the derived ledger figures
     * (Requirements 1.1, 1.6, 1.7, 4.2, 12.2, 12.3).
     *
     * Settled_To_Date is solely the sum of effective `settledAmount` values
     * (Requirement 12.2). A reversal row (one carrying `isReversalOf`) and the
     * row it targets both contribute zero, so the pair nets out (Requirement
     * 7.2). Skipping both rows rather than relying on the reversal's negative
     * amount cancelling its target means a stored amount that does not mirror
     * its target exactly still cannot shift the total.
     *
     * Outstanding_Amount is floored at zero, and the excess is reported
     * separately, so an over-settled listing shows ₹0 outstanding alongside a
     * distinct excess figure rather than a negative balance (Requirement 5.6).
     *
     * Fails closed on a non-finite netPayable or a non-finite `settledAmount`,
     * exactly like the existing earningsService build* helpers: a corrupt field
     * must not become a settlement basis (Requirement 12.5).
     *
     * @param {Array<{ _id?: any, settledAmount?: number, isReversalOf?: any }>} rows
     * @param {number} netPayable
     * @returns {{ settledToDate: number, outstandingAmount: number, excessAmount: number, state: SettlementState }}
     */
    buildLedger(rows, netPayable) {
        if (!Array.isArray(rows)) {
            throw new Error('settlement rows must be an array; refusing to return a partial ledger');
        }
        if (typeof netPayable !== 'number' || !Number.isFinite(netPayable)) {
            throw new Error('netPayable is missing or not a finite number; refusing to return a partial ledger');
        }

        // Which rows have been reversed. A reversal row names its target, so one
        // pass over the rows is enough to know both halves of every pair.
        const reversedTargets = new Set();
        for (const row of rows) {
            if (row && row.isReversalOf != null) reversedTargets.add(String(row.isReversalOf));
        }

        let settledToDate = 0;
        for (const row of rows) {
            if (!row) continue;
            const amount = row.settledAmount;
            if (typeof amount !== 'number' || !Number.isFinite(amount)) {
                throw new Error('settlement row "settledAmount" is missing or not a finite number; refusing to return a partial ledger');
            }
            // The reversal row itself, and the row it targets, both contribute zero.
            if (row.isReversalOf != null) continue;
            if (reversedTargets.has(String(row._id))) continue;
            settledToDate += amount;
        }

        // Rupee figures are stored to paise; rounding the running sum strips the
        // binary-float dust so two callers folding the same rows get the same
        // number (Requirement 9.9).
        settledToDate = roundMoney(settledToDate);

        // One signed gap, one classification, and both derived figures read off
        // them. Rounding `settledToDate - netPayable` on its own would report a
        // paise of excess on a ledger the state lattice calls `fully_settled`,
        // which is the same two-measure mistake as comparing against
        // `netPayable + EPSILON`: the excess IS the over-settlement (Req 5.6).
        const diff = settledToDate - netPayable;
        const state = settlementState(settledToDate, netPayable);
        const overSettled = state === 'over_settled';

        return {
            settledToDate,
            outstandingAmount: overSettled ? 0 : roundMoney(Math.max(0, -diff)),
            excessAmount: overSettled ? roundMoney(diff) : 0,
            state,
        };
    },

    /**
     * The over-settlement guard (Requirement 5). A decision only: it never
     * mutates and never touches Mongo, so the whole guard is exercisable
     * without a database.
     *
     * Three ways to be refused, each mirroring one row of the design's error
     * table, checked in this order so a rejection is unconditional on the ones
     * after it:
     *  - an override flag from anyone other than a `super_admin` → 403,
     *    whether or not the amount would actually over-settle (Req 5.4);
     *  - an override flag with a blank reason → 400 naming `overrideReason`,
     *    so an undocumented overpayment cannot be recorded (Req 5.5);
     *  - Settled_To_Date + settledAmount above Net_Payable with no honoured
     *    override → 409 carrying the figures the admin needs to correct the
     *    submission (Req 5.2).
     *
     * Exact equality is accepted with no override: settling a listing to the
     * rupee is the normal end state, not an overpayment (Requirement 5.7). The
     * comparison uses the shared EPSILON, so a paise of float dust in
     * Net_Payable cannot turn a full settlement into a rejection.
     *
     * `overrideReason` is not in the design's named signature; it is read here
     * as well as in validateEntry so that the guard's own statement — an
     * override is honoured only for a super admin with a reason — holds when
     * the guard is called on its own.
     *
     * Fails closed on a non-finite figure, exactly like buildLedger: a corrupt
     * number must not be able to wave a transfer through.
     *
     * @param {{ settledToDate: number, netPayable: number, settledAmount: number,
     *           override?: boolean, adminRole?: string, overrideReason?: string }} params
     * @returns {{ allowed: true }
     *          | { allowed: false, status: 403, code: 'override_forbidden', error: string }
     *          | { allowed: false, status: 400, code: 'invalid_override', field: 'overrideReason', error: string }
     *          | { allowed: false, status: 409, code: 'over_settlement', error: string,
     *              netPayable: number, settledToDate: number, maxRecordable: number }}
     */
    checkOverSettlement({ settledToDate, netPayable, settledAmount, override, adminRole, overrideReason }) {
        for (const [name, value] of [['settledToDate', settledToDate], ['netPayable', netPayable], ['settledAmount', settledAmount]]) {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                throw new Error(`${name} is missing or not a finite number; refusing to decide on a settlement`);
            }
        }

        if (override) {
            if (adminRole !== 'super_admin') {
                return {
                    allowed: false,
                    status: 403,
                    code: 'override_forbidden',
                    error: 'Only a super admin can override the settlement limit',
                };
            }
            if (!isFilled(overrideReason)) {
                return {
                    allowed: false,
                    status: 400,
                    code: 'invalid_override',
                    field: 'overrideReason',
                    error: 'An override reason is required to record an over-settlement',
                };
            }
            // A super admin with a reason: the excess is deliberate and documented.
            return { allowed: true };
        }

        const projected = roundMoney(settledToDate + settledAmount);
        // Same single signed measure of the gap that settlementState uses.
        // `projected > netPayable + EPSILON` is a different comparison in binary
        // floating point from `projected - netPayable > EPSILON`, and the latter
        // is the one buildLedger's excess and state are folded from — so the
        // guard must use it too, or it can wave through a transfer the ledger
        // then reports as `over_settled` with no override recorded.
        if (projected - netPayable > EPSILON) {
            const maxRecordable = roundMoney(Math.max(0, netPayable - settledToDate));
            return {
                allowed: false,
                status: 409,
                code: 'over_settlement',
                error: `Recording ₹${roundMoney(settledAmount)} would settle ₹${projected} against a net payable of ₹${roundMoney(netPayable)}. At most ₹${maxRecordable} can be recorded.`,
                netPayable: roundMoney(netPayable),
                settledToDate: roundMoney(settledToDate),
                maxRecordable,
            };
        }

        return { allowed: true };
    },

    /**
     * Field-level validation of a settlement recording request (Requirements
     * 4.7–4.9, 5.5, 6.3). A decision only — nothing is written, so a rejected
     * request provably leaves the ledger untouched (Requirement 4.11).
     *
     * Each rejection names the offending field, because the panel keeps the
     * admin's entered values and marks the one that was wrong (Requirement
     * 13.5). Only the first offending field is reported: the form has one
     * error line, and reporting the rest after the admin fixes this one is the
     * next round trip's job.
     *
     * `settledAmount` must be a positive whole number of rupees — paise are not
     * a thing a bank transfer reference reconciles against here, and the store
     * holds whole rupees (Requirements 4.6, 4.7).
     *
     * `settledAt` is rejected when it is in the future relative to `now`
     * (Requirement 4.9): a settlement is a record of a transfer that already
     * happened. `now` is a parameter rather than a `Date.now()` call so the
     * boundary is testable without freezing the clock; it defaults to the
     * current time for callers that do not care.
     *
     * @param {{ settledAmount?: any, settlementReference?: any, settledAt?: any,
     *           idempotencyKey?: any, override?: any, overrideReason?: any }} input
     * @param {Date|number} [now]
     * @returns {{ valid: true } | { valid: false, status: 400, field: string, error: string }}
     */
    validateEntry(input, now = new Date()) {
        const nowMs = now instanceof Date ? now.getTime() : Number(now);
        if (!Number.isFinite(nowMs)) {
            throw new Error('now is not a valid date; refusing to decide whether settledAt is in the future');
        }
        if (!input || typeof input !== 'object') {
            return invalid('settledAmount', 'A settlement amount, reference, date and idempotency key are required');
        }

        const { settledAmount, settlementReference, settledAt, idempotencyKey, override, overrideReason } = input;

        if (!Number.isInteger(settledAmount) || settledAmount <= 0) {
            return invalid('settledAmount', 'Settled amount must be a whole number of rupees greater than zero');
        }

        if (!isFilled(settlementReference)) {
            return invalid('settlementReference', 'A settlement reference (UTR or bank reference) is required');
        }

        const settledAtMs = parseDateMs(settledAt);
        if (settledAtMs === null) {
            return invalid('settledAt', 'A valid settlement date is required');
        }
        if (settledAtMs > nowMs) {
            return invalid('settledAt', 'Settlement date cannot be in the future');
        }

        if (!isFilled(idempotencyKey)) {
            return invalid('idempotencyKey', 'An idempotency key is required so a resubmitted transfer is recorded once');
        }

        if (override && !isFilled(overrideReason)) {
            return invalid('overrideReason', 'An override reason is required to record an over-settlement');
        }

        return { valid: true };
    },

    /**
     * The admin ledger row projection (Requirements 1.2, 1.3, 7.4). One row in,
     * one row out — ordering is the caller's read (`settledAt` descending),
     * because a projection that also sorted would be two jobs in one place.
     *
     * Everything the admin surface needs is here, including the three
     * admin-internal fields (`adminNotes`, `isOverSettlement`, `overrideReason`)
     * and the recording administrator's display name. This is the only
     * projection allowed to carry them; toOwnerRow is the wall (Requirement 9.3).
     *
     * `reversalByTarget` maps a target entry id to the reversal row that negated
     * it, so the linkage is a lookup rather than a scan per row. A row with no
     * reversal gets `reversedBy: null`, which is what the panel reads to decide
     * whether to strike the row through (Requirement 7.4).
     *
     * @param {Record<string, any>} row a Settlement row, `recordedBy` optionally populated
     * @param {Map<string, any>|Record<string, any>} [reversalByTarget] target id → reversal row
     * @returns {{ _id: string, settledAmount: number, settlementReference: string, settledAt: Date,
     *             method: string, adminNotes: string|null, recordedBy: { _id: string, name: string }|null,
     *             isOverSettlement: boolean, overrideReason: string|null, isReversalOf: string|null,
     *             reversalReason: string|null,
     *             reversedBy: { _id: string, reason: string|null, recordedBy: { name: string }|null, createdAt: Date|null }|null }}
     */
    toAdminRow(row, reversalByTarget) {
        if (!row || typeof row !== 'object') {
            throw new Error('settlement row is missing; refusing to project a partial ledger row');
        }

        const reversal = reversalFor(reversalByTarget, row._id);

        return {
            _id: String(row._id),
            settledAmount: row.settledAmount,
            settlementReference: row.settlementReference,
            settledAt: row.settledAt,
            method: row.method,
            adminNotes: row.adminNotes ?? null,
            recordedBy: personRef(row.recordedBy),
            isOverSettlement: Boolean(row.isOverSettlement),
            overrideReason: row.overrideReason ?? null,
            isReversalOf: row.isReversalOf == null ? null : String(row.isReversalOf),
            reversalReason: row.reversalReason ?? null,
            reversedBy: reversal
                ? {
                    _id: String(reversal._id),
                    reason: reversal.reversalReason ?? null,
                    recordedBy: nameRef(reversal.recordedBy),
                    createdAt: reversal.createdAt ?? null,
                }
                : null,
        };
    },

    /**
     * The owner-safe row projection (Requirements 9.2, 9.3, 9.5).
     *
     * A whitelist, not a blacklist: this builds a fresh object carrying exactly
     * `settledAmount`, `settlementReference`, `settledAt` and `reversed`, so a
     * field added to the Settlement schema later cannot leak to an owner. The
     * blacklist alternative — copy the row, delete the admin-internal keys —
     * would silently start leaking the day someone adds a field, which is
     * precisely what Property 12 asserts cannot happen.
     *
     * `reversed` is a flag rather than an omission: the owner sees that a
     * settlement was reversed, with its amount excluded from Settled_To_Date by
     * buildLedger (Requirement 9.5).
     *
     * @param {Record<string, any>} row
     * @param {Map<string, any>|Record<string, any>} [reversalByTarget] target id → reversal row
     * @returns {{ settledAmount: number, settlementReference: string, settledAt: Date, reversed: boolean }}
     */
    toOwnerRow(row, reversalByTarget) {
        if (!row || typeof row !== 'object') {
            throw new Error('settlement row is missing; refusing to project a partial ledger row');
        }

        return {
            settledAmount: row.settledAmount,
            settlementReference: row.settlementReference,
            settledAt: row.settledAt,
            reversed: reversalFor(reversalByTarget, row._id) != null,
        };
    },

    // --- DB ---

    /**
     * The admin read: Listing_Stats, the Settlement_Ledger and the derived state
     * for one listing (Requirements 1.1, 1.2, 1.3, 1.5, 2.1, 2.4, 3.1).
     *
     * Every money figure other than the three derived ones comes back verbatim
     * from earningsService.getListingFigures — there is no arithmetic here on a
     * figure the money path already reported (Requirements 2.4, 12.1).
     *
     * A listing that does not exist, or an id that could never name one, is a
     * 404 rather than an empty ledger: an empty ledger for a mistyped id reads
     * as "nothing settled yet", which is the one thing an admin about to move
     * money must not be told wrongly.
     *
     * @param {{ kind: 'event'|'venue', listingId: string }} params
     * @returns {Promise<object>} the admin DTO
     */
    async getListingSettlement({ kind, listingId } = /** @type {any} */ ({})) {
        const { listing } = await resolveListing(kind, listingId, () => fail(404, 'Listing not found'));
        const { rows, figures, reversalByTarget, ledger } = await readListingLedger(kind, listingId);

        return {
            listing,
            money: {
                ...figures.money,
                settledToDate: ledger.settledToDate,
                outstandingAmount: ledger.outstandingAmount,
                excessAmount: ledger.excessAmount,
            },
            activity: figures.activity,
            state: ledger.state,
            payout: figures.payout,
            // One row per stored entry, newest first, admin-internal fields and
            // reversal linkage included (Requirements 1.2, 1.3, 7.4).
            entries: rows.map((row) => settlementService.toAdminRow(row, reversalByTarget)),
        };
    },

    /**
     * The owner read: the same figures, projected through the owner whitelist
     * (Requirements 9.1, 9.2, 9.3, 9.9, 11.5).
     *
     * It reaches the same readListingLedger the admin read uses, so the money
     * figures and the state are the same objects folded from the same rows and
     * the same earningsService figures. Requirement 9.9 — admin and owner agree
     * on every shared figure — therefore holds by construction rather than by
     * two projections happening to round the same way.
     *
     * Ownership follows the getEventEarnings / getVenueEarnings convention: an
     * Error carrying `status = 403` that the route layer maps verbatim. A
     * malformed id, an absent listing and a listing owned by someone else are
     * all the same 403 with the same message, so a probing owner cannot learn
     * from the response that a listing exists (Requirement 11.5).
     *
     * @param {{ kind: 'event'|'venue', listingId: string, requesterId: string }} params
     * @returns {Promise<object>} the owner DTO — no adminNotes, no override
     *          reason, no administrator identity, at any depth (Requirement 9.3)
     */
    async getOwnerSettlement({ kind, listingId, requesterId } = /** @type {any} */ ({})) {
        const denied = () => fail(403, `Not authorized to view settlement for this ${kind === 'venue' ? 'venue' : 'event'}`);

        const { doc, spec, listing } = await resolveListing(kind, listingId, denied);
        if (requesterId == null || String(doc[spec.ownerField]) !== String(requesterId)) {
            throw denied();
        }

        const { rows, figures, reversalByTarget, ledger } = await readListingLedger(kind, listingId);

        return {
            listing,
            // The owner-side figures only: the buyer-side breakdown (platform fee
            // collected, GST retained) is the platform's own accounting.
            money: {
                ownerGross: figures.money.ownerGross,
                platformCommission: figures.money.platformCommission,
                netPayable: figures.money.netPayable,
                settledToDate: ledger.settledToDate,
                outstandingAmount: ledger.outstandingAmount,
                refundedTotal: figures.money.refundedTotal,
            },
            activity: figures.activity,
            state: ledger.state,
            // Effective entries only (Requirement 9.2): a reversed entry is still
            // shown, carrying `reversed: true` so the owner sees the correction
            // (Requirement 9.5), but the negative reversal row itself is not a
            // transfer the owner received and would only read as a phantom debit.
            entries: rows
                .filter((row) => row.isReversalOf == null)
                .map((row) => settlementService.toOwnerRow(row, reversalByTarget)),
        };
    },

    /**
     * Record one settlement entry against a listing (Requirements 4, 5, 6, 8, 10).
     *
     * The step order below is the whole design of this method, and each step is
     * where it is for a reason:
     *
     *  1. resolve the listing — nothing is validated, folded or written against
     *     a listing that does not exist (Requirement 4.10);
     *  2. the idempotency pre-read comes *before* validation and before the
     *     audit write, so a double-clicked or retried submission is answered
     *     from the store and leaves no spurious audit record behind (Req 6.1);
     *  3. validateEntry — a 400 naming the offending field (Req 4.7–4.9, 6.3);
     *  4-5. the money path, then the ledger folded from the stored rows;
     *  6. the over-settlement guard, against the freshly folded Settled_To_Date
     *     rather than anything the caller supplied (Req 5.2, 5.3, 5.4);
     *  7. the audit record, written *before* the entry and allowed to throw.
     *     adminService.recordAdminAction deliberately swallows audit failures —
     *     correct for its callers, wrong here, because Requirement 8.4 says no
     *     settlement may exist without an audit record. So AuditLog.create is
     *     called directly and a failure stops the operation with no entry
     *     created. The reverse order would leave an unaudited transfer, which
     *     is strictly worse for an auditor than an audit row for an attempt
     *     that then failed to insert (Requirement 4.11).
     *  8. the insert. The unique (listingKind, listing, idempotencyKey) index is
     *     the race backstop the pre-read cannot be: two concurrent submissions
     *     of the same key both miss the pre-read, and the loser's E11000 is
     *     answered by re-reading and returning the winner (Requirement 6.2).
     *  9. the notification, best-effort in a try/catch: a delivery failure keeps
     *     the entry and reports `notified: false` (Requirement 10.4), and an
     *     unresolvable Recipient_Party skips delivery entirely and reports
     *     `recipientMissing: true` (Requirement 10.5).
     * 10. the returned ledger is refolded to include the new entry, so the panel
     *     renders the updated figures without a second read (Requirement 4.2).
     *
     * There is no transaction here because the codebase has no replica-set
     * sessions to lean on (`grep startSession` → nothing); the ordering above,
     * plus the unique index, is what makes each failure mode land somewhere
     * defensible instead.
     *
     * @param {{ kind: 'event'|'venue', listingId: string,
     *           input: { settledAmount?: any, settlementReference?: any, settledAt?: any,
     *                    method?: any, adminNotes?: any, idempotencyKey?: any,
     *                    override?: any, overrideReason?: any },
     *           admin: { _id?: any, id?: any, name?: string, adminRole?: string } }} params
     * @returns {Promise<{ entry: object, ledger: { settledToDate: number, outstandingAmount: number, excessAmount: number, state: SettlementState },
     *                     state: SettlementState, notified: boolean,
     *                     recipientMissing?: true, alreadyRecorded?: true }>}
     */
    async recordEntry({ kind, listingId, input, admin } = /** @type {any} */ ({})) {
        // 1 — the listing, or a 404 carrying nothing money-shaped.
        const { spec, doc, listing } = await resolveListing(kind, listingId, () => fail(404, 'Listing not found'));

        // `recordedBy` is required on the row and is the entire point of the
        // audit record, so an unattributable request is refused here rather than
        // surfacing as a validation error after the audit write already landed.
        const adminId = admin && (admin._id != null ? admin._id : admin.id);
        if (adminId == null) throw fail(401, 'Settlement not recorded: no acting administrator');

        const request = input && typeof input === 'object' ? input : {};

        // 2 — idempotency pre-read. Answered from the store, before validation
        // and before any write (Requirement 6.1).
        if (isFilled(request.idempotencyKey)) {
            const seen = await Settlement.exists({ listingKind: kind, listing: listingId, idempotencyKey: request.idempotencyKey });
            if (seen) return await readRecorded(kind, listingId, request.idempotencyKey);
        }

        // 3 — field validation, nothing written on rejection (Requirement 4.11).
        const verdict = settlementService.validateEntry(request);
        if (!verdict.valid) throw failDecision(verdict);

        // 4-5 — the money path and the ledger it grounds, the same single read
        // both projections use, so the guard decides against exactly the
        // Settled_To_Date the admin was shown.
        const { rows, figures, ledger } = await readListingLedger(kind, listingId);

        // 6 — the over-settlement guard.
        const decision = settlementService.checkOverSettlement({
            settledToDate: ledger.settledToDate,
            netPayable: figures.money.netPayable,
            settledAmount: request.settledAmount,
            override: request.override,
            adminRole: admin.adminRole,
            overrideReason: request.overrideReason,
        });
        if (!decision.allowed) throw failDecision(decision);

        // The Recipient_Party as it stands at record time, stored on the row so
        // the transfer's counterparty is a recorded fact rather than something
        // re-derived later from a listing that may have changed hands. null when
        // the listing names no owner or that account no longer exists (Req 10.5).
        const recipient = await resolveRecipient(doc[spec.ownerField]);

        const isOverSettlement = Boolean(request.override);
        // Stored verbatim: the entry is a record of what was submitted about a
        // transfer that already happened, and nothing here may nudge it toward
        // Net_Payable (Requirements 4.1, 4.4, 4.5, 4.6, 12.4).
        const pending = {
            listingKind: kind,
            listing: listingId,
            listingModel: spec.modelName,
            recipient,
            settledAmount: request.settledAmount,
            settlementReference: request.settlementReference,
            settledAt: new Date(request.settledAt),
            method: request.method || 'manual',
            adminNotes: isFilled(request.adminNotes) ? request.adminNotes : null,
            isOverSettlement,
            overrideReason: isOverSettlement ? request.overrideReason : null,
            recordedBy: adminId,
            idempotencyKey: request.idempotencyKey,
        };

        // 7 — the audit record, before the entry, thrown rather than swallowed.
        await writeSettlementAudit({
            adminUser: adminId,
            action: 'settle',
            kind,
            listingId,
            metadata: {
                listingKind: kind,
                listingName: listing.name,
                settledAmount: pending.settledAmount,
                settlementReference: pending.settlementReference,
                settledAt: pending.settledAt,
                method: pending.method,
                isOverSettlement,
                // Req 8.3 — an overpayment's justification lives in the trail,
                // not only on the row it waved through.
                overrideReason: pending.overrideReason,
                idempotencyKey: pending.idempotencyKey,
            },
        });

        // 8 — the insert.
        let created;
        try {
            created = await Settlement.create(pending);
        } catch (cause) {
            if (isDuplicateKey(cause)) return await readRecorded(kind, listingId, pending.idempotencyKey);
            const err = fail(500, 'Settlement was not recorded');
            /** @type {any} */ (err).cause = cause;
            throw err;
        }

        const row = created.toObject();
        // 10 — refolded to include the new entry (Requirement 4.2). Pure, over
        // rows already in hand, so the updated figures cost no second read.
        const updated = settlementService.buildLedger([...rows, row], figures.money.netPayable);

        // 9 — best-effort delivery. Nothing admin-internal in the payload: no
        // notes, no override reason, no administrator identity (Req 10.3).
        const delivery = await notifyRecipient(recipient, {
            type: 'settlement_recorded',
            title: `Settlement recorded for ${listing.name}`,
            message: `${formatInr(row.settledAmount)} was settled on ${isoDate(row.settledAt)} — reference ${row.settlementReference}.`,
            data: {
                referenceId: listingId,
                referenceModel: spec.modelName,
                actionUrl: spec.ownerUrl(listing.id),
                extra: { settledToDate: updated.settledToDate, outstandingAmount: updated.outstandingAmount },
            },
        });

        return {
            // The acting admin's name is carried through from the session rather
            // than re-read, so the panel can render the new row it just created
            // without refetching the whole ledger (Requirement 4.3).
            entry: settlementService.toAdminRow({ ...row, recordedBy: { _id: adminId, name: admin.name || '' } }),
            ledger: updated,
            state: updated.state,
            ...delivery,
        };
    },

    /**
     * Reverse one recorded settlement entry (Requirements 7, 8.2, 8.4, 10.2, 10.3).
     *
     * A correction is a second row, never a mutation: the target is left exactly
     * as it was recorded and a Reversal_Entry negating it is appended
     * (Requirement 7.3). Nothing on this service updates or deletes a row, and
     * nothing here is the only place that has to hold that line — the model
     * carries no update or delete helper either.
     *
     * The same skeleton as recordEntry, with the reversal's own rejections. The
     * order below is deliberate:
     *  1. resolve the listing — a 404 carrying nothing money-shaped;
     *  2. resolve the target *scoped to this listing*, so an entry that exists
     *     but belongs to another listing is the same 404 as one that does not
     *     exist at all (Requirement 7.6). Scoping the query rather than
     *     comparing after the read means a cross-listing entryId cannot even be
     *     confirmed to exist;
     *  3. a target that is itself a Reversal_Entry → 400. Reversing a reversal
     *     would net the original back in through a row nobody reading the ledger
     *     would expect to do that (Requirement 7.8);
     *  4. a blank reason → 400 naming `reason`: an undocumented correction to a
     *     money record is the thing an auditor cannot work with (Req 7.7);
     *  5. already reversed → 409 (Requirement 7.5);
     *  6-7. the money path and the ledger, for the refold and the notification's
     *     updated Settled_To_Date;
     *  8. the audit record, before the insert and allowed to throw — Requirement
     *     8.4's "no settlement exists without its audit record" covers the
     *     reversal too, and a reversal is the row an auditor is most likely to
     *     be asking about;
     *  9. the insert. `idempotencyKey` is derived as `reversal:<targetId>`, so
     *     the unique (listingKind, listing, idempotencyKey) index makes a second
     *     reversal of the same entry impossible at the store as well as at the
     *     guard in step 5 — two concurrent requests both miss that guard, and
     *     the loser's E11000 is answered as "already reversed" rather than as a
     *     500, which is the same answer the guard would have given (Req 7.5);
     * 10. the notification, best-effort, carrying the reversal and the updated
     *     Settled_To_Date and nothing admin-internal — in particular not the
     *     reversal reason, which is written for an auditor, not for the owner
     *     (Requirements 10.2, 10.3).
     *
     * @param {{ kind: 'event'|'venue', listingId: string, entryId: string, reason: string,
     *           admin: { _id?: any, id?: any, name?: string, adminRole?: string } }} params
     * @returns {Promise<{ entry: object, ledger: { settledToDate: number, outstandingAmount: number, excessAmount: number, state: SettlementState },
     *                     state: SettlementState, notified: boolean, recipientMissing?: true }>}
     */
    async recordReversal({ kind, listingId, entryId, reason, admin } = /** @type {any} */ ({})) {
        // 1 — the listing.
        const { spec, doc, listing } = await resolveListing(kind, listingId, () => fail(404, 'Listing not found'));

        const adminId = admin && (admin._id != null ? admin._id : admin.id);
        if (adminId == null) throw fail(401, 'Reversal not recorded: no acting administrator');

        // 2 — the target, scoped to this listing (Requirement 7.6).
        const notFound = () => fail(404, 'Settlement entry not found');
        if (!mongoose.isValidObjectId(entryId)) throw notFound();
        const target = await Settlement.findOne({ _id: entryId, listingKind: kind, listing: listingId }).lean();
        if (!target) throw notFound();

        // 3 — a reversal is not itself reversible (Requirement 7.8).
        if (target.isReversalOf != null) {
            throw failDecision({
                status: 400,
                field: 'entryId',
                code: 'not_reversible',
                error: 'A reversal entry cannot itself be reversed',
            });
        }

        // 4 — the reason (Requirement 7.7). A whitespace-only reason is as absent
        // as a missing one, the same reading isFilled gives every other reason field.
        if (!isFilled(reason)) {
            throw failDecision({
                status: 400,
                field: 'reason',
                error: 'A reversal reason is required',
            });
        }

        // 5 — already reversed (Requirement 7.5). One indexed lookup, through the
        // `(isReversalOf)` index the model carries for exactly this question.
        if (await Settlement.exists({ listingKind: kind, listing: listingId, isReversalOf: target._id })) {
            throw failDecision({
                status: 409,
                code: 'already_reversed',
                error: 'This settlement entry has already been reversed',
            });
        }

        // 6-7 — the money path and the ledger, the same single read the
        // projections use.
        const { rows, figures } = await readListingLedger(kind, listingId);

        const recipient = await resolveRecipient(doc[spec.ownerField]);

        // The reversal row. It mirrors the target's reference and date so the
        // pair reads as one correction of one transfer rather than as a second,
        // unrelated movement on a different day. buildLedger nets the pair out
        // by linkage rather than by arithmetic, so the negative amount is the
        // record of what was undone, not the mechanism (Requirement 7.2).
        const pending = {
            listingKind: kind,
            listing: listingId,
            listingModel: spec.modelName,
            recipient,
            settledAmount: -target.settledAmount,
            settlementReference: target.settlementReference,
            settledAt: target.settledAt,
            method: target.method,
            isReversalOf: target._id,
            reversalReason: reason,
            recordedBy: adminId,
            // Derived, not supplied: one reversal per entry, enforced by the
            // unique index (Requirement 7.5).
            idempotencyKey: `reversal:${String(target._id)}`,
        };

        // 8 — the audit record, before the row it describes (Requirement 8.2).
        await writeSettlementAudit({
            adminUser: adminId,
            action: 'reverse',
            kind,
            listingId,
            metadata: {
                listingKind: kind,
                listingName: listing.name,
                reversedEntryId: String(target._id),
                reversalReason: reason,
                settledAmount: pending.settledAmount,
                settlementReference: pending.settlementReference,
                settledAt: pending.settledAt,
                idempotencyKey: pending.idempotencyKey,
            },
        });

        // 9 — the insert.
        let created;
        try {
            created = await Settlement.create(pending);
        } catch (cause) {
            if (isDuplicateKey(cause)) {
                throw failDecision({
                    status: 409,
                    code: 'already_reversed',
                    error: 'This settlement entry has already been reversed',
                });
            }
            const err = fail(500, 'Reversal was not recorded');
            /** @type {any} */ (err).cause = cause;
            throw err;
        }

        const row = created.toObject();
        const updated = settlementService.buildLedger([...rows, row], figures.money.netPayable);

        // 10 — best-effort delivery: the reversal and the updated Settled_To_Date,
        // no reason, no notes, no administrator identity (Requirements 10.2, 10.3).
        const delivery = await notifyRecipient(recipient, {
            type: 'settlement_reversed',
            title: `Settlement reversed for ${listing.name}`,
            message: `A previously recorded settlement of ${formatInr(target.settledAmount)} dated ${isoDate(target.settledAt)} was reversed. Settled to date is now ${formatInr(updated.settledToDate)}.`,
            data: {
                referenceId: listingId,
                referenceModel: spec.modelName,
                actionUrl: spec.ownerUrl(listing.id),
                extra: { settledToDate: updated.settledToDate, outstandingAmount: updated.outstandingAmount },
            },
        });

        return {
            entry: settlementService.toAdminRow({ ...row, recordedBy: { _id: adminId, name: admin.name || '' } }),
            ledger: updated,
            state: updated.state,
            ...delivery,
        };
    },
};

// What each listing kind is, in one place: the model to resolve it through, the
// field naming its Recipient_Party, and the refPath value a Settlement row
// stores. The write methods (tasks 5.2, 5.3) read `modelName` from here too.
// `ownerUrl` is the existing owner surface the notification deep-links to — the
// two pages the Owner_Settlement_View mounts on. No new route is introduced.
const LISTING_KINDS = {
    event: { model: Event, modelName: 'Event', ownerField: 'organizer', ownerUrl: (/** @type {string} */ id) => `/dashboard/creator/earnings?event=${id}` },
    venue: { model: Venue, modelName: 'Venue', ownerField: 'owner', ownerUrl: (/** @type {string} */ id) => `/dashboard/venues/${id}` },
};

/**
 * An Error carrying `status`, so the route layer maps it verbatim with the
 * existing `res.status(error.status || 500).json({ error: error.message })`
 * convention — the same shape getEventEarnings throws.
 *
 * @param {number} status
 * @param {string} message
 * @returns {Error}
 */
function fail(status, message) {
    const err = new Error(message);
    /** @type {any} */ (err).status = status;
    return err;
}

/**
 * Resolve a listing to `{ kind, id, name }` plus the raw document, or throw.
 *
 * `notFound` builds the rejection, because the same absent listing must be
 * answered differently on the two surfaces: 404 for an admin who mistyped an id,
 * 403 for an owner who must not learn whether the listing exists at all
 * (Requirement 11.5). A malformed id is rejected before any query, so a
 * CastError never surfaces as a 500 — the same posture as getEventEarnings.
 *
 * @param {string} kind
 * @param {any} listingId
 * @param {() => Error} notFound
 * @returns {Promise<{ spec: { model: any, modelName: string, ownerField: string, ownerUrl: (id: string) => string }, doc: any, listing: { kind: string, id: string, name: string } }>}
 */
async function resolveListing(kind, listingId, notFound) {
    const spec = Object.prototype.hasOwnProperty.call(LISTING_KINDS, kind) ? LISTING_KINDS[kind] : null;
    if (!spec) throw notFound();
    if (!mongoose.isValidObjectId(listingId)) throw notFound();

    const doc = await spec.model.findById(listingId).select(`name ${spec.ownerField}`).lean();
    if (!doc) throw notFound();

    return { spec, doc, listing: { kind, id: String(doc._id), name: doc.name || '' } };
}

/**
 * The one read both projections share: the listing's rows newest-first, the
 * money figures, the reversal index, and the single buildLedger result.
 *
 * Rows are read through the `(listingKind, listing, settledAt: -1)` index, so
 * "newest first" is the index order rather than an in-memory sort. The reversal
 * index is built in one pass — a reversal row names its target, so one sweep
 * knows both halves of every pair, and neither projection has to scan.
 *
 * @param {string} kind
 * @param {any} listingId
 * @returns {Promise<{ rows: any[], figures: any, reversalByTarget: Map<string, any>,
 *                     ledger: { settledToDate: number, outstandingAmount: number, excessAmount: number, state: SettlementState } }>}
 */
async function readListingLedger(kind, listingId) {
    const [rows, figures] = await Promise.all([
        Settlement.find({ listingKind: kind, listing: listingId })
            .sort({ settledAt: -1 })
            .populate('recordedBy', 'name')
            .lean(),
        readFigures(kind, listingId),
    ]);

    const reversalByTarget = new Map();
    for (const row of rows) {
        if (row.isReversalOf != null) reversalByTarget.set(String(row.isReversalOf), row);
    }

    return {
        rows,
        figures,
        reversalByTarget,
        ledger: settlementService.buildLedger(rows, figures.money.netPayable),
    };
}

/**
 * The money path, with its failure named (Requirement 12.5). earningsService
 * fails closed rather than returning a zeroed figure set, so anything it throws
 * means "the figures for this listing are unavailable" — a 502, not a 500, and
 * not a ledger rendered against an assumed ₹0 net payable. Nothing money-shaped
 * is attached to the rejection, so no surface can render a figure from it.
 *
 * @param {string} kind
 * @param {any} listingId
 * @returns {Promise<any>}
 */
async function readFigures(kind, listingId) {
    try {
        return await earningsService.getListingFigures({ kind, listingId });
    } catch (cause) {
        const err = fail(502, `Earnings figures unavailable for listing ${String(listingId)}`);
        /** @type {any} */ (err).cause = cause;
        throw err;
    }
}

/**
 * The answer to a submission whose transfer is already on the ledger — the
 * idempotency pre-read hit, or the losing half of a race the unique index
 * settled (Requirements 6.1, 6.2).
 *
 * The full ledger is re-read rather than just the one row, so the caller gets
 * the same shape a fresh recording returns and the panel has nothing to
 * special-case beyond the `alreadyRecorded` flag. `notified: false` is the
 * literal truth about *this* call: the original submission sent the
 * notification, and re-sending it would tell the owner twice about one transfer.
 *
 * @param {string} kind
 * @param {any} listingId
 * @param {string} idempotencyKey
 * @returns {Promise<{ entry: object, ledger: any, state: SettlementState, notified: false, alreadyRecorded: true }>}
 */
async function readRecorded(kind, listingId, idempotencyKey) {
    const { rows, reversalByTarget, ledger } = await readListingLedger(kind, listingId);
    const row = rows.find((candidate) => candidate.idempotencyKey === idempotencyKey);
    // Only reachable if the row vanished between the two reads, which the
    // append-only surface makes impossible — reported rather than returned as a
    // ledger with no entry in it.
    if (!row) throw fail(500, 'Settlement was not recorded');

    return {
        entry: settlementService.toAdminRow(row, reversalByTarget),
        ledger,
        state: ledger.state,
        notified: false,
        alreadyRecorded: true,
    };
}

/**
 * The Recipient_Party for a listing, or null when there is none to resolve
 * (Requirement 10.5).
 *
 * "Unresolvable" covers a listing with no owner field set, an owner id that
 * could never name a user, and an owner whose account has since been deleted —
 * all three mean there is nobody to notify, and a stored `recipient` pointing at
 * a deleted account would read as a resolvable one later.
 *
 * @param {any} ownerId
 * @returns {Promise<any|null>}
 */
async function resolveRecipient(ownerId) {
    if (ownerId == null || !mongoose.isValidObjectId(ownerId)) return null;
    const owner = await User.exists({ _id: ownerId });
    return owner ? ownerId : null;
}

/**
 * The audit record for a settlement action, written before the entry it
 * describes and allowed to stop the operation (Requirements 8.1, 8.3, 8.4).
 *
 * This is the one place in the service that talks to AuditLog, and it does so
 * directly rather than through adminService.recordAdminAction: that helper logs
 * and swallows a failed write, which is right when the change it describes has
 * already been committed and wrong here, where the change has not happened yet
 * and must not.
 *
 * @param {{ adminUser: any, action: 'settle'|'reverse', kind: string, listingId: any, metadata: object }} params
 * @returns {Promise<void>}
 */
async function writeSettlementAudit({ adminUser, action, kind, listingId, metadata }) {
    try {
        await AuditLog.create({ adminUser, action, entityType: kind, entityId: listingId, metadata });
    } catch (cause) {
        const err = fail(500, 'Settlement not recorded: audit write failed');
        /** @type {any} */ (err).cause = cause;
        throw err;
    }
}

/**
 * Best-effort delivery of a Settlement_Notification (Requirements 10.1, 10.4,
 * 10.5).
 *
 * A delivery failure is caught and reported as a flag, never rethrown: the money
 * has already moved and the entry is already stored, so failing the recording
 * over an undelivered message would invite a retry that the idempotency key
 * would then refuse anyway. `recipientMissing` is only present when it is true,
 * so a caller reads its absence as "there was someone to notify".
 *
 * @param {any} recipient
 * @param {{ type: string, title: string, message: string, data: object }} payload
 * @returns {Promise<{ notified: boolean, recipientMissing?: true }>}
 */
async function notifyRecipient(recipient, payload) {
    if (recipient == null) return { notified: false, recipientMissing: true };
    try {
        // 'all' rather than 'in_app': money movement is worth a push, and
        // createNotification's push dispatch is itself fire-and-forget.
        await notificationService.createNotification({ userId: recipient, channel: 'all', ...payload });
        return { notified: true };
    } catch (cause) {
        console.error('Settlement notification failed:', cause instanceof Error ? cause.message : cause);
        return { notified: false };
    }
}

/**
 * A rejection from one of the pure decision helpers, as the Error the route layer
 * already knows how to map. `field` and `code` ride along so the panel can mark
 * the offending input and recognise an over-settlement, and the over-settlement
 * figures ride along so the admin is told what *can* be recorded (Req 5.2).
 *
 * @param {any} decision
 * @returns {Error}
 */
function failDecision(decision) {
    const err = /** @type {any} */ (fail(decision.status || 400, decision.error));
    if (decision.field) err.field = decision.field;
    if (decision.code) err.code = decision.code;
    if (decision.code === 'over_settlement') {
        err.netPayable = decision.netPayable;
        err.settledToDate = decision.settledToDate;
        err.maxRecordable = decision.maxRecordable;
    }
    return err;
}

/**
 * Whether a failed write was the unique index refusing a duplicate
 * (listingKind, listing, idempotencyKey) — the race backstop behind the
 * idempotency pre-read (Requirement 6.2).
 *
 * @param {any} err
 * @returns {boolean}
 */
function isDuplicateKey(err) {
    return Boolean(err) && (err.code === 11000 || (err.cause != null && err.cause.code === 11000));
}

/**
 * The calendar date of a settlement, as `YYYY-MM-DD`. Absolute and unambiguous
 * in a message the owner reads days later, and locale-independent so the string
 * does not depend on the server's ICU data.
 *
 * @param {Date} value
 * @returns {string}
 */
function isoDate(value) {
    return new Date(value).toISOString().slice(0, 10);
}

/**
 * The reversal row that negated `targetId`, or null. Accepts a Map (what the DB
 * layer builds in one pass over the rows) or a plain object, so a caller with
 * either shape reads the same answer.
 *
 * @param {Map<string, any>|Record<string, any>|undefined|null} reversalByTarget
 * @param {any} targetId
 * @returns {any|null}
 */
function reversalFor(reversalByTarget, targetId) {
    if (!reversalByTarget || targetId == null) return null;
    const key = String(targetId);
    const found = reversalByTarget instanceof Map
        ? reversalByTarget.get(key)
        : Object.prototype.hasOwnProperty.call(reversalByTarget, key) ? reversalByTarget[key] : undefined;
    return found || null;
}

/**
 * `{ _id, name }` for an administrator reference, whether it arrives populated
 * or as a bare ObjectId. Name falls back to '' rather than being omitted, the
 * same way earningsService projects a recipient with no user record, so the
 * admin surface always has the key to render (Requirement 1.2).
 *
 * @param {any} value
 * @returns {{ _id: string, name: string }|null}
 */
function personRef(value) {
    if (value == null) return null;
    const isRef = typeof value === 'object';
    // A populated document carries `_id`; a bare ObjectId reads `_id` as itself,
    // so one expression covers both without importing mongoose into a pure module.
    return {
        _id: String(isRef && value._id != null ? value._id : value),
        name: isRef && typeof value.name === 'string' ? value.name : '',
    };
}

/**
 * The name half of an administrator reference — what a reversal linkage carries
 * (the reverser's display name, not their identity for onward use).
 *
 * @param {any} value
 * @returns {{ name: string }|null}
 */
function nameRef(value) {
    const ref = personRef(value);
    return ref ? { name: ref.name } : null;
}

/**
 * A supplied string that carries something once trimmed. A whitespace-only
 * reference or reason is as absent as a missing one (Requirements 4.8, 5.5, 6.3).
 *
 * @param {any} value
 * @returns {boolean}
 */
function isFilled(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Milliseconds for a Date, an ISO string, or an epoch number; null when the
 * value is absent or unparseable (Requirement 4.9). A `Date` carrying NaN — what
 * `new Date('nonsense')` produces — is unparseable, not a date.
 *
 * @param {any} value
 * @returns {number|null}
 */
function parseDateMs(value) {
    if (value == null || value === '') return null;
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {string} field
 * @param {string} error
 * @returns {{ valid: false, status: 400, field: string, error: string }}
 */
function invalid(field, error) {
    return { valid: false, status: 400, field, error };
}

/**
 * The Settlement_State lattice, every comparison inside EPSILON.
 *
 * Zero is checked first so a listing whose only entries have all been reversed
 * reads as `not_settled` (Requirement 1.6), and so a listing with no payout due
 * and nothing settled is not reported as `fully_settled` (Requirement 1.7).
 * Exact equality with Net_Payable is `fully_settled`, not `over_settled`
 * (Requirement 5.7).
 *
 * @param {number} settledToDate
 * @param {number} netPayable
 * @returns {SettlementState}
 */
function settlementState(settledToDate, netPayable) {
    if (Math.abs(settledToDate) <= EPSILON) return 'not_settled';
    // One signed measure of the gap for all three comparisons. `settledToDate >
    // netPayable + EPSILON` and `Math.abs(settledToDate - netPayable) <= EPSILON`
    // are not complementary in binary floating point, so measuring the gap two
    // ways lets a one-paise overshoot fall through both branches and be
    // misclassified as `partially_settled`.
    const diff = settledToDate - netPayable;
    if (diff > EPSILON) return 'over_settled';
    if (Math.abs(diff) <= EPSILON) return 'fully_settled';
    return 'partially_settled';
}

module.exports = settlementService;
