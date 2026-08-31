import { useCallback, useEffect, useReducer } from 'react';
import adminApi from '../api/adminApi';
import { getAdminRoleFromToken } from '../lib/adminRole';
import { formatDateTime } from '../lib/formatDateTime';
import { formatInr } from '../lib/formatInr';
import { buildEntryBody, initialSettlementState, settlementReducer } from '../lib/listingSettlementState';
import {
    emptyLedgerMessage,
    formatLastPayment,
    isModeratorHidden,
    isOverSettled,
    moneyGroups,
    nothingToSettle,
    pinnedOutstanding,
    stateBadge,
} from '../lib/settlementView';
import { Button } from './ui/Button';
import { FigureCard } from './ui/FigureCard';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { StatusBadge } from './ui/StatusBadge';

const METHOD_OPTIONS = [
    { value: 'manual', label: 'Manual bank transfer' },
    { value: 'gateway', label: 'Payment gateway' },
];

// The label/class mapping lives in lib/settlementView.js so it is reachable
// without a renderer; this is just the pill that wears it.
function StateBadge({ state }) {
    const badge = stateBadge(state);
    if (!badge) return null;
    return (
        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${badge.className}`}>
            {badge.label}
        </span>
    );
}

// One labeled money figure inside a group (Requirement 2.2) — a dense label/value
// row rather than a card, so a group of five reads as one block. Every amount
// goes through `formatInr`, and it renders a null/absent figure as ₹0 (2.6).
function MoneyRow({ label, value, emphasis }) {
    return (
        <div className="flex justify-between items-baseline gap-4 py-2">
            <dt className="text-sm text-gray-400">{label}</dt>
            <dd className={`text-sm tabular-nums ${emphasis ? 'text-white font-semibold' : 'text-gray-200'}`}>
                {formatInr(value)}
            </dd>
        </div>
    );
}

function MoneyGroup({ title, children }) {
    return (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{title}</h4>
            <dl className="divide-y divide-white/[0.05]">{children}</dl>
        </div>
    );
}

// One activity count (Requirement 3.2). A count, not money — no formatInr here.
function CountCard({ label, value }) {
    return (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3">
            <div className="text-xl font-bold text-white tabular-nums">{value ?? 0}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
    );
}

/**
 * The record form (Requirements 4.3, 5.3, 6.4, 6.5, 13.5).
 *
 * Holds no state of its own — every field reads from and writes to
 * `settlementReducer`, so "a rejected submission keeps the entered values" is a
 * fact about the reducer rather than about this renderer.
 *
 * @param {{ form: object, dispatch: Function, onSubmit: Function, isSuperAdmin: boolean }} props
 */
function RecordSettlementForm({ form, dispatch, onSubmit, isSuperAdmin }) {
    const { values, submitting, error, field, overSettlement, notice } = form;
    const set = (name) => (e) => dispatch({ type: 'formChange', field: name, value: e.target.value });

    // Requirement 4.9: a future settlement date is rejected server-side, so the
    // picker doesn't offer one.
    const today = new Date().toISOString().slice(0, 10);

    return (
        <section className="border-t border-white/[0.08] pt-6">
            <h3 className="text-sm font-semibold text-white mb-4">Record a settlement</h3>

            <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Input
                        label="Amount transferred (₹)"
                        type="number"
                        min="1"
                        step="1"
                        required
                        placeholder="50000"
                        value={values.settledAmount}
                        onChange={set('settledAmount')}
                        error={field === 'settledAmount' ? error : undefined}
                    />
                    <Input
                        label="Bank reference (UTR)"
                        type="text"
                        required
                        placeholder="UTR / NEFT reference"
                        value={values.settlementReference}
                        onChange={set('settlementReference')}
                        error={field === 'settlementReference' ? error : undefined}
                    />
                    <Input
                        label="Settled on"
                        type="date"
                        required
                        max={today}
                        value={values.settledAt}
                        onChange={set('settledAt')}
                        error={field === 'settledAt' ? error : undefined}
                    />
                    <Select label="Method" options={METHOD_OPTIONS} value={values.method} onChange={set('method')} />
                </div>

                <Input
                    label="Internal notes (optional)"
                    type="text"
                    placeholder="Not shown to the owner"
                    value={values.adminNotes}
                    onChange={set('adminNotes')}
                />

                {/* Requirement 13.5: the returned message, shown as returned.
                    Field-level rejections already render on the field above, so
                    only the rest surface here. */}
                {error && !field && (
                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300 space-y-1">
                        <p>{error}</p>
                        {overSettlement && (
                            <p className="text-red-200/80">
                                Net payable {formatInr(overSettlement.netPayable)} · settled to date{' '}
                                {formatInr(overSettlement.settledToDate)} · most that can be recorded{' '}
                                {formatInr(overSettlement.maxRecordable)}.
                            </p>
                        )}
                    </div>
                )}

                {/* Requirement 5.3: the override exists only for the one rejection
                    that can be overridden, and only for a super admin. The role
                    gate matters beyond tidiness — the server answers an override
                    from a lesser role with a 403, and the shared API helper reads
                    any 403 as an expired session and signs the admin out, so the
                    message would never be seen. */}
                {overSettlement && isSuperAdmin && (
                    <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                        <label className="flex items-start gap-3 text-sm text-amber-200">
                            <input
                                type="checkbox"
                                className="mt-0.5 accent-amber-500"
                                checked={values.override}
                                onChange={(e) => dispatch({ type: 'formChange', field: 'override', value: e.target.checked })}
                            />
                            <span>Override the settlement limit and record this over-settlement anyway.</span>
                        </label>
                        {values.override && (
                            <Input
                                label="Override reason"
                                type="text"
                                required
                                placeholder="Why this over-settlement is correct"
                                value={values.overrideReason}
                                onChange={set('overrideReason')}
                                error={field === 'overrideReason' ? error : undefined}
                            />
                        )}
                    </div>
                )}

                {/* Requirement 6.5 / 10.5: a duplicate submission and an
                    unnotifiable owner are both successes, said in words. */}
                {notice && (
                    <p className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-sm text-green-300">
                        {notice}
                    </p>
                )}

                <div className="flex items-center gap-3">
                    {/* Requirement 6.4: disabled while the request is in flight, so
                        a double-click cannot become a second transfer. */}
                    <Button type="submit" variant="violet" size="sm" isLoading={submitting} disabled={submitting}>
                        {submitting ? 'Recording…' : 'Record settlement'}
                    </Button>
                    <span className="text-xs text-gray-500">
                        Records a transfer that already happened. It is never edited — correct it with a reversal.
                    </span>
                </div>
            </form>
        </section>
    );
}

/**
 * The per-row reversal control (Requirement 7.1). Reason is mandatory: the
 * confirm button stays disabled until one is typed, and the server rejects a
 * blank one regardless.
 *
 * @param {{ entryId: string, reversal: object, dispatch: Function, onConfirm: Function }} props
 */
function ReverseControl({ entryId, reversal, dispatch, onConfirm }) {
    const open = reversal.entryId === entryId;
    if (!open) {
        return (
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'reverseTarget', entryId })}>
                Reverse
            </Button>
        );
    }

    const reason = reversal.reason.trim();
    return (
        <div className="space-y-2 min-w-[14rem]">
            <Input
                type="text"
                required
                autoFocus
                placeholder="Reason for the reversal (required)"
                value={reversal.reason}
                onChange={(e) => dispatch({ type: 'reverseReason', value: e.target.value })}
                error={reversal.error || undefined}
            />
            <div className="flex gap-2">
                <Button
                    variant="danger"
                    size="sm"
                    isLoading={reversal.submitting}
                    disabled={reversal.submitting || !reason}
                    onClick={() => onConfirm(entryId, reason)}
                >
                    Confirm reversal
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={reversal.submitting}
                    onClick={() => dispatch({ type: 'reverseTarget', entryId: null })}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
}

/**
 * The `ready` body: figures, activity, payout summary, ledger, record form.
 *
 * Split out of the panel so the surface-state switch above stays readable, and
 * so this only ever runs with a resolved DTO in hand.
 *
 * @param {{ kind: 'event' | 'venue', data: object, form: object, dispatch: Function,
 *          onRecord: Function, onReverse: Function, isSuperAdmin: boolean }} props
 */
function SettlementBody({ kind, data, form, dispatch, onRecord, onReverse, isSuperAdmin }) {
    const money = data?.money ?? {};
    const activity = data?.activity ?? {};
    const entries = data?.entries ?? [];
    const payout = data?.payout ?? null;

    // Requirement 5.6: an over-settled listing shows the excess as its own figure
    // and Outstanding pinned at ₹0. The decisions below live in
    // lib/settlementView.js so they are checkable without a renderer.
    const overSettled = isOverSettled(data?.state);
    const outstanding = pinnedOutstanding(money, data?.state);
    const groups = moneyGroups({ kind, money, state: data?.state });

    // Requirement 1.3: newest first. Sorted here rather than trusted from the
    // wire, so the displayed order holds whatever the transport does.
    const ordered = [...entries].sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt));

    return (
        <div className="p-6 space-y-8">
            {/* Requirement 1.4: the three headline figures, readable at a glance. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FigureCard label="Net Payable" value={formatInr(money.netPayable)} accent="orange" />
                <FigureCard label="Settled To Date" value={formatInr(money.settledToDate)} accent="green" />
                <FigureCard label="Outstanding" value={formatInr(outstanding)} accent="pink" />
                {overSettled && (
                    <FigureCard label="Excess Settled" value={formatInr(money.excessAmount)} accent="red" />
                )}
            </div>

            {nothingToSettle(money) && (
                <p className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-gray-300 text-sm">
                    Payout not initiated — nothing to settle yet.
                </p>
            )}

            {/* Requirement 2.3: the supporting breakdown as two labeled groups.
                Membership is decided in lib/settlementView.js. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {groups.map((group) => (
                    <MoneyGroup key={group.title} title={group.title}>
                        {group.rows.map((row) => (
                            <MoneyRow key={row.label} label={row.label} value={row.value} emphasis={row.emphasis} />
                        ))}
                    </MoneyGroup>
                ))}
            </div>

            {/* Requirement 2.1/2.2: Refunded_Total is a figure of its own — it
                belongs to neither group named in 2.3. */}
            <div className="flex justify-between items-baseline gap-4 px-5 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                <span className="text-sm text-gray-400">Refunded to buyers</span>
                <span className="text-sm text-gray-200 tabular-nums">{formatInr(money.refundedTotal)}</span>
            </div>

            {/* Requirement 3.2/3.3: the six activity figures. */}
            <section>
                <h3 className="text-sm font-semibold text-white mb-3">Sales activity</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <CountCard label="Successful payments" value={activity.successfulPayments} />
                    <CountCard label={kind === 'venue' ? 'Bookings sold' : 'Tickets sold'} value={activity.unitsSold} />
                    <CountCard label="Confirmed" value={activity.confirmed} />
                    <CountCard label="Cancelled" value={activity.cancelled} />
                    <CountCard label="Refunded payments" value={activity.refundedPayments} />
                </div>
                <p className="text-sm text-gray-400 mt-3">
                    Last payment:{' '}
                    {/* Requirement 3.4: an explicit indication, never a blank or a
                        placeholder date. */}
                    <span className="text-gray-200">
                        {formatLastPayment(activity, formatDateTime)}
                    </span>
                </p>
            </section>

            {/* Requirement 1.5: the payout's status and recorded netAmount sit
                alongside the ledger, since that record is what is being settled. */}
            <section>
                <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-white">Settlement ledger</h3>
                    {payout ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span>Payout</span>
                            <StatusBadge status={payout.status} />
                            <span className="text-white font-medium tabular-nums">{formatInr(payout.netAmount)}</span>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-400">No payout raised yet</span>
                    )}
                </div>

                {/* Requirement 1.6: an empty ledger is named, not implied. */}
                {ordered.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400 border border-dashed border-white/[0.12] rounded-xl">
                        {emptyLedgerMessage(kind)}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 border-b border-white/[0.08]">
                                    <th className="py-3 pr-4 font-medium">Settled on</th>
                                    <th className="py-3 pr-4 font-medium text-right">Amount</th>
                                    <th className="py-3 pr-4 font-medium">Reference</th>
                                    <th className="py-3 pr-4 font-medium">Method</th>
                                    <th className="py-3 pr-4 font-medium">Recorded by</th>
                                    <th className="py-3 pr-4 font-medium">Notes</th>
                                    <th className="py-3 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordered.map((entry) => {
                                    // Requirement 7.4: a reversed entry is struck through and
                                    // carries the reason, the reversing admin, and when.
                                    const reversal = entry.reversedBy;
                                    const struck = reversal ? 'line-through text-gray-500' : '';
                                    return (
                                        <tr key={entry._id} className="border-b border-white/[0.04] text-gray-200 align-top">
                                            <td className={`py-3 pr-4 whitespace-nowrap ${struck}`}>
                                                {formatDateTime(entry.settledAt)}
                                            </td>
                                            <td className={`py-3 pr-4 text-right tabular-nums ${reversal ? struck : 'text-white font-medium'}`}>
                                                {formatInr(entry.settledAmount)}
                                            </td>
                                            <td className={`py-3 pr-4 ${struck}`}>{entry.settlementReference}</td>
                                            <td className="py-3 pr-4 capitalize text-gray-400">{entry.method || 'manual'}</td>
                                            <td className="py-3 pr-4 text-gray-400">{entry.recordedBy?.name || '—'}</td>
                                            <td className="py-3 pr-4 text-gray-400 space-y-1 min-w-[16rem]">
                                                {entry.isReversalOf && (
                                                    <p className="text-xs text-orange-400">
                                                        Reversal entry{entry.reversalReason ? ` — ${entry.reversalReason}` : ''}
                                                    </p>
                                                )}
                                                {reversal && (
                                                    <p className="text-xs text-orange-400">
                                                        Reversed{reversal.reason ? ` — ${reversal.reason}` : ''} by{' '}
                                                        {reversal.recordedBy?.name || 'an admin'} on {formatDateTime(reversal.createdAt)}
                                                    </p>
                                                )}
                                                {entry.isOverSettlement && (
                                                    <p className="text-xs text-red-400">
                                                        Over-settlement override{entry.overrideReason ? ` — ${entry.overrideReason}` : ''}
                                                    </p>
                                                )}
                                                {entry.adminNotes && <p className="text-xs text-gray-500">{entry.adminNotes}</p>}
                                            </td>
                                            <td className="py-3 text-right">
                                                {/* Requirement 7.1: correction is by reversal. An
                                                    already-reversed entry (7.5) and a reversal entry
                                                    itself (7.8) are both rejected server-side, so no
                                                    control is offered for them. */}
                                                {!reversal && !entry.isReversalOf && (
                                                    <ReverseControl
                                                        entryId={entry._id}
                                                        reversal={form.reversal}
                                                        dispatch={dispatch}
                                                        onConfirm={onReverse}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <RecordSettlementForm form={form} dispatch={dispatch} onSubmit={onRecord} isSuperAdmin={isSuperAdmin} />
        </div>
    );
}

/**
 * Per-listing settlement panel for the admin event/venue detail pages.
 *
 * The four surface states live in `settlementReducer` (lib/listingSettlementState.js)
 * so exactly one of loading / ready / empty / error can ever be true, and so the
 * state machine is testable without a renderer.
 *
 * @param {object} props
 * @param {'event' | 'venue'} props.kind
 * @param {string} props.listingId
 */
export default function ListingSettlementPanel({ kind, listingId }) {
    const [view, dispatch] = useReducer(settlementReducer, initialSettlementState);

    // Requirement 11.3: a moderator has no settlement read or write, so the
    // panel is not rendered at all. The server guard is the boundary — this
    // just avoids showing a control that would 403.
    const adminRole = getAdminRoleFromToken();
    const isModerator = isModeratorHidden(adminRole);

    const fetchSettlement = useCallback(async () => {
        dispatch({ type: 'fetch' });
        try {
            const data = await adminApi.getListingSettlement(kind, listingId);
            dispatch({ type: 'resolved', data });
        } catch (err) {
            dispatch({ type: 'failed', error: err?.message });
        }
    }, [kind, listingId]);

    useEffect(() => {
        if (isModerator) return;
        fetchSettlement();
    }, [isModerator, fetchSettlement]);

    // Requirement 4.3: on success the figures, state, and ledger are re-read, so
    // the panel shows the new truth without a page reload. On rejection nothing
    // is re-read — the reducer keeps the entered values and the displayed ledger
    // exactly as they were (13.5).
    const recordSettlement = useCallback(async (e) => {
        e.preventDefault();
        // One Idempotency_Key per form session: kept by the reducer across a
        // rejection and retry, so a retried submission is the same transfer.
        const idempotencyKey = view.form.idempotencyKey || crypto.randomUUID();
        const body = buildEntryBody({ ...view.form, idempotencyKey });
        dispatch({ type: 'submit', idempotencyKey });
        try {
            const result = await adminApi.recordSettlement(kind, listingId, body);
            dispatch({ type: 'submitSucceeded', result });
            await fetchSettlement();
        } catch (err) {
            dispatch({ type: 'submitRejected', error: err?.message, body: err?.body });
        }
    }, [kind, listingId, view.form, fetchSettlement]);

    const reverseEntry = useCallback(async (entryId, reason) => {
        dispatch({ type: 'reverseSubmit' });
        try {
            await adminApi.reverseSettlement(kind, listingId, entryId, reason);
            dispatch({ type: 'reverseSucceeded' });
            await fetchSettlement();
        } catch (err) {
            dispatch({ type: 'reverseFailed', error: err?.message });
        }
    }, [kind, listingId, fetchSettlement]);

    if (isModerator) return null;

    return (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden mt-8">
            <div className="p-6 border-b border-white/[0.05] flex justify-between items-center gap-4">
                <h2 className="text-lg font-semibold text-white">Settlement</h2>
                {/* Requirement 1.4 / 5.6: the state sits beside the figures it
                    describes. `data` is only ever set on ready/empty, so a
                    failure never shows a stale state here. */}
                {view.data && <StateBadge state={view.data.state} />}
            </div>

            {/* Requirement 13.1: loading, and nothing else. */}
            {view.status === 'loading' && (
                <div className="p-6 space-y-4" aria-busy="true">
                    <div className="h-5 w-40 bg-white/[0.05] rounded animate-pulse" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
                        <div className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
                    </div>
                    <p className="text-gray-300 text-sm">Loading settlement…</p>
                </div>
            )}

            {/* Requirement 13.3 / 13.4: error with a retry that re-enters loading,
                and no stale or partial figures shown as current. */}
            {view.status === 'error' && (
                <div className="p-6 text-center">
                    <svg className="w-12 h-12 text-red-400/70 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-white font-semibold mb-1">Couldn&apos;t load settlement</h3>
                    <p className="text-gray-300 text-sm mb-5">{view.error}</p>
                    <Button variant="secondary" size="sm" onClick={fetchSettlement}>Try Again</Button>
                </div>
            )}

            {/* Requirement 13.2: retrieval succeeded, the listing genuinely has
                no records — named as such, not rendered as a wall of zeros. */}
            {view.status === 'empty' && (
                <div className="p-6 text-center">
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-6h13M9 17H4V7a2 2 0 012-2h12a2 2 0 012 2v4M4 11h5" />
                    </svg>
                    <h3 className="text-white font-semibold mb-1">No settlement records</h3>
                    <p className="text-gray-300 text-sm">
                        This {kind} has no payments and no recorded settlements yet.
                    </p>
                </div>
            )}

            {view.status === 'ready' && (
                <SettlementBody
                    kind={kind}
                    data={view.data}
                    form={view.form}
                    dispatch={dispatch}
                    onRecord={recordSettlement}
                    onReverse={reverseEntry}
                    isSuperAdmin={adminRole === 'super_admin'}
                />
            )}
        </div>
    );
}
