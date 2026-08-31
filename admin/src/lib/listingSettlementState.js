/**
 * The settlement panel's view state, as a reducer.
 *
 * Requirement 13 asks for four MUTUALLY EXCLUSIVE surface states —
 * `loading | ready | empty | error`. Independent booleans (`loading`, `error`,
 * `data`) can hold two of those at once, which is exactly the failure the
 * requirement names: a reader mistaking a failure for a zero balance. So the
 * status is ONE tagged field, and the only way to change it is an action here.
 *
 * Plain ESM with no JSX, like `pageWindow.js`, so bare `node` and a property
 * test can import this exact module rather than a copy of it — a check that
 * duplicates its subject passes while the subject rots.
 *
 * Mirrors the pattern `client/src/app/dashboard/creator/earnings/page.tsx`
 * already uses for the same four states.
 */

/** @typedef {'loading' | 'ready' | 'empty' | 'error'} SettlementStatus */

/**
 * @typedef {object} SettlementFormState
 * @property {object} values The record form's fields, exactly as typed.
 * @property {string | null} idempotencyKey Generated once per form session (Requirement 6.4).
 * @property {boolean} submitting True while a record request is in flight.
 * @property {string | null} error The rejection message to show (Requirement 13.5).
 * @property {string | null} field The offending field name the server named, if any.
 * @property {{ netPayable: number, settledToDate: number, maxRecordable: number } | null} overSettlement
 *   Set only by an over-settlement rejection — the one condition that may offer the override.
 * @property {string | null} notice The post-success message ("Already recorded", owner not notified).
 * @property {{ entryId: string | null, reason: string, submitting: boolean, error: string | null }} reversal
 */

/**
 * @typedef {object} SettlementViewState
 * @property {SettlementStatus} status Exactly one surface state.
 * @property {object | null} data The admin settlement DTO, only ever set alongside `ready`/`empty`.
 * @property {string | null} error The message to show, only ever set alongside `error`.
 * @property {SettlementFormState} form The record form, which survives a refetch.
 */

const EMPTY_VALUES = {
    settledAmount: '',
    settlementReference: '',
    settledAt: '',
    method: 'manual',
    adminNotes: '',
    override: false,
    overrideReason: '',
};

const EMPTY_REVERSAL = { entryId: null, reason: '', submitting: false, error: null };

/**
 * A fresh form session. The Idempotency_Key is passed in rather than generated
 * here: `crypto.randomUUID()` at module scope would hand every listing in the
 * app one key for the tab's lifetime, which is the opposite of what Requirement
 * 6.1 wants. Keeping it a parameter also keeps this module pure and checkable.
 *
 * @param {string | null} [idempotencyKey]
 * @returns {SettlementFormState}
 */
export function newFormSession(idempotencyKey = null) {
    return {
        values: { ...EMPTY_VALUES },
        idempotencyKey,
        submitting: false,
        error: null,
        field: null,
        overSettlement: null,
        notice: null,
        reversal: { ...EMPTY_REVERSAL },
    };
}

/** @type {SettlementViewState} */
export const initialSettlementState = { status: 'loading', data: null, error: null, form: newFormSession() };

const FETCH_FAILED = 'Failed to load settlement';
const RECORD_FAILED = 'Settlement was not recorded';
const REVERSAL_FAILED = 'Reversal was not recorded';

/**
 * Retrieval succeeded but the listing has nothing to show (Requirement 13.2) —
 * no payments collected and no settlement recorded. Distinct from `error`: this
 * is a known zero, not an unknown.
 *
 * @param {object | null | undefined} dto Admin settlement DTO.
 * @returns {boolean}
 */
export function hasNoRecords(dto) {
    const activity = dto?.activity ?? {};
    return (
        (activity.successfulPayments || 0) === 0 &&
        (activity.refundedPayments || 0) === 0 &&
        (dto?.entries?.length || 0) === 0
    );
}

/**
 * What to tell the admin after a settlement was accepted. The three cases the
 * service can return are all successes — a duplicate submission (Requirement
 * 6.5) and an undeliverable notification (10.4, 10.5) both leave a real entry
 * on the ledger, so none of them is an error.
 *
 * @param {{ alreadyRecorded?: boolean, notified?: boolean, recipientMissing?: boolean }} result
 * @returns {string}
 */
export function successNotice(result) {
    const suffix = result?.recipientMissing
        ? ' No owner could be notified — this listing has no resolvable recipient.'
        : result?.notified === false
            ? ' The owner could not be notified.'
            : '';
    const head = result?.alreadyRecorded
        ? 'Already recorded — this settlement was on the ledger already, so nothing was added.'
        : 'Settlement recorded.';
    return head + suffix;
}

/**
 * The request body for `adminApi.recordSettlement`, built from the form.
 *
 * `override` travels ONLY while an over-settlement rejection is standing. A
 * stale flag left over from an earlier rejection would otherwise ride along on
 * an unrelated submission, and for a non-super_admin the server answers that
 * with a 403 — which the shared `handle()` reads as an expired session and signs
 * the admin out. Dropping it here keeps that unreachable.
 *
 * @param {SettlementFormState} form
 * @returns {object}
 */
export function buildEntryBody(form) {
    const v = form.values;
    const body = {
        settledAmount: Number(v.settledAmount),
        settlementReference: v.settlementReference.trim(),
        settledAt: v.settledAt,
        method: v.method || 'manual',
        idempotencyKey: form.idempotencyKey,
    };
    const notes = v.adminNotes.trim();
    if (notes) body.adminNotes = notes;
    if (form.overSettlement && v.override) {
        body.override = true;
        body.overrideReason = v.overrideReason.trim();
    }
    return body;
}

/**
 * @param {SettlementViewState} state
 * @param {object} action
 * @returns {SettlementViewState}
 */
export function settlementReducer(state, action) {
    const form = state.form ?? newFormSession();

    switch (action.type) {
        // Requirement 13.1 / 13.4: a (re)fetch returns to loading and drops
        // whatever was on screen — no stale figures under a spinner. The form
        // rides through untouched: the refetch after a successful record must
        // not swallow the notice it just produced.
        case 'fetch':
            return { status: 'loading', data: null, error: null, form };

        case 'resolved':
            return {
                status: hasNoRecords(action.data) ? 'empty' : 'ready',
                data: action.data ?? null,
                error: null,
                form,
            };

        // Requirement 13.3: an error must not display stale or partial figures
        // as current, so the payload is cleared rather than kept.
        case 'failed':
            return { status: 'error', data: null, error: action.error || FETCH_FAILED, form };

        // ---- record form (Requirements 4.3, 5.3, 6.4, 6.5, 13.5) ----

        case 'formChange':
            return {
                ...state,
                form: { ...form, values: { ...form.values, [action.field]: action.value } },
            };

        // Requirement 6.4: in flight ⇒ the submit control is disabled. The key is
        // kept from the first submit of this session, so a retry after a
        // rejection is the same transfer, not a second one (6.1).
        case 'submit':
            return {
                ...state,
                form: {
                    ...form,
                    submitting: true,
                    error: null,
                    field: null,
                    notice: null,
                    idempotencyKey: form.idempotencyKey || action.idempotencyKey || null,
                },
            };

        // Requirement 13.5: the message is shown, every entered value stays in
        // its field, and `state.data` — the displayed ledger — is not touched.
        // The override is offered only when the guard itself asked for it (5.3).
        case 'submitRejected': {
            const body = action.body || {};
            return {
                ...state,
                form: {
                    ...form,
                    submitting: false,
                    error: action.error || RECORD_FAILED,
                    field: body.field || null,
                    overSettlement: body.code === 'over_settlement'
                        ? {
                            netPayable: body.netPayable,
                            settledToDate: body.settledToDate,
                            maxRecordable: body.maxRecordable,
                        }
                        : null,
                    notice: null,
                },
            };
        }

        // A recorded transfer ends the form session: the fields clear and the
        // next submission needs a new Idempotency_Key.
        case 'submitSucceeded':
            return { ...state, form: { ...newFormSession(), notice: successNotice(action.result) } };

        // ---- per-row reversal (Requirement 7.1) ----

        case 'reverseTarget':
            return { ...state, form: { ...form, reversal: { ...EMPTY_REVERSAL, entryId: action.entryId ?? null } } };

        case 'reverseReason':
            return { ...state, form: { ...form, reversal: { ...form.reversal, reason: action.value } } };

        case 'reverseSubmit':
            return { ...state, form: { ...form, reversal: { ...form.reversal, submitting: true, error: null } } };

        // Same shape as a rejected record: the reason typed stays put and the
        // displayed ledger is untouched.
        case 'reverseFailed':
            return {
                ...state,
                form: {
                    ...form,
                    reversal: { ...form.reversal, submitting: false, error: action.error || REVERSAL_FAILED },
                },
            };

        case 'reverseSucceeded':
            return { ...state, form: { ...form, reversal: { ...EMPTY_REVERSAL }, notice: 'Settlement reversed.' } };

        default:
            return state;
    }
}
