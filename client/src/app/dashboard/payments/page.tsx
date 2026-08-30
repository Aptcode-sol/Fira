'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import { eventsApi, earningsApi } from '@/lib/api';
import type { EarningsPayoutStatus, EventEarningsDTO } from '@/lib/api';
import { FadeIn, SlideUp } from '@/components/animations';

interface OrganizedEvent {
    _id: string;
    name: string;
    startDateTime?: string;
    date?: string;
}

/** One event plus the earnings breakdown the server returned for it. */
interface EventEarningsRow extends EventEarningsDTO {
    eventId: string;
    eventName: string;
    when?: string;
}

const payoutStyles: Record<EarningsPayoutStatus, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    'not yet initiated': 'bg-white/[0.04] text-gray-400 border-white/10',
};

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

/**
 * Payments is now one thing: what the events you organise have earned.
 *
 * The old page mixed a spend ledger, an earnings ledger and a "net balance"
 * that netted the two against each other - three different questions in one
 * view, and none of them answered "how much is this event making?". Money you
 * paid out already has homes (a booking's own page, a ticket's own page), so
 * this screen keeps only the per-event earnings and the totals over them.
 */
export default function PaymentsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [rows, setRows] = useState<EventEarningsRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    const fetchEarnings = useCallback(async () => {
        if (!user?._id) return;
        try {
            setLoading(true);
            setError('');

            const response = await eventsApi.getUserEvents(user._id) as OrganizedEvent[] | { events?: OrganizedEvent[]; data?: OrganizedEvent[] };
            const events = Array.isArray(response)
                ? response
                : (response?.events || response?.data || []);

            // One event failing (not settled yet, permissions, a 404) must not
            // blank the whole table, so each result is settled on its own and
            // the failures are simply left out.
            const settled = await Promise.allSettled(
                events.map(async (e): Promise<EventEarningsRow> => ({
                    ...(await earningsApi.getEventEarnings(e._id)),
                    eventId: e._id,
                    eventName: e.name,
                    when: e.startDateTime || e.date,
                }))
            );

            const earned = settled
                .filter((r): r is PromiseFulfilledResult<EventEarningsRow> => r.status === 'fulfilled')
                .map((r) => r.value)
                .sort((a, b) => b.netEarnings - a.netEarnings);

            setRows(earned);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load earnings');
        } finally {
            setLoading(false);
        }
    }, [user?._id]);

    useEffect(() => {
        if (isAuthenticated && user?._id) fetchEarnings();
    }, [isAuthenticated, user?._id, fetchEarnings]);

    if (isLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    const sum = (pick: (r: EventEarningsRow) => number) => rows.reduce((total, r) => total + (pick(r) || 0), 0);
    const totals = {
        gross: sum((r) => r.grossTicketSales),
        commission: sum((r) => r.platformCommissionDeducted),
        gst: sum((r) => r.gst),
        net: sum((r) => r.netEarnings),
    };

    const summary = [
        { label: 'Gross ticket sales', value: inr(totals.gross), tone: 'text-white' },
        { label: 'Platform commission', value: `- ${inr(totals.commission)}`, tone: 'text-gray-300' },
        { label: 'GST', value: `- ${inr(totals.gst)}`, tone: 'text-gray-300' },
        { label: 'Net earnings', value: inr(totals.net), tone: 'text-emerald-400', highlight: true },
    ];

    const columns: Column<EventEarningsRow>[] = [
        {
            key: 'event',
            header: 'Event',
            primary: true,
            cell: (r) => <span className="font-medium text-white">{r.eventName}</span>,
        },
        {
            key: 'when',
            header: 'Date',
            cell: (r) => (
                <span className="whitespace-nowrap text-gray-300">
                    {r.when
                        ? new Date(r.when).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                </span>
            ),
        },
        {
            key: 'gross',
            header: 'Gross sales',
            align: 'right',
            cell: (r) => <span className="text-white">{inr(r.grossTicketSales)}</span>,
        },
        {
            key: 'commission',
            header: 'Commission',
            align: 'right',
            cell: (r) => <span className="text-gray-300">{inr(r.platformCommissionDeducted)}</span>,
        },
        {
            key: 'gst',
            header: 'GST',
            align: 'right',
            cell: (r) => <span className="text-gray-300">{inr(r.gst)}</span>,
        },
        {
            key: 'net',
            header: 'Net earnings',
            align: 'right',
            cell: (r) => <span className="font-semibold text-emerald-400">{inr(r.netEarnings)}</span>,
        },
        {
            key: 'payout',
            header: 'Payout',
            align: 'center',
            cell: (r) => (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border capitalize ${payoutStyles[r.payoutStatus] ?? payoutStyles['not yet initiated']}`}>
                    {r.payoutStatus}
                </span>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                <SlideUp>
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Event Earnings</h1>
                        <p className="text-gray-300">What each event you organise has earned, after commission and GST</p>
                    </div>
                </SlideUp>

                {/* Totals across every event, in the same order the per-event row
                    reads: gross, minus commission, minus GST, equals net. */}
                <FadeIn delay={0.1}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                        {summary.map((card) => (
                            <div
                                key={card.label}
                                className={`rounded-2xl p-5 backdrop-blur-sm border ${card.highlight
                                    ? 'bg-gradient-to-br from-emerald-500/15 to-violet-500/10 border-emerald-500/20'
                                    : 'bg-white/[0.02] border-white/[0.08]'
                                    }`}
                            >
                                <div className="text-xs sm:text-sm text-gray-300 mb-1">{card.label}</div>
                                <div className={`text-xl sm:text-2xl font-bold ${card.tone}`}>
                                    {loading ? <span className="inline-block w-20 h-7 bg-white/10 rounded animate-pulse" /> : card.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </FadeIn>

                {error && (
                    <div className="text-center py-16">
                        <p className="text-red-400 mb-4">{error}</p>
                        <Button onClick={fetchEarnings}>Try Again</Button>
                    </div>
                )}

                {!error && (
                    <FadeIn delay={0.2} animateOnMount>
                        <DataTable
                            rows={rows}
                            columns={columns}
                            rowKey={(r) => r.eventId}
                            onRowClick={(r) => router.push(`/dashboard/events/${r.eventId}`)}
                            loading={loading}
                            pageSize={10}
                            label={(n) => `${n} event${n === 1 ? '' : 's'}`}
                            empty={
                                <>
                                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <h3 className="text-xl font-semibold text-white mb-2">No event earnings yet</h3>
                                    <p className="text-gray-300 mb-6">Create an event and sell tickets to start earning.</p>
                                    <Button onClick={() => router.push('/create/event')}>Create Event</Button>
                                </>
                            }
                        />
                    </FadeIn>
                )}
            </div>
        </DashboardLayout>
    );
}
