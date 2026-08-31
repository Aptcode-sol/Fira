import { useState, useEffect, useRef, useCallback } from 'react';
import adminApi from '../api/adminApi';
import { formatInr } from '../lib/formatInr';
import { FadeIn, SlideUp } from '../components/animations';
// Shared with the per-listing settlement panel (Req 1.4, 1.5) — one definition,
// two callers.
import { FigureCard } from '../components/ui/FigureCard';
import { StatusBadge } from '../components/ui/StatusBadge';

// Payout lifecycle statuses that can be filtered on (Req 3.6).
const FILTERABLE_STATUSES = ['pending', 'processing', 'completed', 'failed'];

export default function Payouts() {
    // phase drives the mutually-exclusive loading / empty / error / ready machine (Req 12).
    const [phase, setPhase] = useState('loading');
    const [error, setError] = useState(null);

    const [overview, setOverview] = useState(null);
    const [recipients, setRecipients] = useState({ event_tickets: [], venue_booking: [], readyToPayTotal: 0 });
    const [payouts, setPayouts] = useState([]);

    // Optional inclusive date range applied identically to every figure (Req 1.8).
    const [draftRange, setDraftRange] = useState({ from: '', to: '' });
    const [range, setRange] = useState({ from: '', to: '' });

    // Payout status multi-select filter (Req 3.6). Empty → no filter (all statuses).
    const [statuses, setStatuses] = useState([]);
    const [payoutLoading, setPayoutLoading] = useState(false);
    const [payoutError, setPayoutError] = useState(null);

    // Load every figure together for the main state machine. Date range applies
    // identically to all three endpoints (Req 1.8). Fails closed: on any error we
    // show the error state and no partial totals (Req 1.9).
    const loadAll = useCallback(async () => {
        setPhase('loading');
        setError(null);
        setPayoutError(null);
        try {
            const [ov, rec, pay] = await Promise.all([
                adminApi.getEarningsOverview(range),
                adminApi.getEarningsRecipients(range),
                adminApi.getEarningsPayouts({ statuses }),
            ]);
            setOverview(ov);
            setRecipients(rec || { event_tickets: [], venue_booking: [], readyToPayTotal: 0 });
            setPayouts(Array.isArray(pay) ? pay : []);
            setPhase('ready');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Could not load earnings data.');
            setPhase('error');
        }
        // statuses intentionally excluded: the filter re-queries only the payout
        // list (below) so changing it does not reload the whole dashboard.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // Re-query only the payout list when the status filter changes, without
    // dropping the rest of the dashboard back into a loading state. Skips the
    // initial mount (loadAll already fetched the unfiltered list).
    const firstStatusRun = useRef(true);
    useEffect(() => {
        if (firstStatusRun.current) {
            firstStatusRun.current = false;
            return;
        }
        if (phase !== 'ready') return;
        let cancelled = false;
        (async () => {
            setPayoutLoading(true);
            setPayoutError(null);
            try {
                const pay = await adminApi.getEarningsPayouts({ statuses });
                if (!cancelled) setPayouts(Array.isArray(pay) ? pay : []);
            } catch (err) {
                if (!cancelled) setPayoutError(err.message || 'Could not load payouts.');
            } finally {
                if (!cancelled) setPayoutLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statuses]);

    const applyRange = () => setRange({ ...draftRange });
    const clearRange = () => {
        setDraftRange({ from: '', to: '' });
        setRange({ from: '', to: '' });
    };

    const toggleStatus = (status) => {
        setStatuses((prev) =>
            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
        );
    };

    const recipientRows = [
        ...(recipients.event_tickets || []),
        ...(recipients.venue_booking || []),
    ];

    // Dashboard-level empty state: a successful load with no recipients, no
    // payouts, and nothing collected (Req 12.2). Distinct from a filter that
    // simply matches no payouts (handled inside the payout region, Req 3.7).
    const isEmpty =
        phase === 'ready' &&
        recipientRows.length === 0 &&
        payouts.length === 0 &&
        !overview?.grossCollected;

    // ---- Loading state (mutually exclusive with empty/error) ----
    if (phase === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading">
                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    // ---- Error state with retry (Req 12.3, 12.4) ----
    if (phase === 'error') {
        return (
            <div className="p-6 lg:p-8">
                <div className="max-w-lg mx-auto mt-20 text-center bg-red-500/[0.05] border border-red-500/20 rounded-2xl p-8">
                    <svg className="w-10 h-10 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-white mb-2">Couldn't load earnings data</h2>
                    <p className="text-sm text-gray-300 mb-6">{error}</p>
                    <button
                        onClick={loadAll}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const recon = overview?.reconciliation || {};

    return (
        <div className="p-6 lg:p-8">
            {/* Header + date range control */}
            <SlideUp>
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Payouts &amp; Earnings</h1>
                        <p className="text-gray-300">Read-only view of collected money, payables, and payout status</p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">From</label>
                            <input
                                type="date"
                                value={draftRange.from}
                                onChange={(e) => setDraftRange((r) => ({ ...r, from: e.target.value }))}
                                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">To</label>
                            <input
                                type="date"
                                value={draftRange.to}
                                onChange={(e) => setDraftRange((r) => ({ ...r, to: e.target.value }))}
                                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                            />
                        </div>
                        <button
                            onClick={applyRange}
                            className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors"
                        >
                            Apply
                        </button>
                        {(range.from || range.to) && (
                            <button
                                onClick={clearRange}
                                className="px-4 py-2 rounded-full bg-transparent text-white border border-white/20 text-sm font-medium hover:bg-white/5 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </SlideUp>

            {isEmpty ? (
                <div className="max-w-lg mx-auto mt-16 text-center bg-white/[0.02] border border-white/[0.08] rounded-2xl p-10">
                    <svg className="w-10 h-10 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-white mb-2">No records for this scope</h2>
                    <p className="text-sm text-gray-300">
                        There are no earnings or payout records{(range.from || range.to) ? ' in the selected date range' : ''}.
                    </p>
                </div>
            ) : (
                <>
                    {/* Region 1 — six headline figures (Req 1.1) */}
                    <FadeIn delay={0.05}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            <FigureCard label="Gross Collected" value={formatInr(overview?.grossCollected)} accent="green" />
                            <FigureCard label="Platform Commission Earned" value={formatInr(overview?.platformCommissionEarned)} accent="violet" />
                            <FigureCard label="GST Collected" value={formatInr(overview?.gstCollected)} accent="blue" />
                            <FigureCard label="Net Payable" value={formatInr(overview?.netPayable)} accent="orange" />
                            <FigureCard label="Paid Out" value={formatInr(overview?.paidOut)} accent="green" />
                            <FigureCard label="Pending Payout" value={formatInr(overview?.pendingPayout)} accent="pink" />
                        </div>
                    </FadeIn>

                    {/* Region 2 — reconciliation summary (Req 4.1, 4.4, 4.5) */}
                    <FadeIn delay={0.1}>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 mb-8">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-semibold text-white">Reconciliation</h2>
                                {recon.discrepancy && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Discrepancy detected
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                    <div className="text-sm text-gray-300 mb-1">Gross Collected</div>
                                    <div className="text-lg font-bold text-white">{formatInr(recon.grossCollected)}</div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                    <div className="text-sm text-gray-300 mb-1">Platform Retained</div>
                                    <div className="text-lg font-bold text-white">{formatInr(recon.platformRetained)}</div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                    <div className="text-sm text-gray-300 mb-1">Payee Attributed</div>
                                    <div className="text-lg font-bold text-white">{formatInr(recon.payeeAttributed)}</div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                    <div className="text-sm text-gray-300 mb-1">Refunded Total</div>
                                    <div className="text-lg font-bold text-white">{formatInr(recon.refundedTotal)}</div>
                                </div>
                            </div>
                            <div className={`mt-4 flex items-center justify-between px-4 py-3 rounded-xl border ${recon.discrepancy ? 'bg-red-500/[0.05] border-red-500/20' : 'bg-white/[0.02] border-white/[0.05]'}`}>
                                <span className={recon.discrepancy ? 'text-red-300' : 'text-gray-300'}>Residual</span>
                                <span className={`font-bold ${recon.discrepancy ? 'text-red-400' : 'text-white'}`}>{formatInr(recon.residual)}</span>
                            </div>
                        </div>
                    </FadeIn>

                    {/* Region 3 — per-recipient breakdown, two sections (Req 2) */}
                    <FadeIn delay={0.15}>
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-white">Per-Recipient Breakdown</h2>
                                <div className="text-sm text-gray-300">
                                    Ready to pay: <span className="font-bold text-white">{formatInr(recipients.readyToPayTotal)}</span>
                                </div>
                            </div>
                            <RecipientSection title="Event Organizers" rows={recipients.event_tickets} />
                            <RecipientSection title="Venue Owners" rows={recipients.venue_booking} />
                        </div>
                    </FadeIn>

                    {/* Region 4 — payout lifecycle list with status filter (Req 3) */}
                    <FadeIn delay={0.2}>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                                <h2 className="text-lg font-semibold text-white">Payout Lifecycle</h2>
                                <div className="flex flex-wrap gap-2">
                                    {FILTERABLE_STATUSES.map((s) => {
                                        const active = statuses.includes(s);
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => toggleStatus(s)}
                                                aria-pressed={active}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-colors ${active
                                                    ? 'bg-white text-black border-white'
                                                    : 'text-gray-300 border-white/15 hover:bg-white/5'
                                                    }`}
                                            >
                                                {s}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {payoutError ? (
                                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    {payoutError}
                                </div>
                            ) : payoutLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
                                </div>
                            ) : payouts.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm">
                                    No payouts match the selected filter.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-400 border-b border-white/[0.08]">
                                                <th className="py-3 pr-4 font-medium">Status</th>
                                                <th className="py-3 pr-4 font-medium text-right">Gross</th>
                                                <th className="py-3 pr-4 font-medium text-right">Commission</th>
                                                <th className="py-3 pr-4 font-medium text-right">%</th>
                                                <th className="py-3 pr-4 font-medium text-right">Net</th>
                                                <th className="py-3 pr-4 font-medium">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payouts.map((p) => (
                                                <tr key={p.payoutId} className="border-b border-white/[0.04] text-gray-200">
                                                    <td className="py-3 pr-4">
                                                        <div className="flex items-center gap-2">
                                                            <StatusBadge status={p.status} />
                                                            {p.refundAfterCompleted && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20">
                                                                    refund after payout
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 pr-4 text-right">{formatInr(p.grossAmount)}</td>
                                                    <td className="py-3 pr-4 text-right">{formatInr(p.platformCommission)}</td>
                                                    <td className="py-3 pr-4 text-right text-gray-400">{p.platformCommissionPercentage ?? 0}%</td>
                                                    <td className="py-3 pr-4 text-right font-medium text-white">{formatInr(p.netAmount)}</td>
                                                    <td className="py-3 pr-4 text-gray-400">
                                                        {p.status === 'completed' && p.processedAt && (
                                                            <span>Processed {new Date(p.processedAt).toLocaleDateString()}</span>
                                                        )}
                                                        {p.status === 'failed' && (
                                                            <span className="text-red-400">{p.failureReason || 'Failed'}</span>
                                                        )}
                                                        {p.status === 'unknown' && (
                                                            <span className="text-gray-500">Status unknown</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </FadeIn>
                </>
            )}
        </div>
    );
}

// Per-recipient section. Bank account number arrives already masked from the
// server (accountNumberMasked); recipients missing bank details show a badge and
// are excluded from readyToPayTotal server-side (Req 2.5, 2.6). Read-only (Req 2.7).
function RecipientSection({ title, rows }) {
    return (
        <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">{title}</h3>
            {(!rows || rows.length === 0) ? (
                <div className="text-sm text-gray-500 bg-white/[0.02] border border-white/[0.08] rounded-2xl px-4 py-6 text-center">
                    No recipients in this section.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {rows.map((r) => (
                        <div key={r.recipientId} className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="font-semibold text-white">{r.name || 'Unnamed recipient'}</div>
                                {r.bankDetailsMissing ? (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20">
                                        bank details missing
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20">
                                        owed {formatInr(r.owedNow)}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                <div>
                                    <div className="text-gray-400">Gross Earnings</div>
                                    <div className="text-white font-medium">{formatInr(r.grossEarnings)}</div>
                                </div>
                                <div>
                                    <div className="text-gray-400">Commission Deducted</div>
                                    <div className="text-white font-medium">{formatInr(r.commissionDeducted)}</div>
                                </div>
                                <div>
                                    <div className="text-gray-400">Net Payable</div>
                                    <div className="text-white font-medium">{formatInr(r.netPayable)}</div>
                                </div>
                                <div>
                                    <div className="text-gray-400">Owed Now</div>
                                    <div className="text-white font-medium">{formatInr(r.owedNow)}</div>
                                </div>
                            </div>
                            {r.bankDetails ? (
                                <div className="border-t border-white/[0.06] pt-3 text-xs text-gray-400 space-y-1">
                                    <div>{r.bankDetails.accountName}</div>
                                    <div className="font-mono text-gray-300">{r.bankDetails.accountNumberMasked}</div>
                                    <div>{r.bankDetails.bankName} · {r.bankDetails.ifscCode}</div>
                                </div>
                            ) : (
                                <div className="border-t border-white/[0.06] pt-3 text-xs text-gray-500">
                                    No bank details on file.
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
