// ponytail check for settlementService's pure core — the ledger fold and the
// over-settlement guard (Requirements 12.2, 12.3, 5.7). No framework, no
// fixtures, no database — run with:
//   node server/services/settlementService.check.mjs
// The formal fast-check property tests are separate tasks (3.5-3.9); this is the
// single runnable check that fails if the ledger arithmetic or the guard breaks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const settlementService = require('./settlementService.js');
const { buildLedger, checkOverSettlement } = settlementService;

// The tolerance is the one earningsService.buildOverview already uses for its
// reconciliation residual — one paise (Requirement 12.3).
assert.equal(settlementService.EPSILON, 0.01);

// --- buildLedger: the fold (Requirements 1.1, 12.2) ---

// Settled_To_Date is solely the sum of effective settledAmount values.
{
    const ledger = buildLedger([
        { _id: 'a', settledAmount: 2000 },
        { _id: 'b', settledAmount: 1000 },
        { _id: 'c', settledAmount: 500 },
    ], 5000);
    assert.equal(ledger.settledToDate, 3500);
    assert.equal(ledger.outstandingAmount, 1500);
    assert.equal(ledger.excessAmount, 0);
    assert.equal(ledger.state, 'partially_settled');
}

// Empty ledger → nothing settled, the whole net payable outstanding (Req 1.6).
{
    const ledger = buildLedger([], 5000);
    assert.deepEqual(ledger, { settledToDate: 0, outstandingAmount: 5000, excessAmount: 0, state: 'not_settled' });
}

// A listing with no payout due and nothing settled is not "fully settled" (Req 1.7).
{
    const ledger = buildLedger([], 0);
    assert.deepEqual(ledger, { settledToDate: 0, outstandingAmount: 0, excessAmount: 0, state: 'not_settled' });
}

// Order does not change the fold, and a null row is skipped rather than throwing.
{
    const rows = [{ _id: 'a', settledAmount: 1000 }, null, { _id: 'b', settledAmount: 250.5 }];
    assert.equal(buildLedger(rows, 5000).settledToDate, 1250.5);
    assert.equal(buildLedger([...rows].reverse(), 5000).settledToDate, 1250.5);
}

// Binary-float dust is stripped: three ₹0.10 entries sum to exactly ₹0.30 (Req 12.3).
{
    const ledger = buildLedger([
        { _id: 'a', settledAmount: 0.1 },
        { _id: 'b', settledAmount: 0.1 },
        { _id: 'c', settledAmount: 0.1 },
    ], 1);
    assert.equal(ledger.settledToDate, 0.3);
}

console.log('settlementService.buildLedger fold check: all assertions passed');

// --- buildLedger: the reversal net-out (Requirement 7.2) ---

// A reversal row and the row it targets both contribute zero.
{
    const ledger = buildLedger([
        { _id: 'a', settledAmount: 3000 },
        { _id: 'r', settledAmount: -3000, isReversalOf: 'a' },
        { _id: 'b', settledAmount: 1000 },
    ], 5000);
    assert.equal(ledger.settledToDate, 1000);
    assert.equal(ledger.outstandingAmount, 4000);
    assert.equal(ledger.state, 'partially_settled');
}

// A listing whose only entry has been reversed reads as not_settled (Req 1.6).
{
    const ledger = buildLedger([
        { _id: 'a', settledAmount: 3000 },
        { _id: 'r', settledAmount: -3000, isReversalOf: 'a' },
    ], 5000);
    assert.equal(ledger.settledToDate, 0);
    assert.equal(ledger.state, 'not_settled');
    assert.equal(ledger.outstandingAmount, 5000);
}

// A reversal whose stored amount does not exactly mirror its target still cannot
// shift the total: both rows are skipped, so the pair nets out regardless.
{
    const ledger = buildLedger([
        { _id: 'a', settledAmount: 3000 },
        { _id: 'r', settledAmount: -2500, isReversalOf: 'a' },
        { _id: 'b', settledAmount: 1000 },
    ], 5000);
    assert.equal(ledger.settledToDate, 1000);
    // ...and the same holds when the reversal overshoots its target
    const overshoot = buildLedger([
        { _id: 'a', settledAmount: 3000 },
        { _id: 'r', settledAmount: -4000, isReversalOf: 'a' },
        { _id: 'b', settledAmount: 1000 },
    ], 5000);
    assert.equal(overshoot.settledToDate, 1000);
}

// The target is matched by string identity, so an ObjectId-like _id still pairs.
{
    const id = { toString: () => 'objectid-1' };
    const ledger = buildLedger([
        { _id: id, settledAmount: 2000 },
        { _id: 'r', settledAmount: -2000, isReversalOf: 'objectid-1' },
    ], 2000);
    assert.equal(ledger.settledToDate, 0);
    assert.equal(ledger.state, 'not_settled');
}

console.log('settlementService.buildLedger reversal check: all assertions passed');

// --- buildLedger: the state lattice at each boundary (Requirements 1.1, 5.6, 5.7) ---

// not_settled: zero settled, whatever the net payable
assert.equal(buildLedger([{ _id: 'a', settledAmount: 0 }], 5000).state, 'not_settled');

// partially_settled: one paise short is still short
{
    const ledger = buildLedger([{ _id: 'a', settledAmount: 4999.98 }], 5000);
    assert.equal(ledger.state, 'partially_settled');
    assert.equal(ledger.outstandingAmount, 0.02);
    assert.equal(ledger.excessAmount, 0);
}

// fully_settled at exact equality — settling to the rupee is the normal end
// state, not an overpayment (Requirement 5.7)
{
    const ledger = buildLedger([{ _id: 'a', settledAmount: 2000 }, { _id: 'b', settledAmount: 3000 }], 5000);
    assert.deepEqual(ledger, { settledToDate: 5000, outstandingAmount: 0, excessAmount: 0, state: 'fully_settled' });
}

// fully_settled inside the tolerance from either side: sub-paise dust in
// Net_Payable does not become an outstanding balance or an excess (Req 12.3).
// A full paise of gap is outside the tolerance — see the one-paise gap case below.
for (const [settled, netPayable] of [[5000, 5000.004], [5000, 4999.996]]) {
    const ledger = buildLedger([{ _id: 'a', settledAmount: settled }], netPayable);
    assert.equal(ledger.state, 'fully_settled');
    assert.equal(ledger.outstandingAmount, 0);
    assert.equal(ledger.excessAmount, 0);
}

// over_settled: outstanding pinned at zero, the excess reported separately (Req 5.6)
{
    const ledger = buildLedger([{ _id: 'a', settledAmount: 6000 }], 5000);
    assert.deepEqual(ledger, { settledToDate: 6000, outstandingAmount: 0, excessAmount: 1000, state: 'over_settled' });
}

// the one-paise gap case: ₹5,000 recorded against a net payable of ₹4,999.99 is
// over-settled by exactly one paise, with nothing outstanding
{
    const ledger = buildLedger([{ _id: 'a', settledAmount: 5000 }], 4999.99);
    assert.equal(ledger.state, 'over_settled');
    assert.equal(ledger.excessAmount, 0.01);
    assert.equal(ledger.outstandingAmount, 0);
    assert.equal(ledger.settledToDate, 5000);
}

// settled against a zero net payable is over-settled by the whole amount, never
// a negative outstanding balance
{
    const ledger = buildLedger([{ _id: 'a', settledAmount: 100 }], 0);
    assert.deepEqual(ledger, { settledToDate: 100, outstandingAmount: 0, excessAmount: 100, state: 'over_settled' });
}

// outstanding and excess are never both non-zero, and neither is ever negative
for (const [settled, netPayable] of [[0, 5000], [2500, 5000], [5000, 5000], [7500, 5000], [100, 0], [5000, 4999.99]]) {
    const l = buildLedger([{ _id: 'a', settledAmount: settled }], netPayable);
    assert.ok(l.outstandingAmount >= 0 && l.excessAmount >= 0, 'derived figures must be non-negative');
    assert.ok(l.outstandingAmount === 0 || l.excessAmount === 0, 'a ledger cannot be both short and over');
}

console.log('settlementService.buildLedger state lattice check: all assertions passed');

// --- buildLedger: fails closed rather than returning a partial ledger (Req 12.5) ---

// rows must be an array
for (const bad of [undefined, null, 'x', {}, 0]) {
    assert.throws(() => buildLedger(bad, 5000), /must be an array/);
}
// netPayable must be a finite number
for (const bad of [NaN, undefined, null, 'x', Infinity, -Infinity]) {
    assert.throws(() => buildLedger([{ _id: 'a', settledAmount: 100 }], bad), /finite/);
}
// a corrupt settledAmount must not become a settlement basis
for (const bad of [NaN, undefined, null, 'x', Infinity]) {
    assert.throws(() => buildLedger([{ _id: 'a', settledAmount: bad }], 5000), /finite/);
    // ...including on a reversal row, which is skipped for the sum but still checked
    assert.throws(() => buildLedger([
        { _id: 'a', settledAmount: 100 },
        { _id: 'r', settledAmount: bad, isReversalOf: 'a' },
    ], 5000), /finite/);
}

console.log('settlementService.buildLedger fail-closed check: all assertions passed');

// --- checkOverSettlement: the accept/reject split (Requirement 5) ---

// below Net_Payable → accepted with no override
assert.deepEqual(checkOverSettlement({ settledToDate: 1000, netPayable: 5000, settledAmount: 1000 }), { allowed: true });

// at exactly Net_Payable → accepted with no override (Requirement 5.7)
assert.deepEqual(checkOverSettlement({ settledToDate: 4000, netPayable: 5000, settledAmount: 1000 }), { allowed: true });
assert.deepEqual(checkOverSettlement({ settledToDate: 0, netPayable: 5000, settledAmount: 5000 }), { allowed: true });

// inside the tolerance → accepted: sub-paise dust in Net_Payable cannot turn a
// full settlement into a rejection, the same tolerance the ledger folds with
assert.deepEqual(checkOverSettlement({ settledToDate: 0, netPayable: 4999.996, settledAmount: 5000 }), { allowed: true });

// above Net_Payable → 409 carrying the figures the admin needs to correct the
// submission (Requirement 5.2)
{
    const r = checkOverSettlement({ settledToDate: 4000, netPayable: 5000, settledAmount: 1500 });
    assert.equal(r.allowed, false);
    assert.equal(r.status, 409);
    assert.equal(r.code, 'over_settlement');
    assert.equal(r.netPayable, 5000);
    assert.equal(r.settledToDate, 4000);
    assert.equal(r.maxRecordable, 1000);
    assert.match(r.error, /At most ₹1000 can be recorded/);
}

// the one-paise gap the ledger calls over_settled is the one the guard rejects,
// so a transfer can never be waved through and then reported as over_settled
{
    const r = checkOverSettlement({ settledToDate: 0, netPayable: 4999.99, settledAmount: 5000 });
    assert.equal(r.allowed, false);
    assert.equal(r.code, 'over_settlement');
    assert.equal(r.maxRecordable, 4999.99);
}

// an already over-settled listing can record nothing more: maxRecordable floors at 0
{
    const r = checkOverSettlement({ settledToDate: 6000, netPayable: 5000, settledAmount: 100 });
    assert.equal(r.maxRecordable, 0);
}

// an override from anyone other than a super admin is refused, whether or not the
// amount would actually over-settle (Requirement 5.4)
for (const adminRole of ['admin', 'moderator', undefined, null, 'super_Admin']) {
    for (const settledAmount of [100, 9000]) {
        const r = checkOverSettlement({
            settledToDate: 4000, netPayable: 5000, settledAmount,
            override: true, adminRole, overrideReason: 'bank confirmed the extra transfer',
        });
        assert.equal(r.allowed, false);
        assert.equal(r.status, 403);
        assert.equal(r.code, 'override_forbidden');
    }
}

// an override with a blank reason is refused, naming the field (Requirement 5.5)
for (const overrideReason of [undefined, null, '', '   ', '\t\n', 42]) {
    const r = checkOverSettlement({
        settledToDate: 4000, netPayable: 5000, settledAmount: 9000,
        override: true, adminRole: 'super_admin', overrideReason,
    });
    assert.equal(r.allowed, false);
    assert.equal(r.status, 400);
    assert.equal(r.code, 'invalid_override');
    assert.equal(r.field, 'overrideReason');
}

// a super admin with a reason may record the deliberate, documented excess (Req 5.3)
assert.deepEqual(checkOverSettlement({
    settledToDate: 4000, netPayable: 5000, settledAmount: 9000,
    override: true, adminRole: 'super_admin', overrideReason: 'bank confirmed the extra transfer',
}), { allowed: true });

// a falsy override flag is no override at all: the limit still applies
{
    const r = checkOverSettlement({
        settledToDate: 4000, netPayable: 5000, settledAmount: 9000,
        override: false, adminRole: 'super_admin', overrideReason: 'documented',
    });
    assert.equal(r.code, 'over_settlement');
}

// fails closed on a corrupt figure rather than waving a transfer through
for (const bad of [NaN, undefined, null, 'x', Infinity]) {
    assert.throws(() => checkOverSettlement({ settledToDate: bad, netPayable: 5000, settledAmount: 100 }), /finite/);
    assert.throws(() => checkOverSettlement({ settledToDate: 0, netPayable: bad, settledAmount: 100 }), /finite/);
    assert.throws(() => checkOverSettlement({ settledToDate: 0, netPayable: 5000, settledAmount: bad }), /finite/);
}

console.log('settlementService.checkOverSettlement check: all assertions passed');
