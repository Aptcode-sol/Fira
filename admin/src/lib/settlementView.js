/**
 * Pure label/branch decisions for `ListingSettlementPanel`.
 *
 * These are the choices Requirements 2.3, 2.5, 3.4, 5.6 and 11.3 turn on. This
 * package has no renderer (vite + eslint only), so a decision buried in JSX can
 * only be checked by a renderer that isn't here. Lifting the decisions into a
 * plain ESM module — like `pageWindow.js` and `listingSettlementState.js` — lets
 * bare `node` exercise the exact code the panel runs, not a copy that can rot
 * out of step with it. It also drops the two-group markup from three inline
 * blocks to one mapped list.
 */

// Settlement_State → label + the status-pill classes `pages/EventDetail.jsx`
// already uses, so this state reads like every other status in the admin app.
export const STATE_BADGES = {
    not_settled: { label: 'Not settled', className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
    partially_settled: { label: 'Partially settled', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    fully_settled: { label: 'Fully settled', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    over_settled: { label: 'Over settled', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

/**
 * Requirement 5.6: the badge for a Settlement_State, or `null` for an unknown
 * one so nothing renders rather than a broken pill.
 *
 * @param {string} state
 * @returns {{ label: string, className: string } | null}
 */
export function stateBadge(state) {
    return STATE_BADGES[state] ?? null;
}

/** Requirement 5.6: an over-settled listing is shown differently. */
export function isOverSettled(state) {
    return state === 'over_settled';
}

/**
 * Requirement 5.6: an over-settled listing pins Outstanding at ₹0 — the excess
 * is shown as its own figure instead.
 *
 * @param {object} money
 * @param {string} state
 */
export function pinnedOutstanding(money = {}, state) {
    return isOverSettled(state) ? 0 : money.outstandingAmount;
}

/**
 * Requirement 2.5: a venue's collected figure is the booking advance; an
 * event's is the ticket gross.
 *
 * @param {'event' | 'venue'} kind
 */
export function grossLabel(kind) {
    return kind === 'venue' ? 'Advance collected' : 'Gross collected';
}

/**
 * The full-price line that the buyer-side breakdown starts from.
 *
 * @param {'event' | 'venue'} kind
 */
export function fullPriceLabel(kind) {
    return kind === 'venue' ? 'Booking amount (full price)' : 'Ticket sales (full price)';
}

/**
 * Who a listing's owner is, in words, for the owner-side rows.
 *
 * @param {'event' | 'venue'} kind
 */
export function ownerNoun(kind) {
    return kind === 'venue' ? 'venue owner' : 'organizer';
}

/**
 * Requirement 1.7: a listing with nothing owed (no paid sales yet) has
 * nothing to settle yet — said in words rather than left as three zeros the
 * reader has to interpret.
 *
 * @param {object} money
 */
export function nothingToSettle(money = {}) {
    return !((money.netPayable ?? 0) > 0);
}

/**
 * Requirement 2.3 + 5.6: the supporting breakdown as two labeled groups, with
 * an over-settled listing pinning Outstanding at ₹0 and adding an Excess row.
 * Membership is data here rather than JSX, so which figure sits in which group
 * is checkable without a renderer. Refunded_Total is deliberately in neither
 * group (Requirement 2.1/2.2) — it is rendered on its own.
 *
 * The buyer-side group reads as a sum, top to bottom:
 *   full price + platform fee + GST − discounts = collected
 * with the discount split by who funded it, shown only when non-zero.
 *
 * The owner side has no commission. Net payable is the owner's share (full
 * price less their own discounts) in whole rupees; each manual transfer is
 * recorded against it as a settlement.
 *
 * `sign` is the operator the row contributes to its group's sum; `indent`
 * marks a row that splits the row above it rather than adding to the sum.
 *
 * @param {{ kind: 'event' | 'venue', money: object, state: string }} args
 * @returns {Array<{ title: string, rows: Array<{ label: string, value: number, emphasis?: boolean,
 *                    sign?: '+' | '−' | '=', indent?: boolean, hint?: string }> }>}
 */
export function moneyGroups({ kind, money = {}, state }) {
    const discountSplit = [
        { label: `By ${ownerNoun(kind)}`, value: money.discountByOwner },
        { label: 'By platform', value: money.discountByPlatform },
    ]
        .filter((row) => (row.value ?? 0) > 0)
        .map((row) => ({ ...row, indent: true }));

    return [
        {
            title: 'Collected from buyers',
            rows: [
                { label: fullPriceLabel(kind), value: money.fullPriceTotal },
                { label: 'Platform fee', value: money.platformFeeCollected, sign: '+' },
                { label: 'GST on platform fee', value: money.gstRetained, sign: '+' },
                { label: 'Discounts', value: money.discountTotal, sign: '−' },
                ...discountSplit,
                { label: grossLabel(kind), value: money.grossCollected, sign: '=', emphasis: true },
            ],
        },
        {
            title: 'Owed to owner',
            rows: [
                {
                    label: `${kind === 'venue' ? 'Venue owner' : 'Organizer'}'s share`,
                    value: money.ownerShare,
                    hint: `Full price minus the ${ownerNoun(kind)}'s own discounts`,
                },
                {
                    label: 'Net payable',
                    value: money.netPayable,
                    emphasis: true,
                    hint: 'The share above in whole rupees',
                },
                { label: 'Settled to date', value: money.settledToDate },
                { label: 'Outstanding', value: pinnedOutstanding(money, state), emphasis: true },
                ...(isOverSettled(state) ? [{ label: 'Excess settled', value: money.excessAmount }] : []),
            ],
        },
    ];
}

/**
 * Requirement 3.4: the last-payment line is an explicit indication, never a
 * blank or a placeholder date. The date formatter is passed in so this stays a
 * pure branch — the component hands it `formatDateTime`.
 *
 * @param {object} activity
 * @param {(value: unknown) => string} format
 * @returns {string}
 */
export function formatLastPayment(activity = {}, format) {
    return activity.lastPaymentAt ? format(activity.lastPaymentAt) : 'No payments yet';
}

/**
 * Requirement 1.6: an empty ledger is named, not implied.
 *
 * @param {'event' | 'venue'} kind
 */
export function emptyLedgerMessage(kind) {
    return `No settlements recorded for this ${kind} yet.`;
}

/**
 * Requirement 11.3: a moderator has no settlement read or write, so the panel
 * is not rendered at all.
 *
 * @param {string | null} adminRole
 */
export function isModeratorHidden(adminRole) {
    return adminRole === 'moderator';
}
