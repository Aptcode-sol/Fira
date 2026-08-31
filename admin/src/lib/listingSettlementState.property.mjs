/**
 * Feature: per-listing-settlement-tracking, Property 19: Exactly one surface
 * state is shown.
 *
 * For any retrieval outcome and any transition between outcomes, the settlement
 * surfaces render exactly one of a loading, empty, error, or populated
 * indication, and no money figure is rendered while in the loading or error
 * state.
 *
 * Under test: `settlementReducer`, `initialSettlementState` and `hasNoRecords`
 * from `./listingSettlementState.js` — the real module, imported, not a copy.
 * The reducer IS the state machine the panel renders from, so driving it
 * directly covers the property without a renderer (the `admin` package has no
 * test runner and no DOM; adding either to assert a switch statement would be
 * more machinery than subject).
 *
 * Run: node src/lib/listingSettlementState.property.mjs
 *
 * The generator is EXHAUSTIVE rather than random for the bounded part: every
 * action sequence up to depth 5 over an 18-action alphabet (~2M reachable
 * states, including the form and reversal actions), then seeded pseudo-random
 * walks of depth 40 with randomised payloads for the long tail. Exhaustive
 * enumeration is the stronger form of the same property — nothing up to that
 * depth escapes, no shrinking needed, and the counterexample is the trail.
 *
 * `listingSettlementState.check.mjs` covers the form-preservation and
 * idempotency-key behaviour with worked examples; this file asserts only the
 * two surface clauses, over all sequences instead of chosen ones.
 *
 * Validates: Requirements 13.1, 13.2, 13.3
 */
import assert from 'node:assert/strict';
import {
    hasNoRecords,
    initialSettlementState,
    settlementReducer,
} from './listingSettlementState.js';

/** The four mutually exclusive surface states of Requirement 13. */
const SURFACES = ['loading', 'ready', 'empty', 'error'];

/** Only a retrieval outcome may move the surface between states (13.1–13.4). */
const RETRIEVAL = new Set(['fetch', 'resolved', 'failed']);

const POPULATED = {
    state: 'partially_settled',
    money: { netPayable: 50000, settledToDate: 20000, outstandingAmount: 30000 },
    activity: { successfulPayments: 3, refundedPayments: 0 },
    entries: [{ _id: 'e1', settledAmount: 20000 }],
};

const REFUNDS_ONLY = { money: { netPayable: 0 }, activity: { successfulPayments: 0, refundedPayments: 2 }, entries: [] };

const ZERO = { money: { netPayable: 0, settledToDate: 0, outstandingAmount: 0 }, activity: { successfulPayments: 0, refundedPayments: 0 }, entries: [] };

const seen = { loading: 0, ready: 0, empty: 0, error: 0 };

/**
 * The property, asserted at every reachable state.
 *
 * @param {object} state Reducer output.
 * @param {string[]} trail The action sequence that produced it — the counterexample.
 */
function assertExactlyOneSurface(state, trail) {
    const where = trail.join(' > ') || '(initial)';

    // ---- exactly one of the four indications ----
    // A renderer picks its branch from `status` alone, so "exactly one" is
    // decidable here: one tagged field, one of four values, and the fields that
    // feed the other three branches must be empty in each case.
    const shown = SURFACES.filter((s) => s === state.status);
    assert.equal(shown.length, 1, `${where}: status must be exactly one of ${SURFACES} — got ${JSON.stringify(state.status)}`);
    seen[state.status] += 1;

    switch (state.status) {
        // 13.1: while retrieving, a loading indication and NEITHER an
        // empty-state nor an error indication. `data === null` is also the
        // second clause: no money figure can be rendered with nothing to
        // render from (13.4 — no stale figures under the spinner).
        case 'loading':
            assert.equal(state.data, null, `${where}: loading must carry no figures`);
            assert.equal(state.error, null, `${where}: loading must not carry an error indication`);
            break;

        // 13.3: an error indication INSTEAD of figures — never stale or partial
        // figures presented as current, and always a message to show, so the
        // error branch is never a blank panel.
        case 'error':
            assert.equal(state.data, null, `${where}: an error must not display stale or partial figures`);
            assert.equal(typeof state.error, 'string', `${where}: the error branch needs a message`);
            assert.ok(state.error.length > 0, `${where}: the error branch needs a non-empty message`);
            break;

        // 13.2: the empty state is a KNOWN zero — retrieval succeeded and the
        // listing genuinely has no payments and no entries. Cross-checked
        // against `hasNoRecords` so an empty indication can never stand in for
        // a failure.
        case 'empty':
            assert.equal(state.error, null, `${where}: empty must not carry an error indication`);
            assert.ok(hasNoRecords(state.data), `${where}: empty may only be shown for a listing with no records`);
            break;

        // The populated indication needs something to populate it with.
        case 'ready':
            assert.equal(state.error, null, `${where}: populated must not carry an error indication`);
            assert.notEqual(state.data, null, `${where}: populated needs figures to render`);
            assert.equal(hasNoRecords(state.data), false, `${where}: a listing with no records belongs in empty, not populated`);
            break;
    }

    assert.ok(state.form, `${where}: the form must survive every transition`);
}

/**
 * The transition clause: only a retrieval outcome moves the surface. A form or
 * reversal action must leave both the indication and the figures behind it
 * byte-identical, so typing in the form can never flip the panel out of the
 * state its retrieval put it in.
 */
function assertTransition(before, action, after, trail) {
    if (RETRIEVAL.has(action.type)) {
        if (action.type === 'fetch') {
            // 13.4: retry returns to loading, from wherever it was.
            assert.equal(after.status, 'loading', `${trail.join(' > ')}: a (re)fetch must return to loading`);
        }
        return;
    }
    const where = trail.join(' > ');
    assert.equal(after.status, before.status, `${where}: a non-retrieval action must not change the indication`);
    assert.equal(after.data, before.data, `${where}: a non-retrieval action must not change the figures`);
    assert.equal(after.error, before.error, `${where}: a non-retrieval action must not change the error`);
}

/** The action alphabet, exhaustively enumerated below. */
const ALPHABET = [
    ['fetch', { type: 'fetch' }],
    ['resolved(populated)', { type: 'resolved', data: POPULATED }],
    ['resolved(refunds only)', { type: 'resolved', data: REFUNDS_ONLY }],
    ['resolved(zero)', { type: 'resolved', data: ZERO }],
    ['resolved(null)', { type: 'resolved', data: null }],
    ['resolved(undefined)', { type: 'resolved' }],
    ['failed(boom)', { type: 'failed', error: 'boom' }],
    ['failed(no message)', { type: 'failed' }],
    ['formChange(amount)', { type: 'formChange', field: 'settledAmount', value: '40000' }],
    ['formChange(override)', { type: 'formChange', field: 'override', value: true }],
    ['submit', { type: 'submit', idempotencyKey: 'key-1' }],
    ['submitRejected(over)', { type: 'submitRejected', error: 'would over-settle', body: { code: 'over_settlement', netPayable: 50000, settledToDate: 20000, maxRecordable: 30000 } }],
    ['submitRejected(plain)', { type: 'submitRejected', error: 'Listing not found', body: null }],
    ['submitSucceeded', { type: 'submitSucceeded', result: { alreadyRecorded: true, notified: false } }],
    ['reverseTarget(e1)', { type: 'reverseTarget', entryId: 'e1' }],
    ['reverseReason', { type: 'reverseReason', value: 'wrong account' }],
    ['reverseSubmit', { type: 'reverseSubmit' }],
    ['reverseFailed', { type: 'reverseFailed', error: 'Entry already reversed' }],
    ['reverseSucceeded', { type: 'reverseSucceeded' }],
    ['unknown', { type: 'nonsense' }],
];

/* ---- every action sequence up to depth 5, from the initial state ---- */
const DEPTH = 5;
let states = 0;

assertExactlyOneSurface(initialSettlementState, []);

function walk(state, trail) {
    if (trail.length === DEPTH) return;
    for (const [label, action] of ALPHABET) {
        const next = settlementReducer(state, action);
        trail.push(label);
        states += 1;
        assertExactlyOneSurface(next, trail);
        assertTransition(state, action, next, trail);
        walk(next, trail);
        trail.pop();
    }
}
walk(initialSettlementState, []);

/* ---- seeded pseudo-random walks, far deeper and with generated payloads ---- */
// Depth 5 cannot reach every ordering; these go to 40 with amounts, counts,
// entry ids and messages drawn from the generator rather than fixed above.
let seed = 0x2f6e2b1;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const int = (n) => Math.floor(rnd() * n);
const pick = (a) => a[int(a.length)];

const randomDto = () => pick([
    null,
    undefined,
    {},
    { activity: {}, entries: [] },
    {
        state: pick(['unsettled', 'partially_settled', 'settled', 'over_settled']),
        money: { netPayable: int(200000), settledToDate: int(200000), outstandingAmount: int(200000) },
        activity: { successfulPayments: int(3), refundedPayments: int(3) },
        entries: Array.from({ length: int(3) }, (_, i) => ({ _id: `e${i}`, settledAmount: int(50000) })),
    },
]);

const randomAction = () => {
    switch (pick(['fetch', 'resolved', 'failed', 'formChange', 'submit', 'submitRejected', 'submitSucceeded', 'reverseTarget', 'reverseReason', 'reverseSubmit', 'reverseFailed', 'reverseSucceeded', 'nonsense'])) {
        case 'resolved': return { type: 'resolved', data: randomDto() };
        case 'failed': return { type: 'failed', error: pick(['boom', '', undefined, null, 'Failed to fetch']) };
        case 'formChange': return { type: 'formChange', field: pick(['settledAmount', 'settlementReference', 'settledAt', 'method', 'adminNotes', 'override', 'overrideReason']), value: pick([String(int(100000)), '', true, false, 'UTR123']) };
        case 'submit': return { type: 'submit', idempotencyKey: pick([`key-${int(5)}`, null, undefined]) };
        case 'submitRejected': return { type: 'submitRejected', error: pick(['nope', '', undefined]), body: pick([null, undefined, {}, { field: 'settledAmount' }, { code: 'over_settlement', netPayable: int(9999), settledToDate: int(9999), maxRecordable: int(9999) }]) };
        case 'submitSucceeded': return { type: 'submitSucceeded', result: pick([undefined, { alreadyRecorded: true }, { notified: false }, { notified: false, recipientMissing: true }]) };
        case 'reverseTarget': return { type: 'reverseTarget', entryId: pick(['e0', 'e1', null, undefined]) };
        case 'reverseReason': return { type: 'reverseReason', value: pick(['', 'wrong account', 'duplicate']) };
        case 'reverseFailed': return { type: 'reverseFailed', error: pick(['already reversed', '', undefined]) };
        default: return { type: pick(['fetch', 'reverseSubmit', 'reverseSucceeded', 'nonsense']) };
    }
};

for (let walkNo = 0; walkNo < 4000; walkNo++) {
    let state = initialSettlementState;
    const trail = [`walk ${walkNo}`];
    for (let step = 0; step < 40; step++) {
        const action = randomAction();
        const next = settlementReducer(state, action);
        trail.push(`${action.type}${action.error !== undefined ? `(${JSON.stringify(action.error)})` : ''}`);
        states += 1;
        assertExactlyOneSurface(next, trail);
        assertTransition(state, action, next, trail);
        state = next;
    }
}

/* ---- the enumeration must actually have visited all four surfaces ---- */
// Without this, a reducer that only ever returned 'loading' would pass every
// assertion above.
for (const surface of SURFACES) {
    assert.ok(seen[surface] > 0, `the walk never reached '${surface}' — the property held vacuously`);
}

console.log(`listingSettlementState.property.mjs: Property 19 holds over ${states.toLocaleString()} reachable states`);
console.log(`  surfaces visited: ${SURFACES.map((s) => `${s}=${seen[s].toLocaleString()}`).join(', ')}`);
