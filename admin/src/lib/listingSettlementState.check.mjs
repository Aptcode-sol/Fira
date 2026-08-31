/**
 * Runnable check for the settlement form's state transitions.
 * Run: node src/lib/listingSettlementState.check.mjs
 *
 * The form writes money records, so the two things that must not break are the
 * ones a renderer test would only notice by accident:
 *
 *   - a REJECTED submission keeps every entered value and leaves the displayed
 *     ledger untouched (Requirement 13.5) — losing the values means the admin
 *     retypes an amount they already transferred
 *   - the Idempotency_Key survives a rejection and retry (Requirement 6.1) — a
 *     fresh key on retry turns one bank transfer into two ledger entries
 */
import assert from 'node:assert/strict';
import {
    buildEntryBody,
    initialSettlementState,
    newFormSession,
    settlementReducer,
    successNotice,
} from './listingSettlementState.js';

const LEDGER = {
    state: 'partially_settled',
    money: { netPayable: 50000, settledToDate: 20000, outstandingAmount: 30000 },
    activity: { successfulPayments: 3, refundedPayments: 0 },
    entries: [{ _id: 'e1', settledAmount: 20000 }],
};

const TYPED = {
    settledAmount: '40000',
    settlementReference: 'UTR12345',
    settledAt: '2024-05-01',
    method: 'gateway',
    adminNotes: 'second tranche',
};

/** A ready panel with the ledger above on screen and the form filled in. */
function readyWithTypedForm() {
    let s = settlementReducer(initialSettlementState, { type: 'resolved', data: LEDGER });
    for (const [field, value] of Object.entries(TYPED)) {
        s = settlementReducer(s, { type: 'formChange', field, value });
    }
    return s;
}

/* ---- Requirement 13.5: a rejection preserves the form AND the ledger ---- */
{
    const typed = readyWithTypedForm();
    assert.equal(typed.status, 'ready');

    const submitting = settlementReducer(typed, { type: 'submit', idempotencyKey: 'key-1' });
    assert.equal(submitting.form.submitting, true, 'in flight must disable the control (6.4)');
    assert.equal(submitting.form.error, null, 'a new submission clears the previous message');

    const rejections = [
        { error: 'settledAmount must be a whole number of rupees', body: { field: 'settledAmount' } },
        { error: 'Listing not found', body: null },
        { error: 'Settlement was not recorded', body: {} },
        { error: undefined, body: undefined },
        {
            error: 'Recording 40000 would over-settle this listing',
            body: { code: 'over_settlement', netPayable: 50000, settledToDate: 20000, maxRecordable: 30000 },
        },
    ];

    for (const rejection of rejections) {
        const after = settlementReducer(submitting, { type: 'submitRejected', ...rejection });
        const where = rejection.error || 'no message';

        assert.ok(after.form.error, `${where}: some message must always be shown`);
        if (rejection.error) assert.equal(after.form.error, rejection.error, `${where}: the RETURNED message, verbatim`);
        assert.equal(after.form.submitting, false, `${where}: the control must be usable again`);
        assert.deepEqual(after.form.values, submitting.form.values, `${where}: every entered value must remain`);
        assert.equal(after.data, typed.data, `${where}: the displayed ledger must be the same object`);
        assert.equal(after.status, 'ready', `${where}: a rejected write is not a failed read`);
        assert.equal(after.form.notice, null, `${where}: no success notice alongside a rejection`);

        // Requirement 5.3: the override is offered by the over-settlement
        // rejection and by nothing else.
        const offered = rejection.body?.code === 'over_settlement';
        assert.equal(Boolean(after.form.overSettlement), offered, `${where}: override offered only on over-settlement`);
        if (offered) assert.equal(after.form.overSettlement.maxRecordable, 30000);
    }
}

/* ---- Requirement 6.1: retry after a rejection is the SAME transfer ---- */
{
    const first = settlementReducer(readyWithTypedForm(), { type: 'submit', idempotencyKey: 'key-1' });
    const rejected = settlementReducer(first, { type: 'submitRejected', error: 'nope', body: null });
    const retry = settlementReducer(rejected, { type: 'submit', idempotencyKey: 'key-2' });
    assert.equal(retry.form.idempotencyKey, 'key-1', 'a retry must reuse the session key, not mint a new one');

    // A recorded transfer ends the session: fields clear, next submit needs a new key.
    const done = settlementReducer(retry, { type: 'submitSucceeded', result: { alreadyRecorded: false, notified: true } });
    assert.equal(done.form.idempotencyKey, null);
    assert.deepEqual(done.form.values, newFormSession().values, 'a success clears the form');
    assert.equal(done.data, rejected.data, 'the ledger is refreshed by the refetch, not by this action');
    const next = settlementReducer(done, { type: 'submit', idempotencyKey: 'key-3' });
    assert.equal(next.form.idempotencyKey, 'key-3', 'a new session takes a new key');
}

/* ---- the refetch after a success must not swallow the notice ---- */
{
    const done = settlementReducer(readyWithTypedForm(), { type: 'submitSucceeded', result: { alreadyRecorded: true } });
    const loading = settlementReducer(done, { type: 'fetch' });
    assert.equal(loading.status, 'loading');
    assert.equal(loading.data, null, 'no stale figures under the spinner (13.4)');
    assert.equal(loading.form.notice, done.form.notice, 'the notice must survive the refetch it triggered');

    const resolved = settlementReducer(loading, { type: 'resolved', data: LEDGER });
    assert.match(resolved.form.notice, /Already recorded/, 'Requirement 6.5');
    const failed = settlementReducer(loading, { type: 'failed', error: 'boom' });
    assert.equal(failed.status, 'error');
    assert.equal(failed.form.notice, done.form.notice);
}

/* ---- Requirements 6.5 / 10.4 / 10.5: every accepted outcome reads as success ---- */
assert.match(successNotice({ notified: true }), /^Settlement recorded\./);
assert.match(successNotice({ alreadyRecorded: true, notified: true }), /Already recorded/);
assert.match(successNotice({ notified: false }), /could not be notified/);
assert.match(successNotice({ notified: false, recipientMissing: true }), /No owner could be notified/);
assert.match(successNotice(undefined), /^Settlement recorded\./);

/* ---- the request body ---- */
{
    const typed = readyWithTypedForm();
    const body = buildEntryBody({ ...typed.form, idempotencyKey: 'key-1' });
    assert.deepEqual(body, {
        settledAmount: 40000,
        settlementReference: 'UTR12345',
        settledAt: '2024-05-01',
        method: 'gateway',
        idempotencyKey: 'key-1',
        adminNotes: 'second tranche',
    });
    assert.equal(typeof body.settledAmount, 'number', 'whole rupees, not the input string (4.6)');

    // An empty notes field is omitted rather than sent as ''.
    const noNotes = buildEntryBody({ ...typed.form, values: { ...typed.form.values, adminNotes: '   ' } });
    assert.equal('adminNotes' in noNotes, false);

    // A stale override flag must not ride along on an unrelated submission: for
    // a non-super_admin the server answers that with a 403, which the API helper
    // reads as an expired session and signs the admin out.
    const staleOverride = { ...typed.form, values: { ...typed.form.values, override: true, overrideReason: 'why' } };
    assert.equal('override' in buildEntryBody(staleOverride), false, 'no standing over-settlement ⇒ no override');

    const offered = { ...staleOverride, overSettlement: { netPayable: 1, settledToDate: 1, maxRecordable: 0 } };
    assert.equal(buildEntryBody(offered).override, true);
    assert.equal(buildEntryBody(offered).overrideReason, 'why');
}

/* ---- the reversal control: one row at a time, reason kept on rejection ---- */
{
    const open = settlementReducer(readyWithTypedForm(), { type: 'reverseTarget', entryId: 'e1' });
    assert.equal(open.form.reversal.entryId, 'e1');
    assert.deepEqual(open.form.values, readyWithTypedForm().form.values, 'opening a reversal must not touch the form');

    const withReason = settlementReducer(open, { type: 'reverseReason', value: 'wrong account' });
    const sending = settlementReducer(withReason, { type: 'reverseSubmit' });
    assert.equal(sending.form.reversal.submitting, true);

    const failed = settlementReducer(sending, { type: 'reverseFailed', error: 'Entry already reversed' });
    assert.equal(failed.form.reversal.reason, 'wrong account', 'the typed reason must survive a rejection');
    assert.equal(failed.form.reversal.error, 'Entry already reversed');
    assert.equal(failed.data, open.data, 'a rejected reversal leaves the displayed ledger alone');

    const ok = settlementReducer(sending, { type: 'reverseSucceeded' });
    assert.equal(ok.form.reversal.entryId, null, 'a successful reversal closes the row');
    assert.equal(ok.form.reversal.reason, '');

    // Switching rows drops the half-typed reason for the row being abandoned.
    const other = settlementReducer(withReason, { type: 'reverseTarget', entryId: 'e2' });
    assert.equal(other.form.reversal.reason, '');
}

/* ---- an unknown action is inert ---- */
{
    const s = readyWithTypedForm();
    assert.equal(settlementReducer(s, { type: 'nonsense' }), s);
}

console.log('listingSettlementState.check.mjs: all assertions passed');
