/**
 * Feature: per-listing-settlement-tracking, Property 20: A rejected submission
 * preserves the form and the ledger.
 *
 * For any values entered into the settlement form and any rejection returned for
 * them, the surface displays the returned error message, every entered value
 * remains in its field, and the displayed Settlement_Ledger is unchanged.
 *
 * Under test: `settlementReducer` from `./listingSettlementState.js` — the real
 * module, imported, not a copy. The reducer IS what the panel renders from, so
 * `submit`/`submitRejected` (and the reversal equivalents `reverseSubmit`/
 * `reverseFailed`, which reject the same way) cover the property without a
 * renderer. The `admin` package has no test runner and no DOM; adding either to
 * assert a switch statement would be more machinery than subject.
 *
 * Run: node src/lib/listingSettlementState.rejection.property.mjs
 *
 * The generator is EXHAUSTIVE over a bounded space: the full cartesian product
 * of per-field candidate values (typed in through `formChange`, not spliced into
 * the state) crossed with every rejection payload shape the API can answer with,
 * crossed with each surface the panel can be sitting on. Then seeded
 * pseudo-random cases with generated strings, amounts and figures for the long
 * tail. Exhaustive enumeration needs no shrinking — the counterexample is the
 * case label itself.
 *
 * Why this matters at all: losing the entered values means the admin retypes an
 * amount they have already transferred out of a real bank account, and a ledger
 * that shifts under a rejection tells them a write landed when it did not
 * (Requirement 4.11 — the insert that fails after the audit write leaves the
 * ledger alone).
 *
 * `listingSettlementState.check.mjs` covers this with a handful of worked
 * examples plus the Idempotency_Key behaviour; Property 19
 * (`listingSettlementState.property.mjs`) covers the four surface states over
 * all action sequences. This file asserts only Property 20's three clauses, over
 * all form/rejection combinations instead of chosen ones.
 *
 * Validates: Requirements 13.5, 4.11
 */
import assert from 'node:assert/strict';
import { initialSettlementState, settlementReducer } from './listingSettlementState.js';

/** Deep-frozen so a reducer that mutated the displayed ledger would throw here. */
const deepFreeze = (o) => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
        Object.freeze(o);
        for (const v of Object.values(o)) deepFreeze(v);
    }
    return o;
};

const POPULATED = deepFreeze({
    state: 'partially_settled',
    money: { netPayable: 50000, settledToDate: 20000, outstandingAmount: 30000 },
    activity: { successfulPayments: 3, refundedPayments: 0 },
    entries: [{ _id: 'e1', settledAmount: 20000 }, { _id: 'e2', settledAmount: 0, reversed: true }],
});

const ZERO = deepFreeze({
    money: { netPayable: 0, settledToDate: 0, outstandingAmount: 0 },
    activity: { successfulPayments: 0, refundedPayments: 0 },
    entries: [],
});

/**
 * The surfaces a rejection can arrive on. A record can be attempted from a
 * populated or an empty panel, and a rejection can also land after the panel has
 * dropped its figures (a failed refetch, or the very first load) — the clause
 * "the displayed ledger is unchanged" has to hold for `data: null` too.
 */
const BASES = [
    ['ready', { type: 'resolved', data: POPULATED }],
    ['empty', { type: 'resolved', data: ZERO }],
    ['error', { type: 'failed', error: 'Failed to load settlement' }],
    ['loading', null],
];

/** Candidate values per field. The cartesian product of these is the form space. */
const FIELD_VALUES = {
    settledAmount: ['', '0', '40000', '99999999', '-1', 'not a number'],
    settlementReference: ['', 'UTR12345', '   ', 'ref/with/slashes'],
    settledAt: ['', '2024-05-01', '2099-01-01'],
    method: ['manual', 'gateway', ''],
    adminNotes: ['', 'second tranche', '   '],
    override: [false, true],
    overrideReason: ['', 'owner confirmed receipt'],
};

const FIELDS = Object.keys(FIELD_VALUES);

/** Every combination of the candidates above — 6·4·3·3·3·2·2 = 5,184 forms. */
function* formSpace() {
    const idx = FIELDS.map(() => 0);
    for (;;) {
        yield FIELDS.map((f, i) => [f, FIELD_VALUES[f][idx[i]]]);
        let k = FIELDS.length - 1;
        while (k >= 0 && ++idx[k] === FIELD_VALUES[FIELDS[k]].length) idx[k--] = 0;
        if (k < 0) return;
    }
}

/**
 * Every rejection shape the record endpoint can answer with, per the design's
 * failure table: field-named 400s, the over-settlement 409 with its figures, the
 * 500 that leaves the ledger unchanged (4.11), a bare rejection with no body at
 * all, and a rejection with no message.
 */
const REJECTIONS = [
    ['400 field settledAmount', { error: 'settledAmount must be a whole number of rupees', body: { field: 'settledAmount' } }],
    ['400 field settlementReference', { error: 'settlementReference is required', body: { field: 'settlementReference' } }],
    ['400 field settledAt', { error: 'settledAt may not be in the future', body: { field: 'settledAt' } }],
    ['400 reversal target', { error: 'Target is a reversal', body: {} }],
    ['404 not found', { error: 'Listing not found', body: {} }],
    ['409 over-settlement', {
        error: 'Recording 40000 would over-settle this listing',
        body: { code: 'over_settlement', netPayable: 50000, settledToDate: 20000, maxRecordable: 30000 },
    }],
    ['409 over-settlement, fully settled', {
        error: 'This listing is already settled in full',
        body: { code: 'over_settlement', netPayable: 50000, settledToDate: 50000, maxRecordable: 0 },
    }],
    ['500 insert failed after audit (4.11)', { error: 'Settlement was not recorded', body: {} }],
    ['500 audit write failed', { error: 'Settlement not recorded: audit write failed', body: null }],
    ['bare rejection, no body', { error: 'Something went wrong' }],
    ['bare rejection, null body', { error: 'Network request failed', body: null }],
    ['no message, no body', {}],
    ['no message, empty body', { error: undefined, body: {} }],
    ['no message, empty string', { error: '', body: { field: 'settledAmount' } }],
    ['no message, null', { error: null, body: null }],
    ['no message, over-settlement', { body: { code: 'over_settlement', netPayable: 1, settledToDate: 1, maxRecordable: 0 } }],
];

const counts = { record: 0, reversal: 0, verbatim: 0, fallback: 0, overSettlement: 0, fieldNamed: 0 };
/** The fallback must be one stable sentence, not whatever the caller passed. */
let recordFallback = null;
let reversalFallback = null;

/**
 * Clause 1 for a rejected record: the RETURNED message is displayed verbatim
 * when one was returned, and a non-empty fallback stands in when none was.
 */
function assertMessage(returned, shown, fallbackSlot, where) {
    assert.equal(typeof shown, 'string', `${where}: some message must always be shown`);
    assert.ok(shown.length > 0, `${where}: the message must not be empty`);
    if (returned) {
        assert.equal(shown, returned, `${where}: the returned message, verbatim`);
        counts.verbatim += 1;
        return fallbackSlot;
    }
    counts.fallback += 1;
    if (fallbackSlot === null) return shown;
    assert.equal(shown, fallbackSlot, `${where}: the fallback message must be stable`);
    return fallbackSlot;
}

/** Clause 2: every entered value is still in its field — same keys, same values. */
function assertValuesPreserved(before, after, where) {
    assert.deepEqual(
        Object.keys(after.form.values),
        Object.keys(before.form.values),
        `${where}: no field may be dropped or added by a rejection`,
    );
    for (const [field, value] of Object.entries(before.form.values)) {
        assert.equal(after.form.values[field], value, `${where}: ${field} must keep the entered value`);
    }
}

/** Clause 3: the displayed Settlement_Ledger is unchanged — the same object. */
function assertLedgerUnchanged(before, after, where) {
    assert.ok(Object.is(after.data, before.data), `${where}: the displayed ledger must be the same object`);
    assert.equal(after.status, before.status, `${where}: a rejected write is not a failed read`);
    assert.equal(after.error, before.error, `${where}: a rejected write must not touch the retrieval error`);
}

/** A panel on `base` with `entries` typed into the form through the reducer. */
function typed(baseAction, entries) {
    let s = baseAction ? settlementReducer(initialSettlementState, baseAction) : initialSettlementState;
    for (const [field, value] of entries) s = settlementReducer(s, { type: 'formChange', field, value });
    return s;
}

/** One case: type the form, submit, get rejected, assert all three clauses. */
function checkRecord(baseLabel, baseAction, entries, rejectionLabel, rejection, viaSubmit) {
    const where = `${baseLabel} / ${rejectionLabel} / ${viaSubmit ? 'after submit' : 'unsolicited'} / ${JSON.stringify(Object.fromEntries(entries))}`;
    const before = viaSubmit
        ? settlementReducer(typed(baseAction, entries), { type: 'submit', idempotencyKey: 'key-1' })
        : typed(baseAction, entries);
    const after = settlementReducer(before, { type: 'submitRejected', ...rejection });
    counts.record += 1;

    recordFallback = assertMessage(rejection.error, after.form.error, recordFallback, where);
    assertValuesPreserved(before, after, where);
    assertLedgerUnchanged(before, after, where);

    // The rest of the rejected-form contract, which the three clauses lean on:
    // the control has to be usable again for the retry the message asks for, and
    // there must be no success notice standing next to a failure.
    assert.equal(after.form.submitting, false, `${where}: the submit control must be usable again`);
    assert.equal(after.form.notice, null, `${where}: no success notice alongside a rejection`);
    assert.equal(after.form.idempotencyKey, before.form.idempotencyKey, `${where}: the session key must survive (6.1)`);
    assert.deepEqual(after.form.reversal, before.form.reversal, `${where}: a rejected record must not touch the reversal row`);

    // The field the server named is carried through so the input can be marked;
    // the override is offered by the over-settlement guard and by nothing else.
    const named = rejection.body?.field ?? null;
    assert.equal(after.form.field, named, `${where}: the offending field name must be the one returned`);
    if (named) counts.fieldNamed += 1;

    const over = rejection.body?.code === 'over_settlement';
    assert.equal(Boolean(after.form.overSettlement), over, `${where}: override offered only on over-settlement (5.3)`);
    if (over) {
        assert.deepEqual(
            after.form.overSettlement,
            {
                netPayable: rejection.body.netPayable,
                settledToDate: rejection.body.settledToDate,
                maxRecordable: rejection.body.maxRecordable,
            },
            `${where}: the returned figures must be shown as returned`,
        );
        counts.overSettlement += 1;
    }
}

/** The reversal equivalent: same three clauses, reason instead of the form. */
function checkReversal(baseLabel, baseAction, entries, entryId, reason, message) {
    const where = `${baseLabel} / reversal ${JSON.stringify({ entryId, reason, message })}`;
    let s = typed(baseAction, entries);
    s = settlementReducer(s, { type: 'reverseTarget', entryId });
    s = settlementReducer(s, { type: 'reverseReason', value: reason });
    const before = settlementReducer(s, { type: 'reverseSubmit' });
    const after = settlementReducer(before, { type: 'reverseFailed', error: message });
    counts.reversal += 1;

    reversalFallback = assertMessage(message, after.form.reversal.error, reversalFallback, where);
    assertValuesPreserved(before, after, where);
    assertLedgerUnchanged(before, after, where);
    assert.equal(after.form.reversal.reason, reason, `${where}: the typed reason must remain in its field`);
    assert.equal(after.form.reversal.entryId, entryId, `${where}: the rejected row must stay open`);
    assert.equal(after.form.reversal.submitting, false, `${where}: the reversal control must be usable again`);
}

/* ---- exhaustive: every form × every rejection shape × every surface ---- */
for (const entries of formSpace()) {
    for (const [baseLabel, baseAction] of BASES) {
        for (const [rejectionLabel, rejection] of REJECTIONS) {
            checkRecord(baseLabel, baseAction, entries, rejectionLabel, rejection, true);
        }
    }
    // A rejection that arrives without a preceding `submit` in this state (a
    // late answer to an earlier attempt) must preserve just as much.
    checkRecord('ready', BASES[0][1], entries, REJECTIONS[5][0], REJECTIONS[5][1], false);
    checkReversal('ready', BASES[0][1], entries, 'e1', 'wrong account', 'Entry already reversed');
}

/* ---- seeded pseudo-random: generated strings, amounts and figures ---- */
let seed = 0x51a3c7d;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const int = (n) => Math.floor(rnd() * n);
const pick = (a) => a[int(a.length)];
const text = () => Array.from({ length: int(12) }, () => String.fromCharCode(32 + int(95))).join('');

const randomEntries = () => FIELDS.map((f) => [
    f,
    f === 'override' ? rnd() < 0.5 : pick([text(), String(int(1000000)), String(int(100) / 10), '']),
]);

const randomRejection = () => ({
    error: pick([text(), '', undefined, null, `₹${int(99999)} would over-settle this listing`]),
    body: pick([
        undefined,
        null,
        {},
        { field: pick([...FIELDS, 'idempotencyKey', 'overrideReason']) },
        { code: 'over_settlement', netPayable: int(500000), settledToDate: int(500000), maxRecordable: int(500000) },
        { code: pick(['duplicate', 'forbidden', '']), field: pick([undefined, 'settledAmount']) },
    ]),
});

for (let i = 0; i < 6000; i++) {
    const [baseLabel, baseAction] = pick(BASES);
    const entries = randomEntries();
    checkRecord(baseLabel, baseAction, entries, `random #${i}`, randomRejection(), rnd() < 0.5);
    checkReversal(baseLabel, baseAction, entries, pick(['e1', 'e2', null]), pick([text(), '']), pick([text(), '', undefined, null]));
}

/* ---- the enumeration must actually have exercised each branch ---- */
// Without this, a generator that only ever produced one rejection shape would
// pass everything above.
for (const [name, n] of Object.entries(counts)) {
    assert.ok(n > 0, `no case exercised '${name}' — the property held vacuously`);
}
assert.equal(typeof recordFallback, 'string', 'the no-message case never ran for a record');
assert.equal(typeof reversalFallback, 'string', 'the no-message case never ran for a reversal');

console.log(`listingSettlementState.rejection.property.mjs: Property 20 holds over ${(counts.record + counts.reversal).toLocaleString()} rejections`);
console.log(`  records=${counts.record.toLocaleString()}, reversals=${counts.reversal.toLocaleString()}, verbatim messages=${counts.verbatim.toLocaleString()}, fallback messages=${counts.fallback.toLocaleString()}`);
console.log(`  over-settlement 409s=${counts.overSettlement.toLocaleString()}, field-named 400s=${counts.fieldNamed.toLocaleString()}`);
console.log(`  fallbacks: record="${recordFallback}", reversal="${reversalFallback}"`);
