'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { settlementApi, type OwnerSettlementDTO, type SettlementState } from '@/lib/api';
import { formatSingleDateTime } from '@/lib/dateUtils';
import { formatInr } from '@/lib/formatInr';

/**
 * The owner's read-only mirror of one listing's settlement (Requirement 9).
 *
 * Read-only is the point: there is no form here and no control that creates,
 * edits, reverses or disputes an entry (Requirement 9.6). The only button in the
 * tree is the error state's retry, which re-reads (13.4). Every figure comes
 * from the server's owner whitelist as-is — this component computes no money.
 *
 * The four surface states are mutually exclusive by construction: one tagged
 * `status` string, never independent booleans, so a failure can never be read as
 * a zero balance (Requirement 13.1). Same pattern as
 * `app/dashboard/creator/earnings/page.tsx`.
 */
type View =
    | { status: 'loading' }
    | { status: 'ready'; data: OwnerSettlementDTO }
    | { status: 'empty'; data: OwnerSettlementDTO }
    | { status: 'error'; error: string };

/** The view plus the listing it describes, so a prop change can never show another listing's figures. */
type ViewFor = View & { forId: string };

const LOADING: View = { status: 'loading' };

const STATE_BADGES: Record<SettlementState, { label: string; className: string }> = {
    not_settled: { label: 'Not settled', className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
    partially_settled: { label: 'Partially settled', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    fully_settled: { label: 'Fully settled', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    over_settled: { label: 'Over settled', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

/**
 * Retrieval succeeded and the listing genuinely has nothing to show
 * (Requirement 13.2) — no payments and no settlement. Mirrors the admin panel's
 * `hasNoRecords` so both surfaces call the same listing empty.
 */
function hasNoRecords(dto: OwnerSettlementDTO): boolean {
    return (
        dto.activity.successfulPayments === 0 &&
        dto.activity.refundedPayments === 0 &&
        dto.entries.length === 0
    );
}

function Figure({ label, value, accent }: { label: string; value: number; accent: string }) {
    return (
        <div className={`rounded-xl border p-4 ${accent}`}>
            <p className="text-sm text-gray-300 mb-1">{label}</p>
            {/* Requirement 12.6: every amount through the shared formatInr. */}
            <p className="text-2xl font-bold text-white tabular-nums">{formatInr(value)}</p>
        </div>
    );
}

function MoneyRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex justify-between items-baseline gap-4 py-2">
            <dt className="text-sm text-gray-400">{label}</dt>
            <dd className="text-sm text-gray-200 tabular-nums">{formatInr(value)}</dd>
        </div>
    );
}

function CountCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3">
            {/* A count, not money — no formatInr here. */}
            <div className="text-xl font-bold text-white tabular-nums">{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
    );
}

export default function SettlementSummary({ kind, listingId }: { kind: 'event' | 'venue'; listingId: string }) {
    const [loaded, setLoaded] = useState<ViewFor | null>(null);

    const load = useCallback(async () => {
        if (!listingId) return;
        try {
            const dto = kind === 'event'
                ? await settlementApi.getEventSettlement(listingId)
                : await settlementApi.getVenueSettlement(listingId);
            setLoaded({ status: hasNoRecords(dto) ? 'empty' : 'ready', data: dto, forId: listingId });
        } catch (err) {
            // Requirement 13.3: the payload is dropped, not kept — an error never
            // presents a stale or partial figure as current.
            setLoaded({
                status: 'error',
                error: err instanceof Error ? err.message : 'Failed to load settlement',
                forId: listingId,
            });
        }
    }, [kind, listingId]);

    useEffect(() => {
        // Fetching on mount IS synchronising with an external system; the state
        // lands in an async continuation, not in this body. The rule cannot see
        // past `load`, so it is silenced here rather than the read being
        // restructured into something less honest.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
    }, [load]);

    // Requirement 13.4: retry returns to the loading indication, then re-reads.
    const retry = useCallback(() => {
        setLoaded(null);
        load();
    }, [load]);

    if (!listingId) return null;

    // A result belongs to the listing it was fetched for; anything else is still
    // loading. That covers the `?event=` param changing under a mounted panel.
    const view: View = loaded && loaded.forId === listingId ? loaded : LOADING;
    const data = view.status === 'ready' || view.status === 'empty' ? view.data : null;
    const money = data?.money;
    // Requirement 9.4 / 5.6: an over-settled listing has nothing outstanding.
    const outstanding = data?.state === 'over_settled' ? 0 : (money?.outstandingAmount ?? 0);
    // Requirement 9.7 and 9.8 are two DIFFERENT boundaries: an empty ledger, and
    // a listing that has earned nothing yet. Both are distinct from the error
    // state, and either can hold on its own.
    const noSettlementYet = (data?.entries.length ?? 0) === 0;
    const noPayoutDue = !((money?.netPayable ?? 0) > 0);
    // Requirement 9.5: newest first, and sorted here rather than trusted from the
    // wire so the displayed order holds whatever the transport does.
    const entries = [...(data?.entries ?? [])].sort(
        (a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime(),
    );

    return (
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/[0.05] flex justify-between items-center gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-white">Settlement</h2>
                    <p className="text-sm text-gray-400">What you earned, what has been paid to you, and what is still owed</p>
                </div>
                {/* `data` is only ever set on ready/empty, so a failure never
                    leaves a stale state badge here (Requirement 13.3). */}
                {data && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border whitespace-nowrap ${STATE_BADGES[data.state].className}`}>
                        {STATE_BADGES[data.state].label}
                    </span>
                )}
            </div>

            {/* Requirement 13.1: loading, and nothing else alongside it. */}
            {view.status === 'loading' && (
                <div className="p-6 space-y-4" aria-busy="true">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
                        ))}
                    </div>
                    <p className="text-sm text-gray-300">Loading settlement…</p>
                </div>
            )}

            {/* Requirement 13.3 / 13.4: an error, a retry that re-enters loading,
                and no partial figures presented as current. */}
            {view.status === 'error' && (
                <div className="p-6 text-center">
                    <svg className="w-12 h-12 text-red-400/70 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-white font-semibold mb-1">Couldn&apos;t load settlement</h3>
                    <p className="text-sm text-gray-300 mb-5">{view.error}</p>
                    {/* The only button in this tree, and it reads — nothing here
                        creates, edits, reverses or disputes an entry (9.6). */}
                    <Button variant="secondary" size="sm" onClick={retry}>Try Again</Button>
                </div>
            )}

            {/* Requirement 13.2: a known zero, named as such. Both boundary
                indications (9.7, 9.8) hold here and are said in words. */}
            {view.status === 'empty' && (
                <div className="p-6 text-center">
                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-6h13M9 17H4V7a2 2 0 012-2h12a2 2 0 012 2v4M4 11h5" />
                    </svg>
                    <h3 className="text-white font-semibold mb-1">No settlement records</h3>
                    <p className="text-sm text-gray-300">
                        This {kind} has no payments yet, so no payout is yet due and no settlement has been made yet.
                    </p>
                </div>
            )}

            {view.status === 'ready' && data && money && (
                <div className="p-6 space-y-8">
                    {/* Requirement 9.4: the three headline figures, labeled, in INR. */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Figure label="Net payable" value={money.netPayable} accent="border-violet-500/30 bg-violet-500/5" />
                        <Figure label="Settled to date" value={money.settledToDate} accent="border-green-500/30 bg-green-500/5" />
                        <Figure label="Outstanding" value={outstanding} accent="border-white/[0.06]" />
                    </div>

                    {/* Requirement 9.8: no successful payments ⇒ every money figure
                        is ₹0 and no payout is due. */}
                    {noPayoutDue && (
                        <p className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-gray-300">
                            No payout is yet due for this {kind}.
                        </p>
                    )}

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-5">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Your earnings</h3>
                        <dl className="divide-y divide-white/[0.05]">
                            <MoneyRow label="Owner gross" value={money.ownerGross} />
                            <MoneyRow label="Platform commission" value={money.platformCommission} />
                            <MoneyRow label="Net payable" value={money.netPayable} />
                            <MoneyRow label="Refunded to buyers" value={money.refundedTotal} />
                        </dl>
                    </div>

                    {/* Requirement 9.1 / 3.2: the six activity figures. */}
                    <section>
                        <h3 className="text-sm font-semibold text-white mb-3">Sales activity</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            <CountCard label="Successful payments" value={data.activity.successfulPayments} />
                            <CountCard label={kind === 'venue' ? 'Bookings' : 'Tickets sold'} value={data.activity.unitsSold} />
                            <CountCard label="Confirmed" value={data.activity.confirmed} />
                            <CountCard label="Cancelled" value={data.activity.cancelled} />
                            <CountCard label="Refunded payments" value={data.activity.refundedPayments} />
                        </div>
                        <p className="text-sm text-gray-400 mt-3">
                            Last payment:{' '}
                            {/* Requirement 3.3 / 3.4: an absolute date and time, or an
                                explicit indication — never a blank or a placeholder. */}
                            <span className="text-gray-200">
                                {data.activity.lastPaymentAt ? formatSingleDateTime(data.activity.lastPaymentAt) : 'No payments yet'}
                            </span>
                        </p>
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold text-white mb-3">Settlement history</h3>
                        {/* Requirement 9.7: an empty ledger is named, not implied by
                            a ₹0 the reader has to interpret. */}
                        {entries.length === 0 ? (
                            <p className="py-8 text-center text-sm text-gray-400 border border-dashed border-white/[0.12] rounded-xl">
                                No settlement has been made yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-400 border-b border-white/[0.08]">
                                            <th className="py-3 pr-4 font-medium">Settled on</th>
                                            <th className="py-3 pr-4 font-medium text-right">Amount</th>
                                            <th className="py-3 font-medium">Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((entry) => (
                                            <tr
                                                key={`${entry.settlementReference}-${entry.settledAt}-${entry.settledAmount}`}
                                                className="border-b border-white/[0.04] text-gray-200"
                                            >
                                                <td className={`py-3 pr-4 whitespace-nowrap ${entry.reversed ? 'line-through text-gray-500' : ''}`}>
                                                    {formatSingleDateTime(entry.settledAt)}
                                                </td>
                                                {/* Requirement 9.5: a reversed entry is marked and its
                                                    amount is already out of settledToDate — the server
                                                    nets the pair to zero, so nothing is subtracted here. */}
                                                <td className={`py-3 pr-4 text-right tabular-nums ${entry.reversed ? 'line-through text-gray-500' : 'text-white font-medium'}`}>
                                                    {formatInr(entry.settledAmount)}
                                                </td>
                                                <td className="py-3 text-gray-400">
                                                    <span className={entry.reversed ? 'line-through text-gray-500' : ''}>
                                                        {entry.settlementReference}
                                                    </span>
                                                    {entry.reversed && (
                                                        <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-semibold uppercase tracking-wide">
                                                            Reversed
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {entries.some((e) => e.reversed) && (
                                    <p className="text-xs text-gray-500 mt-3">
                                        A reversed settlement is excluded from your settled-to-date total.
                                    </p>
                                )}
                            </div>
                        )}
                        {/* Requirement 9.7 alongside a non-empty payout: the ledger is
                            empty but money is owed, which is worth saying plainly. */}
                        {noSettlementYet && !noPayoutDue && (
                            <p className="text-sm text-gray-400 mt-3">
                                Nothing has been transferred to you for this {kind} yet.
                            </p>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
