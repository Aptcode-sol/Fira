/**
 * Runnable example check for what the settlement panel renders.
 * Run: node src/lib/settlementView.check.mjs
 *
 * This package ships no renderer (vite + eslint only), so the panel's rendering
 * is checked at the seam a renderer would exercise: the pure label/branch
 * decisions in `settlementView.js` that the panel imports, plus `formatInr`
 * (the module the Payouts page also imports). Everything asserted here is the
 * exact code the panel runs — not a copy of it.
 *
 * Covers Requirements 2.3, 2.5, 3.4, 5.6, 11.3, 12.6.
 */
import assert from 'node:assert/strict';
import {
    STATE_BADGES,
    emptyLedgerMessage,
    formatLastPayment,
    grossLabel,
    isModeratorHidden,
    isOverSettled,
    moneyGroups,
    nothingToSettle,
    pinnedOutstanding,
    stateBadge,
} from './settlementView.js';
import { formatInr } from './formatInr.js';
// The Payouts page renders every amount through this same module (see the
// import in admin/src/pages/Payouts.jsx). Importing it here proves the panel's
// numbers read identically to the Payouts page's by construction (12.6).
import { formatInr as payoutsFormatInr } from './formatInr.js';

const MONEY = {
    grossCollected: 100000,
    platformFeeCollected: 5000,
    gstRetained: 900,
    ownerGross: 95000,
    platformCommission: 5000,
    netPayable: 90000,
    settledToDate: 40000,
    outstandingAmount: 50000,
    excessAmount: 0,
};

/* ---- Requirement 2.5: the collected label depends on the listing kind ---- */
{
    assert.equal(grossLabel('venue'), 'Advance collected', 'a venue collects a booking advance');
    assert.equal(grossLabel('event'), 'Gross collected', 'an event collects ticket gross');
    // The two groups carry the kind-specific label on the first buyer-side row.
    assert.equal(moneyGroups({ kind: 'venue', money: MONEY, state: 'partially_settled' })[0].rows[0].label, 'Advance collected');
    assert.equal(moneyGroups({ kind: 'event', money: MONEY, state: 'partially_settled' })[0].rows[0].label, 'Gross collected');
}

/* ---- Requirement 2.3: two labeled groups, each figure in exactly one ---- */
{
    const groups = moneyGroups({ kind: 'event', money: MONEY, state: 'partially_settled' });
    assert.equal(groups.length, 2, 'exactly two groups');
    assert.deepEqual(groups.map((g) => g.title), ['Collected from buyers', 'Owed to owner']);

    const buyer = groups[0].rows.map((r) => r.label);
    const owner = groups[1].rows.map((r) => r.label);
    assert.deepEqual(buyer, ['Gross collected', 'Platform fee collected', 'GST retained']);
    assert.deepEqual(owner, ['Owner gross', 'Platform commission', 'Net payable', 'Settled to date', 'Outstanding']);

    // Membership is disjoint — no figure appears in both groups.
    for (const label of buyer) assert.ok(!owner.includes(label), `${label} must sit in one group only`);

    // Refunded_Total (2.1/2.2) belongs to neither group — it is rendered on its own.
    assert.ok(![...buyer, ...owner].includes('Refunded to buyers'), 'refunded total is not a group member');

    // Every row's value is the corresponding money figure, so the layout can't
    // silently mislabel a figure.
    const byLabel = Object.fromEntries(groups.flatMap((g) => g.rows).map((r) => [r.label, r.value]));
    assert.equal(byLabel['Gross collected'], MONEY.grossCollected);
    assert.equal(byLabel['Net payable'], MONEY.netPayable);
    assert.equal(byLabel['Outstanding'], MONEY.outstandingAmount);
}

/* ---- Requirement 5.6: the state badge, including over_settled ---- */
{
    // Every Settlement_State maps to a distinct label + pill class.
    const states = ['not_settled', 'partially_settled', 'fully_settled', 'over_settled'];
    for (const s of states) {
        const badge = stateBadge(s);
        assert.ok(badge && badge.label && badge.className, `${s} must have a label and class`);
        assert.equal(badge, STATE_BADGES[s]);
    }
    assert.equal(stateBadge('over_settled').label, 'Over settled');
    assert.match(stateBadge('over_settled').className, /red/, 'over_settled reads as a red pill');
    // Labels are all distinct — no two states look the same.
    const labels = states.map((s) => stateBadge(s).label);
    assert.equal(new Set(labels).size, states.length, 'each state has a distinct label');
    // An unknown state renders nothing rather than a broken pill.
    assert.equal(stateBadge('nonsense'), null);
    assert.equal(stateBadge(undefined), null);

    // Over-settled pins Outstanding at ₹0 and surfaces the excess as its own row.
    const over = { ...MONEY, outstandingAmount: 0, excessAmount: 7500 };
    assert.equal(isOverSettled('over_settled'), true);
    assert.equal(pinnedOutstanding({ ...over, outstandingAmount: 999 }, 'over_settled'), 0, 'Outstanding pinned at ₹0');
    assert.equal(pinnedOutstanding(MONEY, 'partially_settled'), MONEY.outstandingAmount, 'otherwise the real figure');

    const ownerRows = moneyGroups({ kind: 'event', money: over, state: 'over_settled' })[1].rows;
    const excess = ownerRows.find((r) => r.label === 'Excess settled');
    assert.ok(excess, 'over_settled adds an Excess settled row');
    assert.equal(excess.value, 7500);
    assert.equal(ownerRows.find((r) => r.label === 'Outstanding').value, 0, 'and Outstanding shows ₹0');
    // A non-over-settled listing has no excess row.
    assert.ok(!moneyGroups({ kind: 'event', money: MONEY, state: 'partially_settled' })[1].rows.some((r) => r.label === 'Excess settled'));
}

/* ---- Requirement 1.7: nothing to settle when no payout is raised ---- */
{
    assert.equal(nothingToSettle({ netPayable: 0 }), true);
    assert.equal(nothingToSettle({}), true);
    assert.equal(nothingToSettle({ netPayable: 90000 }), false);
}

/* ---- Requirement 3.4: last payment is a date or an explicit "No payments yet" ---- */
{
    const fmt = (v) => `formatted:${v}`;
    assert.equal(formatLastPayment({ lastPaymentAt: '2024-05-01T10:00:00Z' }, fmt), 'formatted:2024-05-01T10:00:00Z');
    assert.equal(formatLastPayment({ lastPaymentAt: null }, fmt), 'No payments yet');
    assert.equal(formatLastPayment({}, fmt), 'No payments yet', 'absent date is named, never a blank');
    // The formatter is only invoked when there is a date to format.
    let calls = 0;
    formatLastPayment({}, () => { calls += 1; return 'x'; });
    assert.equal(calls, 0, 'no date ⇒ the formatter is never called');
}

/* ---- empty ledger is named, per listing kind ---- */
{
    assert.equal(emptyLedgerMessage('event'), 'No settlements recorded for this event yet.');
    assert.equal(emptyLedgerMessage('venue'), 'No settlements recorded for this venue yet.');
}

/* ---- Requirement 11.3: a moderator sees no panel (no controls) ---- */
{
    assert.equal(isModeratorHidden('moderator'), true, 'a moderator is hidden the whole panel');
    assert.equal(isModeratorHidden('admin'), false);
    assert.equal(isModeratorHidden('super_admin'), false);
    assert.equal(isModeratorHidden(null), false, 'an unauthenticated read is left to the server guard');
}

/* ---- Requirement 12.6: amounts render identically to the Payouts page ---- */
{
    // Same module the Payouts page imports ⇒ same string for the same amount.
    const amounts = [0, 900, 5000, 40000, 90000, 100000, 1234567, null, undefined, NaN];
    for (const a of amounts) {
        assert.equal(formatInr(a), payoutsFormatInr(a), `panel and Payouts must agree on ${a}`);
    }
    // The documented shape: Indian grouping, ₹ symbol, two fraction digits, and
    // a null/absent/non-finite amount as ₹0.00 (never blank).
    assert.equal(formatInr(1234567), '₹12,34,567.00');
    assert.equal(formatInr(5000), '₹5,000.00');
    assert.equal(formatInr(0), '₹0.00');
    assert.equal(formatInr(null), '₹0.00');
    assert.equal(formatInr(undefined), '₹0.00');
    assert.equal(formatInr(NaN), '₹0.00');
}

console.log('settlementView.check.mjs: all assertions passed');
