// @ts-check

// earningsService — the single read-only aggregator for the payout/earnings
// surfaces (admin dashboard, event-organizer view, venue-owner view). It reads
// recorded Payment/Payout rupee fields (to paise, 2 decimals) verbatim and never
// recomputes money a second way. It sits alongside paymentService (which owns the writes:
// calculateBilling / processPayout) and duplicates none of that math.
//
// This module is built method-by-method per the spec tasks. Task 1.3 adds the
// shared status constants and the pure computePayeeGross attribution helper;
// task 2.1 adds the admin overview aggregation.

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const User = require('../models/User');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const { roundMoney } = require('../utils/money');

// --- Shared status constants (single source of truth for "what counts") ---
// "Paid"/"collected" is stored as Payment.status === 'success' (there is no
// paymentStatus field on Payment; see design research finding 1). Payout uses a
// separate lifecycle vocabulary.
const PAID = 'success';                       // Payment.status → collected
const REFUNDED = 'refunded';                  // Payment.status → returned to buyer
const PENDING_PAYOUT = ['pending', 'processing']; // Payout.status → owed, not yet paid
const COMPLETED_PAYOUT = 'completed';         // Payout.status → disbursed
// The complete, valid Payout.status vocabulary; a stored status outside this set
// (absent/corrupt) is surfaced as 'unknown' for display (Requirement 3.5).
const VALID_PAYOUT_STATUSES = [...PENDING_PAYOUT, COMPLETED_PAYOUT, 'failed'];

// What "confirmed" and "cancelled" mean per listing kind (per-listing-settlement
// -tracking design, ListingActivity). Kept beside the payment/payout vocabulary
// so "what counts" stays in one place.
const TICKET_CONFIRMED = ['active', 'used'];
const TICKET_CANCELLED = ['cancelled'];
const BOOKING_CONFIRMED = ['accepted', 'completed'];
const BOOKING_CANCELLED = ['cancelled', 'rejected'];

const MASK_CHAR = '*';                         // character shown in place of a hidden digit

// Per-listing figure shapes (per-listing-settlement-tracking design). Money is
// verbatim sums of recorded fields; nothing here is derived from a percentage.
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
 *   lastPaymentAt: Date|null,      // max Payment.paidAt (success); null when none
 * }} ListingActivity */

/** @typedef {{ payoutId: string, status: string, netAmount: number }} PayoutSummary */

const earningsService = {
    PAID,
    REFUNDED,
    PENDING_PAYOUT,
    COMPLETED_PAYOUT,

    /**
     * Mask a bank account number for display, preserving only the last four
     * characters (Requirement 2.5 / 11.5, design Property 6). Every digit that
     * precedes the last four is replaced with MASK_CHAR; non-digit separators
     * (spaces, dashes) that precede the last four are preserved, and the last
     * four characters are preserved unchanged. Overall length is preserved.
     *
     * Trust-boundary input validation: a non-string, null, undefined, or empty
     * value yields '' rather than throwing or leaking a raw value. A string of
     * length <= 4 has nothing preceding the visible tail, so it is returned
     * unchanged.
     *
     * @param {unknown} accountNumber
     * @returns {string}
     */
    maskAccountNumber(accountNumber) {
        if (typeof accountNumber !== 'string' || accountNumber.length === 0) {
            return '';
        }
        if (accountNumber.length <= 4) {
            return accountNumber;
        }
        const visible = accountNumber.slice(-4);
        const masked = accountNumber.slice(0, -4).replace(/\d/g, MASK_CHAR);
        return masked + visible;
    },

    /**
     * Compute a single Payment's payee-side gross, applying discount
     * attribution that mirrors the processPayout owner-gross contract exactly
     * (Requirement 8, design Property 13/14):
     *   - discountBearer 'platform'      → listedPrice (platform absorbs discount)
     *   - discountBearer 'owner'         → listedPrice − discountAmount (owner absorbs)
     *   - discountBearer null/undefined  → listedPrice (no discount)
     *   - any other discountBearer       → excluded, error indication
     *
     * Rounding uses the same `roundMoney` (2 decimals / paise) semantics as
     * calculateBilling and processPayout, so the read side stays byte-identical to
     * the write-side math.
     *
     * Returns a structured result rather than throwing so an invalid Payment is
     * *excluded* from an accumulated gross without corrupting it (Req 8.6/8.7):
     *   success → { gross: number }         (never negative)
     *   invalid → { error: string, field: 'discountAmount' | 'discountBearer' | 'listedPrice' }
     *
     * @param {{ listedPrice?: number, discountAmount?: number, discountBearer?: string | null }} payment
     * @returns {{ gross: number } | { error: string, field: string }}
     */
    computePayeeGross(payment) {
        const listedPrice = payment && payment.listedPrice;
        const discountBearer = payment ? payment.discountBearer : undefined;

        // listedPrice is the basis for every branch; a non-numeric basis would
        // yield NaN and silently corrupt an accumulated sum, so fail closed.
        if (typeof listedPrice !== 'number' || !Number.isFinite(listedPrice)) {
            return { error: 'listedPrice is missing or not a finite number', field: 'listedPrice' };
        }

        // No discount: platform bearer, or absent bearer (null/undefined).
        // The owner keeps the full listed price.
        if (discountBearer === 'platform' || discountBearer === null || discountBearer === undefined) {
            return { gross: roundMoney(listedPrice) };
        }

        // Owner absorbs the discount: gross = listedPrice − discountAmount.
        // Reject a missing, negative, or over-listedPrice discount so the result
        // is never negative and never corrupts the payee's accumulated gross.
        if (discountBearer === 'owner') {
            const discountAmount = payment.discountAmount;
            if (typeof discountAmount !== 'number' || !Number.isFinite(discountAmount) ||
                discountAmount < 0 || discountAmount > listedPrice) {
                return { error: 'discountAmount is missing, negative, or exceeds listedPrice', field: 'discountAmount' };
            }
            return { gross: roundMoney(listedPrice - discountAmount) };
        }

        // Any other bearer value is not one of platform | owner | null.
        return { error: `unknown discountBearer: ${String(discountBearer)}`, field: 'discountBearer' };
    },

    /**
     * Pure assembly of the admin overview DTO from already-aggregated,
     * integer-rupee sums. Kept separate from the DB read so the reconciliation
     * identity can be exercised without standing up Mongo (see the ponytail
     * check). Fails closed: every input sum must be a finite number, otherwise
     * a missing/null source field has corrupted a figure and no trustworthy
     * total can be returned (Requirements 10.4, 10.5).
     *
     * Reconciliation block (design Property 9 / Requirements 4.3, 4.4, 4.5):
     *   platformRetained = platformCommissionEarned + gstCollected
     *   payeeAttributed  = netPayable + paidOut
     *   residual         = grossCollected − (platformRetained + payeeAttributed + refundedTotal)
     *   discrepancy      = |residual| > 0.01
     * Category totals are returned unchanged whether or not discrepancy is set,
     * so the admin sees the mismatch rather than a hidden/"corrected" number.
     *
     * @param {{ grossCollected: number, gstCollected: number, platformCommissionEarned: number, refundedTotal: number, paidOut: number, pendingPayout: number }} sums
     * @returns {object}
     */
    buildOverview(sums) {
        const fields = ['grossCollected', 'gstCollected', 'platformCommissionEarned', 'refundedTotal', 'paidOut', 'pendingPayout'];
        for (const f of fields) {
            const v = sums[f];
            if (typeof v !== 'number' || !Number.isFinite(v)) {
                throw new Error(`overview aggregate "${f}" is missing or not a finite number; refusing to return partial totals`);
            }
        }

        const { grossCollected, gstCollected, platformCommissionEarned, refundedTotal, paidOut, pendingPayout } = sums;

        const netPayable = grossCollected - platformCommissionEarned - gstCollected;

        const platformRetained = platformCommissionEarned + gstCollected;
        const payeeAttributed = netPayable + paidOut;
        const residual = grossCollected - (platformRetained + payeeAttributed + refundedTotal);
        const discrepancy = Math.abs(residual) > 0.01;

        return {
            grossCollected,
            platformCommissionEarned,
            gstCollected,
            netPayable,
            paidOut,
            pendingPayout,
            refundedTotal,
            reconciliation: {
                grossCollected,
                platformRetained,
                payeeAttributed,
                refundedTotal,
                residual,
                discrepancy,
            },
        };
    },

    /**
     * Admin dashboard headline figures + reconciliation block over all recorded
     * Payment/Payout records, optionally constrained to an inclusive createdAt
     * range applied identically to every figure (Requirement 1.8).
     *
     * All monetary outputs are integer rupees summed verbatim from recorded
     * per-record fields — never re-derived from percentages (Requirement 9.4):
     *   grossCollected           = Σ Payment.totalAmount   where status = 'success'
     *   gstCollected             = Σ Payment.gstAmount      where status = 'success'
     *   platformCommissionEarned = Σ Payment.platformFee    where status = 'success'
     *   refundedTotal            = Σ Payment.amount         where status = 'refunded'
     *   paidOut                  = Σ Payout.netAmount        where status = 'completed'
     *   pendingPayout            = Σ Payout.netAmount        where status ∈ {pending, processing}
     *
     * Fails closed: any retrieval/aggregation error, an invalid date range, or a
     * non-finite figure rejects with an Error and returns no partial or stale
     * totals (Requirements 1.9, 10.4, 10.5). This method performs reads only and
     * writes nothing.
     *
     * @param {{ from?: Date | string | null, to?: Date | string | null }} [range]
     * @returns {Promise<object>}
     */
    async getAdminOverview({ from, to } = {}) {
        const dateMatch = buildCreatedAtMatch(from, to);

        // Two verbatim-sum aggregations. Conditional $sum keeps each to a single
        // pass over its collection. $sum ignores non-numeric values, so a
        // missing field contributes 0 rather than corrupting the total.
        const paymentMatch = { status: { $in: [PAID, REFUNDED] }, ...dateMatch };
        const payoutMatch = { status: { $in: [COMPLETED_PAYOUT, ...PENDING_PAYOUT] }, ...dateMatch };

        const [paymentAgg, payoutAgg] = await Promise.all([
            Payment.aggregate([
                { $match: paymentMatch },
                {
                    $group: {
                        _id: null,
                        grossCollected: { $sum: { $cond: [{ $eq: ['$status', PAID] }, '$totalAmount', 0] } },
                        gstCollected: { $sum: { $cond: [{ $eq: ['$status', PAID] }, '$gstAmount', 0] } },
                        platformCommissionEarned: { $sum: { $cond: [{ $eq: ['$status', PAID] }, '$platformFee', 0] } },
                        refundedTotal: { $sum: { $cond: [{ $eq: ['$status', REFUNDED] }, '$amount', 0] } },
                    },
                },
            ]),
            Payout.aggregate([
                { $match: payoutMatch },
                {
                    $group: {
                        _id: null,
                        paidOut: { $sum: { $cond: [{ $eq: ['$status', COMPLETED_PAYOUT] }, '$netAmount', 0] } },
                        pendingPayout: { $sum: { $cond: [{ $in: ['$status', PENDING_PAYOUT] }, '$netAmount', 0] } },
                    },
                },
            ]),
        ]);

        const p = paymentAgg[0] || {};
        const o = payoutAgg[0] || {};

        // buildOverview assembles the DTO and fails closed on any non-finite sum.
        return earningsService.buildOverview({
            grossCollected: p.grossCollected || 0,
            gstCollected: p.gstCollected || 0,
            platformCommissionEarned: p.platformCommissionEarned || 0,
            refundedTotal: p.refundedTotal || 0,
            paidOut: o.paidOut || 0,
            pendingPayout: o.pendingPayout || 0,
        });
    },

    /**
     * Decide whether a recipient's stored bank record is complete enough to
     * disburse a payout (Requirement 2.6). A payable record needs all four
     * fields present and non-empty — an account number alone cannot receive a
     * transfer without its IFSC/name/bank. Anything short of that counts as
     * "no stored bank details" and is excluded from readyToPayTotal.
     *
     * ponytail: strict "all four fields" definition mirrors the Payout schema,
     * which requires accountName/accountNumber/ifscCode/bankName on every write.
     *
     * @param {{ accountName?: string|null, accountNumber?: string|null, ifscCode?: string|null, bankName?: string|null } | null | undefined} b
     * @returns {boolean}
     */
    hasBankDetails(b) {
        if (!b || typeof b !== 'object') return false;
        return ['accountName', 'accountNumber', 'ifscCode', 'bankName']
            .every((k) => typeof b[k] === 'string' && b[k].trim().length > 0);
    },

    /**
     * Pure assembly of the per-recipient breakdown DTO from already-grouped,
     * integer-rupee sums joined to each recipient's name and raw bank record.
     * Kept separate from the DB read (like buildOverview) so partitioning,
     * masking, the netPayable identity, and readyToPayTotal can be exercised
     * without standing up Mongo (see the ponytail check).
     *
     * Per recipient row (design RecipientRow / Requirement 2.1–2.4, Property 5):
     *   grossEarnings     = Σ Payout.grossAmount        (verbatim)
     *   commissionDeducted= Σ Payout.platformCommission  (verbatim)
     *   netPayable        = grossEarnings − commissionDeducted   (Requirement 2.1 identity)
     *   owedNow           = Σ Payout.netAmount where status ∈ {pending,processing}, else 0
     *   bankDetails       = { accountName, accountNumberMasked, ifscCode, bankName } | null
     *   bankDetailsMissing= true when the recipient has no complete stored bank record
     *
     * Each recipient row is placed in exactly the section named by its
     * Payout.type ('event_tickets' or 'venue_booking'). readyToPayTotal sums
     * owedNow over ONLY rows with complete bank details (Requirement 2.6). All
     * monetary values are non-negative given non-negative recorded fields with
     * commission ≤ gross per record.
     *
     * Fails closed: any non-finite grouped sum means a source field is
     * missing/corrupt, so no partial breakdown is returned (Requirement 10.4).
     *
     * @param {Array<{ type: string, recipientId: string, name?: string|null, bankDetails?: object|null, grossEarnings: number, commissionDeducted: number, owedNow: number }>} groups
     * @returns {{ event_tickets: object[], venue_booking: object[], readyToPayTotal: number }}
     */
    buildRecipientBreakdown(groups) {
        const sections = { event_tickets: [], venue_booking: [] };
        let readyToPayTotal = 0;

        for (const g of groups) {
            for (const f of ['grossEarnings', 'commissionDeducted', 'owedNow']) {
                if (typeof g[f] !== 'number' || !Number.isFinite(g[f])) {
                    throw new Error(`recipient breakdown aggregate "${f}" is missing or not a finite number; refusing to return partial totals`);
                }
            }
            if (sections[g.type] === undefined) {
                // Payout.type is enum-constrained to the two known values; any
                // other value indicates corrupt data — fail closed.
                throw new Error(`recipient breakdown: unknown Payout type "${String(g.type)}"`);
            }

            const netPayable = g.grossEarnings - g.commissionDeducted;
            const present = earningsService.hasBankDetails(g.bankDetails);

            const row = {
                recipientId: String(g.recipientId),
                name: typeof g.name === 'string' ? g.name : '',
                grossEarnings: g.grossEarnings,
                commissionDeducted: g.commissionDeducted,
                netPayable,
                owedNow: g.owedNow,
                bankDetails: present
                    ? {
                        accountName: g.bankDetails.accountName,
                        accountNumberMasked: earningsService.maskAccountNumber(g.bankDetails.accountNumber),
                        ifscCode: g.bankDetails.ifscCode,
                        bankName: g.bankDetails.bankName,
                    }
                    : null,
                bankDetailsMissing: !present,
            };

            sections[g.type].push(row);
            if (present) readyToPayTotal += g.owedNow;
        }

        return { event_tickets: sections.event_tickets, venue_booking: sections.venue_booking, readyToPayTotal };
    },

    /**
     * Per-recipient payable breakdown for the admin dashboard, partitioned into
     * the two Payout.type sections, optionally constrained to an inclusive
     * createdAt range applied identically to every figure (Requirement 1.8).
     * Reads only; writes nothing.
     *
     * Groups Payout records by (type, recipient) and sums recorded integer-rupee
     * fields verbatim, then joins each recipient's name and bank record from the
     * User document (the source of truth for bank details; Requirement 2.6).
     * Fails closed on any retrieval/aggregation error or non-finite figure.
     *
     * @param {{ from?: Date | string | null, to?: Date | string | null }} [range]
     * @returns {Promise<{ event_tickets: object[], venue_booking: object[], readyToPayTotal: number }>}
     */
    async getRecipientBreakdown({ from, to } = {}) {
        const dateMatch = buildCreatedAtMatch(from, to);

        // One pass over Payout, grouped by (type, recipient). owedNow only counts
        // netAmount for payouts still owed (pending/processing).
        const grouped = await Payout.aggregate([
            { $match: { ...dateMatch } },
            {
                $group: {
                    _id: { type: '$type', recipient: '$recipient' },
                    grossEarnings: { $sum: '$grossAmount' },
                    commissionDeducted: { $sum: '$platformCommission' },
                    owedNow: { $sum: { $cond: [{ $in: ['$status', PENDING_PAYOUT] }, '$netAmount', 0] } },
                },
            },
        ]);

        // Join recipient name + bank record from User (source of truth). A single
        // batched read keyed by the distinct recipient ids.
        const recipientIds = [...new Set(grouped.map((g) => String(g._id.recipient)))];
        const users = recipientIds.length
            ? await User.find({ _id: { $in: recipientIds } }).select('name bankDetails').lean()
            : [];
        const userById = new Map(users.map((u) => [String(u._id), u]));

        const joined = grouped.map((g) => {
            const u = userById.get(String(g._id.recipient));
            return {
                type: g._id.type,
                recipientId: g._id.recipient,
                name: u ? u.name : '',
                bankDetails: u ? u.bankDetails : null,
                grossEarnings: g.grossEarnings || 0,
                commissionDeducted: g.commissionDeducted || 0,
                owedNow: g.owedNow || 0,
            };
        });

        return earningsService.buildRecipientBreakdown(joined);
    },

    /**
     * Pure assembly of a single Payout lifecycle row from a recorded Payout,
     * plus a pre-computed refund-after-completed flag. Kept separate from the DB
     * read (like buildOverview / buildRecipientBreakdown) so the status→field
     * rules can be exercised without standing up Mongo (see the ponytail check).
     *
     * Status/field rules (design Property 7 / Requirements 3.1, 3.3, 3.4, 3.5):
     *   - status is exactly one of pending | processing | completed | failed, or
     *     'unknown' when the stored status is absent or not a valid value
     *   - grossAmount, platformCommission, platformCommissionPercentage, netAmount
     *     are always exposed, read verbatim from the record (Requirement 3.2 / 16)
     *   - a 'completed' row exposes processedAt (Requirement 3.3)
     *   - a 'failed' row exposes failureReason and omits processedAt (Requirement 3.4)
     *   - an 'unknown' row still exposes the remaining fields (Requirement 3.5)
     *
     * refundAfterCompleted is added (true) only for a completed payout that has a
     * matching refunded Payment (design Property 17 / Requirement 7.5); the row
     * is otherwise a verbatim projection — the Payout is returned unchanged.
     *
     * @param {{ _id: any, status?: string, grossAmount?: number, platformCommission?: number, platformCommissionPercentage?: number, netAmount?: number, processedAt?: any, failureReason?: any }} payout
     * @param {boolean} [refundAfterCompleted]
     * @returns {object}
     */
    buildPayoutRow(payout, refundAfterCompleted = false) {
        const raw = payout.status;
        const status = VALID_PAYOUT_STATUSES.includes(raw) ? raw : 'unknown';

        const row = {
            payoutId: String(payout._id),
            status,
            grossAmount: payout.grossAmount,
            platformCommission: payout.platformCommission,
            platformCommissionPercentage: payout.platformCommissionPercentage,
            netAmount: payout.netAmount,
        };

        if (status === COMPLETED_PAYOUT) {
            row.processedAt = payout.processedAt;
            if (refundAfterCompleted) row.refundAfterCompleted = true;
        } else if (status === 'failed') {
            row.failureReason = payout.failureReason;
        }

        return row;
    },

    /**
     * Payout lifecycle list for the admin dashboard, optionally filtered to a
     * selection of stored status values (Requirements 3.1–3.7, 7.5). Reads only;
     * writes nothing.
     *
     * Filter semantics (design Property 8 / Requirements 3.6, 3.7):
     *   - statuses omitted (undefined/null) → no filter, every payout returned
     *   - statuses provided → exactly the payouts whose stored status ∈ selection
     *   - an empty selection ([]) matches nothing → empty list
     * Because the selection is matched against the stored status, an 'unknown'
     * (absent/invalid) status is naturally excluded from any valid-value filter.
     *
     * refundAfterCompleted is set on a completed payout iff a refunded Payment
     * exists for the same reference (referenceModel + referenceId). Only the
     * completed payouts' references are looked up, in one batched query.
     *
     * @param {{ statuses?: string[] | string | null }} [params]
     * @returns {Promise<object[]>}
     */
    async getPayoutList({ statuses } = {}) {
        const match = {};
        if (statuses != null) {
            const list = Array.isArray(statuses) ? statuses : [statuses];
            // An empty selection yields { $in: [] }, which matches no records —
            // exactly the "empty match → empty list" contract (Requirement 3.7).
            match.status = { $in: list };
        }

        const payouts = await Payout.find(match).sort({ createdAt: -1 }).lean();

        // Refund-after-completed: find refunded Payments sharing a reference with
        // any completed payout. Key on referenceModel+referenceId so a Booking id
        // never collides with an Event id (Property 17).
        const completedRefs = payouts
            .filter((p) => p.status === COMPLETED_PAYOUT && p.referenceId != null)
            .map((p) => ({ referenceModel: p.referenceModel, referenceId: p.referenceId }));

        const refundedRefKeys = new Set();
        if (completedRefs.length) {
            const refundedPayments = await Payment.find({
                status: REFUNDED,
                $or: completedRefs.map((r) => ({ referenceModel: r.referenceModel, referenceId: r.referenceId })),
            }).select('referenceModel referenceId').lean();
            for (const pmt of refundedPayments) {
                refundedRefKeys.add(`${pmt.referenceModel}:${String(pmt.referenceId)}`);
            }
        }

        return payouts.map((p) => {
            const refundAfterCompleted =
                p.status === COMPLETED_PAYOUT &&
                refundedRefKeys.has(`${p.referenceModel}:${String(p.referenceId)}`);
            return earningsService.buildPayoutRow(p, refundAfterCompleted);
        });
    },

    /**
     * Pure assembly of the event earnings DTO from already-aggregated,
     * integer-rupee sums plus a resolved payout status. Kept separate from the
     * DB read (like buildOverview) so the netEarnings identity and the
     * "not yet initiated" fallback can be exercised without standing up Mongo
     * (see the ponytail check).
     *
     * DTO (design EventEarningsDTO / Requirements 5.2, 5.3, 5.4, 5.6, Property 10/11):
     *   grossTicketSales           = Σ Payment.totalAmount  (verbatim, status='success')
     *   platformCommissionDeducted = Σ Payment.platformFee   (verbatim)
     *   gst                        = Σ Payment.gstAmount      (verbatim)
     *   netEarnings                = gross − commission − gst  (Requirement 5.6)
     *   payoutStatus               = referencing Payout's status, or
     *                                'not yet initiated' when none (Req 5.3, 5.4)
     *
     * Fails closed: any non-finite input sum means a source field is
     * missing/corrupt, so no partial DTO is returned (Requirement 10.4).
     *
     * @param {{ grossTicketSales: number, platformCommissionDeducted: number, gst: number }} sums
     * @param {string | null | undefined} payoutStatus  raw referencing Payout status, or null when none
     * @returns {object}
     */
    buildEventEarnings(sums, payoutStatus) {
        for (const f of ['grossTicketSales', 'platformCommissionDeducted', 'gst']) {
            const v = sums[f];
            if (typeof v !== 'number' || !Number.isFinite(v)) {
                throw new Error(`event earnings aggregate "${f}" is missing or not a finite number; refusing to return partial totals`);
            }
        }

        const { grossTicketSales, platformCommissionDeducted, gst } = sums;

        return {
            grossTicketSales,
            platformCommissionDeducted,
            gst,
            netEarnings: grossTicketSales - platformCommissionDeducted - gst,
            payoutStatus: payoutStatus == null ? 'not yet initiated' : payoutStatus,
        };
    },

    /**
     * Per-event earnings breakdown for the organizer surface (Requirements 5.2–5.6,
     * 11.3). Reads only; writes nothing.
     *
     * Ownership is enforced server-side before any financial read: the event's
     * organizer must equal the requester, otherwise (or when the event does not
     * exist, or the id is malformed) an authorization error is thrown and NO
     * earnings data is returned (Requirements 5.5, 11.3). The error carries
     * `status = 403` so the route layer maps it verbatim — matching the existing
     * service convention (e.g. venueService).
     *
     * Ticket purchases are recorded with referenceModel 'Event' + referenceId =
     * the event id (see ticketService), so gross/commission/gst are verbatim
     * sums over this event's `status === 'success'` Payments; 0 when none
     * (Requirement 5.2, Property 10). payoutStatus is the most recent referencing
     * Payout's status, or 'not yet initiated' when none exists (Property 11).
     *
     * @param {string} eventId
     * @param {string} requesterId
     * @returns {Promise<object>}
     */
    async getEventEarnings(eventId, requesterId) {
        const denied = () => {
            const err = new Error('Not authorized to view earnings for this event');
            /** @type {any} */ (err).status = 403;
            return err;
        };

        // A malformed id can never match an owned event; fail closed as "no
        // data" rather than letting a CastError surface as a 500.
        if (!mongoose.isValidObjectId(eventId)) {
            throw denied();
        }

        const event = await Event.findById(eventId).select('organizer').lean();
        if (!event || String(event.organizer) !== String(requesterId)) {
            throw denied();
        }

        // Verbatim sums over this event's collected ticket payments. $sum ignores
        // non-numeric values, so a missing field contributes 0. event._id is
        // already an ObjectId (aggregate $match does not auto-cast like find).
        const [agg] = await Payment.aggregate([
            { $match: { referenceModel: 'Event', referenceId: event._id, status: PAID } },
            {
                $group: {
                    _id: null,
                    grossTicketSales: { $sum: '$totalAmount' },
                    platformCommissionDeducted: { $sum: '$platformFee' },
                    gst: { $sum: '$gstAmount' },
                },
            },
        ]);

        // Representative payout: the most recent Payout referencing this event.
        const payout = await Payout.findOne({ referenceModel: 'Event', referenceId: event._id })
            .sort({ createdAt: -1 })
            .select('status')
            .lean();

        return earningsService.buildEventEarnings({
            grossTicketSales: (agg && agg.grossTicketSales) || 0,
            platformCommissionDeducted: (agg && agg.platformCommissionDeducted) || 0,
            gst: (agg && agg.gst) || 0,
        }, payout ? payout.status : null);
    },

    /**
     * Pure assembly of a single venue-booking earnings row from a recorded
     * booking's full amount plus already-aggregated, integer-rupee paid sums and
     * a resolved payout status. Kept separate from the DB read (like
     * buildEventEarnings) so the netPayable identity, outstanding-balance
     * detection, and the "not yet initiated" fallback can be exercised without
     * standing up Mongo (see the ponytail check).
     *
     * Row (design VenueEarningsDTO.bookings / Requirements 6.2–6.6, Property 12):
     *   grossBookingAmount = Booking.totalAmount                 (full amount)
     *   advancePaid        = Σ Payment.amount  (verbatim, status='success')
     *   commissionDeducted = Σ Payment.platformFee (verbatim)
     *   netPayable         = advancePaid − commissionDeducted     (Requirement 6.3)
     *   balanceOutstanding = 0 < advancePaid < grossBookingAmount (Property 12)
     *   payoutStatus       = referencing Payout's status, or
     *                        'not yet initiated' when none (Req 6.5, 6.6)
     *
     * A booking with no paid Payment has advancePaid = commissionDeducted = 0,
     * so netPayable = 0, balanceOutstanding = false (0 is not > 0), and
     * payoutStatus = 'not yet initiated' (Requirement 6.6).
     *
     * Fails closed: any non-finite input means a source field is missing/corrupt,
     * so no partial row is returned (Requirement 10.4).
     *
     * @param {{ bookingId: any, grossBookingAmount: number, advancePaid: number, commissionDeducted: number }} sums
     * @param {string | null | undefined} payoutStatus  raw referencing Payout status, or null when none
     * @returns {object}
     */
    buildVenueBookingRow(sums, payoutStatus) {
        for (const f of ['grossBookingAmount', 'advancePaid', 'commissionDeducted']) {
            const v = sums[f];
            if (typeof v !== 'number' || !Number.isFinite(v)) {
                throw new Error(`venue earnings aggregate "${f}" is missing or not a finite number; refusing to return partial totals`);
            }
        }

        const { grossBookingAmount, advancePaid, commissionDeducted } = sums;

        return {
            bookingId: String(sums.bookingId),
            grossBookingAmount,
            advancePaid,
            commissionDeducted,
            netPayable: advancePaid - commissionDeducted,
            // Property 12: outstanding iff some advance is paid but it does not
            // yet cover the full booking amount. A booking with nothing paid
            // (advancePaid === 0) is "not yet initiated", not "outstanding".
            balanceOutstanding: advancePaid > 0 && advancePaid < grossBookingAmount,
            payoutStatus: payoutStatus == null ? 'not yet initiated' : payoutStatus,
        };
    },

    /**
     * Pure assembly of the venue earnings DTO from per-booking rows. Kept
     * separate from the DB read so the { venueId, bookings } shape is trivially
     * checkable without Mongo (see the ponytail check).
     *
     * @param {any} venueId
     * @param {object[]} bookings
     * @returns {{ venueId: string, bookings: object[] }}
     */
    buildVenueEarnings(venueId, bookings) {
        return { venueId: String(venueId), bookings };
    },

    /**
     * Per-booking earnings breakdown for the venue-owner surface (Requirements
     * 6.2–6.8, 11.4). Reads only; writes nothing.
     *
     * Ownership is enforced server-side before any financial read: the venue's
     * owner must equal the requester, otherwise (or when the venue does not
     * exist, or the id is malformed) an authorization error is thrown and NO
     * earnings data is returned (Requirements 6.7, 6.8, 11.4). The error carries
     * `status = 403` so the route layer maps it verbatim — matching the existing
     * getEventEarnings convention.
     *
     * For every booking of the venue: grossBookingAmount is the recorded full
     * Booking.totalAmount; advancePaid and commissionDeducted are verbatim sums
     * over that booking's `status === 'success'` Payments (Payment.amount and
     * Payment.platformFee); 0 when none (Requirement 6.2/6.6, Property 10).
     * payoutStatus is the most recent referencing Payout's status, or
     * 'not yet initiated' when none (Property 11).
     *
     * @param {string} venueId
     * @param {string} requesterId
     * @returns {Promise<object>}
     */
    async getVenueEarnings(venueId, requesterId) {
        const denied = () => {
            const err = new Error('Not authorized to view earnings for this venue');
            /** @type {any} */ (err).status = 403;
            return err;
        };

        // A malformed id can never match an owned venue; fail closed as "no
        // data" rather than letting a CastError surface as a 500.
        if (!mongoose.isValidObjectId(venueId)) {
            throw denied();
        }

        const venue = await Venue.findById(venueId).select('owner').lean();
        if (!venue || String(venue.owner) !== String(requesterId)) {
            throw denied();
        }

        // Every booking of the venue — grossBookingAmount is the recorded full
        // Booking.totalAmount (the advance-billing basis).
        const bookings = await Booking.find({ venue: venue._id })
            .select('totalAmount')
            .sort({ createdAt: -1 })
            .lean();

        if (!bookings.length) {
            return earningsService.buildVenueEarnings(venue._id, []);
        }

        const bookingIds = bookings.map((b) => b._id);

        // Verbatim paid sums per booking. $sum ignores non-numeric values, so a
        // missing field contributes 0. Bookings with no paid Payment simply do
        // not appear in the grouped result and default to all-zero below.
        const [paidAgg, payouts] = await Promise.all([
            Payment.aggregate([
                { $match: { referenceModel: 'Booking', referenceId: { $in: bookingIds }, status: PAID } },
                {
                    $group: {
                        _id: '$referenceId',
                        advancePaid: { $sum: '$amount' },
                        commissionDeducted: { $sum: '$platformFee' },
                    },
                },
            ]),
            // Most-recent referencing Payout per booking (createdAt desc, first wins).
            Payout.find({ referenceModel: 'Booking', referenceId: { $in: bookingIds } })
                .sort({ createdAt: -1 })
                .select('referenceId status')
                .lean(),
        ]);

        const paidById = new Map(paidAgg.map((a) => [String(a._id), a]));
        const payoutStatusById = new Map();
        for (const p of payouts) {
            const key = String(p.referenceId);
            if (!payoutStatusById.has(key)) payoutStatusById.set(key, p.status);
        }

        const rows = bookings.map((b) => {
            const key = String(b._id);
            const paid = paidById.get(key);
            return earningsService.buildVenueBookingRow(
                {
                    bookingId: b._id,
                    grossBookingAmount: b.totalAmount || 0,
                    advancePaid: (paid && paid.advancePaid) || 0,
                    commissionDeducted: (paid && paid.commissionDeducted) || 0,
                },
                payoutStatusById.has(key) ? payoutStatusById.get(key) : null,
            );
        });

        return earningsService.buildVenueEarnings(venue._id, rows);
    },

    /**
     * Pure assembly of the per-listing figures DTO from already-aggregated sums,
     * counts, and a resolved representative payout. Kept separate from the DB
     * read (like every other build* helper here) so the fail-closed contract and
     * the whitelisted shape can be exercised without standing up Mongo (see the
     * ponytail check).
     *
     * Every money field is carried through verbatim — nothing is re-derived from
     * a percentage (Requirement 12.1). The returned objects are rebuilt key by
     * key, so an extra field on an aggregation result can never leak into the
     * settlement basis.
     *
     * Fails closed: a non-finite money sum, a non-finite count, or an
     * unparseable lastPaymentAt means a source field is missing/corrupt, so no
     * partial figure set is returned (Requirement 12.5).
     *
     * @param {{ money: object, activity: object, payout: object|null }} parts
     * @returns {{ money: ListingMoney, activity: ListingActivity, payout: PayoutSummary|null }}
     */
    buildListingFigures({ money, activity, payout }) {
        const moneyFields = ['grossCollected', 'platformFeeCollected', 'gstRetained',
            'ownerGross', 'platformCommission', 'netPayable', 'refundedTotal'];
        for (const f of moneyFields) {
            const v = money && money[f];
            if (typeof v !== 'number' || !Number.isFinite(v)) {
                throw new Error(`listing figures aggregate "${f}" is missing or not a finite number; refusing to return partial totals`);
            }
        }

        const countFields = ['successfulPayments', 'unitsSold', 'confirmed', 'cancelled', 'refundedPayments'];
        for (const f of countFields) {
            const v = activity && activity[f];
            if (typeof v !== 'number' || !Number.isFinite(v)) {
                throw new Error(`listing figures count "${f}" is missing or not a finite number; refusing to return partial totals`);
            }
        }

        // Absent is the documented "no successful payments" value (Req 3.4); a
        // present-but-unparseable timestamp is corrupt data, so fail closed.
        let lastPaymentAt = null;
        if (activity.lastPaymentAt != null) {
            lastPaymentAt = activity.lastPaymentAt instanceof Date
                ? activity.lastPaymentAt
                : new Date(activity.lastPaymentAt);
            if (Number.isNaN(lastPaymentAt.getTime())) {
                throw new Error('listing figures "lastPaymentAt" is not a valid date; refusing to return partial totals');
            }
        }

        return {
            money: {
                grossCollected: money.grossCollected,
                platformFeeCollected: money.platformFeeCollected,
                gstRetained: money.gstRetained,
                ownerGross: money.ownerGross,
                platformCommission: money.platformCommission,
                netPayable: money.netPayable,
                refundedTotal: money.refundedTotal,
            },
            activity: {
                successfulPayments: activity.successfulPayments,
                unitsSold: activity.unitsSold,
                confirmed: activity.confirmed,
                cancelled: activity.cancelled,
                refundedPayments: activity.refundedPayments,
                lastPaymentAt,
            },
            payout: payout
                ? {
                    payoutId: String(payout.payoutId != null ? payout.payoutId : payout._id),
                    status: payout.status,
                    netAmount: payout.netAmount,
                }
                : null,
        };
    },

    /**
     * Per-listing money + activity figures — the single money path, extended per
     * listing (per-listing-settlement-tracking design). Reads only; writes
     * nothing. No ownership check: callers own authorization, exactly like
     * getAdminOverview.
     *
     * Money is summed verbatim from recorded Payment/Payout fields; nothing is
     * re-derived from a percentage (Requirement 12.1, 2.4):
     *   grossCollected       = Σ Payment.totalAmount      where status = 'success'
     *   platformFeeCollected = Σ Payment.platformFee       where status = 'success'
     *   gstRetained          = Σ Payment.gstAmount         where status = 'success'
     *   refundedTotal        = Σ Payment.totalAmount       where status = 'refunded'
     *   ownerGross           = Σ Payout.grossAmount        (every referencing payout)
     *   platformCommission   = Σ Payout.platformCommission
     *   netPayable           = Σ Payout.netAmount
     *
     * Scope (mirrors getEventEarnings / getVenueEarnings):
     *   event → Payment/Payout { referenceModel: 'Event', referenceId: eventId }, activity from Ticket { event }
     *   venue → Payment/Payout { referenceModel: 'Booking', referenceId: ∈ that venue's bookings }, activity from Booking { venue }
     *
     * Consequence stated in the design: a listing with collected payments but no
     * Payout record has netPayable = 0 and payout = null — money is owed once a
     * payout has been raised, and inventing a commission here would be the
     * second computation path Requirement 12.1 forbids.
     *
     * Fails closed on an unknown kind, a malformed or absent listing id, or a
     * non-finite sum, so a corrupt field never becomes a settlement basis
     * (Requirement 12.5).
     *
     * @param {{ kind: 'event'|'venue', listingId: string }} params
     * @returns {Promise<{ money: ListingMoney, activity: ListingActivity, payout: PayoutSummary|null }>}
     */
    async getListingFigures({ kind, listingId } = /** @type {any} */ ({})) {
        if (kind !== 'event' && kind !== 'venue') {
            throw new Error(`getListingFigures: unknown listing kind "${String(kind)}"`);
        }
        // A malformed id can never match a listing; fail closed rather than
        // letting a CastError surface as a 500 (same posture as getEventEarnings).
        if (!mongoose.isValidObjectId(listingId)) {
            throw new Error(`getListingFigures: malformed ${kind} id "${String(listingId)}"`);
        }

        let referenceModel;
        let referenceIds;
        let activity;

        if (kind === 'event') {
            const event = await Event.findById(listingId).select('_id').lean();
            if (!event) {
                throw new Error(`getListingFigures: event ${String(listingId)} not found`);
            }
            referenceModel = 'Event';
            referenceIds = [event._id];

            // unitsSold is Σ Ticket.quantity; confirmed/cancelled count tickets.
            const [t] = await Ticket.aggregate([
                { $match: { event: event._id } },
                {
                    $group: {
                        _id: null,
                        unitsSold: { $sum: '$quantity' },
                        confirmed: { $sum: { $cond: [{ $in: ['$status', TICKET_CONFIRMED] }, 1, 0] } },
                        cancelled: { $sum: { $cond: [{ $in: ['$status', TICKET_CANCELLED] }, 1, 0] } },
                    },
                },
            ]);
            activity = {
                unitsSold: (t && t.unitsSold) || 0,
                confirmed: (t && t.confirmed) || 0,
                cancelled: (t && t.cancelled) || 0,
            };
        } else {
            const venue = await Venue.findById(listingId).select('_id').lean();
            if (!venue) {
                throw new Error(`getListingFigures: venue ${String(listingId)} not found`);
            }
            // The bookings are the payment/payout reference scope AND the
            // activity source, so one read serves both.
            const bookings = await Booking.find({ venue: venue._id }).select('status').lean();
            referenceModel = 'Booking';
            referenceIds = bookings.map((b) => b._id);
            activity = {
                unitsSold: bookings.length,
                confirmed: bookings.filter((b) => BOOKING_CONFIRMED.includes(b.status)).length,
                cancelled: bookings.filter((b) => BOOKING_CANCELLED.includes(b.status)).length,
            };
        }

        const zeroMoney = {
            grossCollected: 0, platformFeeCollected: 0, gstRetained: 0,
            ownerGross: 0, platformCommission: 0, netPayable: 0, refundedTotal: 0,
        };

        // A venue with no bookings has no reference to match; nothing to query.
        if (!referenceIds.length) {
            return earningsService.buildListingFigures({
                money: zeroMoney,
                activity: { ...activity, successfulPayments: 0, refundedPayments: 0, lastPaymentAt: null },
                payout: null,
            });
        }

        // $sum/$max ignore non-numeric and null values, so a missing field
        // contributes 0 rather than corrupting the total.
        const [paymentAgg, payoutAgg, payout] = await Promise.all([
            Payment.aggregate([
                { $match: { referenceModel, referenceId: { $in: referenceIds }, status: { $in: [PAID, REFUNDED] } } },
                {
                    $group: {
                        _id: null,
                        grossCollected: { $sum: { $cond: [{ $eq: ['$status', PAID] }, '$totalAmount', 0] } },
                        platformFeeCollected: { $sum: { $cond: [{ $eq: ['$status', PAID] }, '$platformFee', 0] } },
                        gstRetained: { $sum: { $cond: [{ $eq: ['$status', PAID] }, '$gstAmount', 0] } },
                        refundedTotal: { $sum: { $cond: [{ $eq: ['$status', REFUNDED] }, '$totalAmount', 0] } },
                        successfulPayments: { $sum: { $cond: [{ $eq: ['$status', PAID] }, 1, 0] } },
                        refundedPayments: { $sum: { $cond: [{ $eq: ['$status', REFUNDED] }, 1, 0] } },
                        lastPaymentAt: { $max: { $cond: [{ $eq: ['$status', PAID] }, '$paidAt', null] } },
                    },
                },
            ]),
            Payout.aggregate([
                { $match: { referenceModel, referenceId: { $in: referenceIds } } },
                {
                    $group: {
                        _id: null,
                        ownerGross: { $sum: '$grossAmount' },
                        platformCommission: { $sum: '$platformCommission' },
                        netPayable: { $sum: '$netAmount' },
                    },
                },
            ]),
            // Representative payout: the most recent one referencing this listing.
            Payout.findOne({ referenceModel, referenceId: { $in: referenceIds } })
                .sort({ createdAt: -1 })
                .select('status netAmount')
                .lean(),
        ]);

        const p = paymentAgg[0] || {};
        const o = payoutAgg[0] || {};

        return earningsService.buildListingFigures({
            money: {
                grossCollected: p.grossCollected || 0,
                platformFeeCollected: p.platformFeeCollected || 0,
                gstRetained: p.gstRetained || 0,
                ownerGross: o.ownerGross || 0,
                platformCommission: o.platformCommission || 0,
                netPayable: o.netPayable || 0,
                refundedTotal: p.refundedTotal || 0,
            },
            activity: {
                ...activity,
                successfulPayments: p.successfulPayments || 0,
                refundedPayments: p.refundedPayments || 0,
                lastPaymentAt: p.lastPaymentAt != null ? p.lastPaymentAt : null,
            },
            payout: payout || null,
        });
    },
};

/**
 * Build an inclusive createdAt match fragment applied identically to the
 * Payment and Payout queries (Requirement 1.8). Absent bounds mean "all records
 * to date". A provided-but-unparseable bound fails closed so the caller never
 * silently aggregates over the wrong scope.
 *
 * @param {Date | string | null | undefined} from
 * @param {Date | string | null | undefined} to
 * @returns {{ createdAt?: { $gte?: Date, $lte?: Date } }}
 */
function buildCreatedAtMatch(from, to) {
    const createdAt = {};
    if (from != null) {
        const d = from instanceof Date ? from : new Date(from);
        if (Number.isNaN(d.getTime())) {
            throw new Error('getAdminOverview: invalid "from" date');
        }
        createdAt.$gte = d;
    }
    if (to != null) {
        const d = to instanceof Date ? to : new Date(to);
        if (Number.isNaN(d.getTime())) {
            throw new Error('getAdminOverview: invalid "to" date');
        }
        createdAt.$lte = d;
    }
    return Object.keys(createdAt).length ? { createdAt } : {};
}

module.exports = earningsService;
