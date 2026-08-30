'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { FadeIn, SlideUp } from '@/components/animations';
import { earningsApi, type EventEarningsDTO, type EarningsPayoutStatus } from '@/lib/api';
import { formatInr } from '@/lib/formatInr';

// The three surface states are mutually exclusive at all times (Requirement 12):
// exactly one of loading / empty / error / ready is rendered.
type ViewState = 'loading' | 'ready' | 'empty' | 'error';

// Requirement 12.3: retrieval that does not complete within 30 s is treated as
// a failure and shown as the error state (with retry).
const RETRIEVAL_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (err) => { clearTimeout(timer); reject(err); },
        );
    });
}

// A per-event scope with no collected payments and no initiated payout is the
// "no records" case (Requirement 12.2) rather than a breakdown of zeros.
function hasNoRecords(d: EventEarningsDTO): boolean {
    return (
        d.grossTicketSales === 0 &&
        d.platformCommissionDeducted === 0 &&
        d.gst === 0 &&
        d.netEarnings === 0 &&
        d.payoutStatus === 'not yet initiated'
    );
}

const PAYOUT_STATUS_STYLES: Record<EarningsPayoutStatus, string> = {
    completed: 'bg-green-500/20 text-green-400 border-green-500/20',
    processing: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    failed: 'bg-red-500/20 text-red-400 border-red-500/20',
    'not yet initiated': 'bg-gray-500/20 text-gray-300 border-gray-500/20',
};

function EarningsContent() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const searchParams = useSearchParams();
    // Mirror the `?venue=` convention used by create/event: the event scope is
    // read from a search param so the segment stays at .../earnings.
    const eventId = searchParams.get('event');

    const [state, setState] = useState<ViewState>('loading');
    const [earnings, setEarnings] = useState<EventEarningsDTO | null>(null);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    const fetchEarnings = useCallback(async () => {
        if (!eventId) {
            setEarnings(null);
            setState('empty');
            return;
        }
        // Return to the loading indicator on (re)fetch (Requirement 12.1, 12.4).
        setState('loading');
        try {
            const data = await withTimeout(
                earningsApi.getEventEarnings(eventId),
                RETRIEVAL_TIMEOUT_MS,
            );
            setEarnings(data);
            setState(hasNoRecords(data) ? 'empty' : 'ready');
        } catch {
            setEarnings(null);
            setState('error');
        }
    }, [eventId]);

    useEffect(() => {
        if (isAuthenticated && user?._id) {
            fetchEarnings();
        }
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

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                <SlideUp>
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-1">Event Earnings</h1>
                        <p className="text-gray-300">Gross sales, platform commission, GST, and net earnings for your event</p>
                    </div>
                </SlideUp>

                {/* Loading: mutually exclusive with empty/error */}
                {state === 'loading' && (
                    <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 max-w-2xl">
                        <div className="h-6 w-40 bg-white/[0.05] rounded animate-pulse mb-6" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="rounded-xl border border-white/[0.06] p-4">
                                    <div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse mb-3" />
                                    <div className="h-7 w-28 bg-white/[0.05] rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                        <div className="h-5 w-48 bg-white/[0.05] rounded animate-pulse mt-6" />
                    </div>
                )}

                {/* Error: retry control (Requirement 12.3, 12.4) */}
                {state === 'error' && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 text-red-400/70 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-white mb-2">Couldn&apos;t load earnings</h3>
                        <p className="text-gray-300 mb-6">Something went wrong while loading this event&apos;s earnings.</p>
                        <Button onClick={fetchEarnings}>Try Again</Button>
                    </div>
                )}

                {/* Empty: no event selected, or event has no records */}
                {state === 'empty' && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m-6 4h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-white mb-2">
                            {eventId ? 'No earnings yet' : 'No event selected'}
                        </h3>
                        <p className="text-gray-300 mb-6">
                            {eventId
                                ? 'This event has no recorded ticket sales or payouts yet.'
                                : 'Choose an event to view its earnings breakdown.'}
                        </p>
                        <Button variant="secondary" onClick={() => router.push('/dashboard/events')}>
                            Go to My Events
                        </Button>
                    </div>
                )}

                {/* Ready: per-event breakdown card */}
                {state === 'ready' && earnings && (
                    <FadeIn>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 max-w-2xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Figure label="Gross ticket sales" value={earnings.grossTicketSales} />
                                <Figure label="Platform commission" value={earnings.platformCommissionDeducted} />
                                <Figure label="GST" value={earnings.gst} />
                                <Figure label="Net earnings" value={earnings.netEarnings} emphasize />
                            </div>

                            <div className="mt-6 pt-6 border-t border-white/[0.06] flex items-center justify-between">
                                <span className="text-sm text-gray-300">Payout status</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${PAYOUT_STATUS_STYLES[earnings.payoutStatus]}`}>
                                    {earnings.payoutStatus}
                                </span>
                            </div>
                        </div>
                    </FadeIn>
                )}
            </div>
        </DashboardLayout>
    );
}

function Figure({ label, value, emphasize }: { label: string; value: number | null | undefined; emphasize?: boolean }) {
    return (
        <div className={`rounded-xl border p-4 ${emphasize ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/[0.06]'}`}>
            <p className="text-sm text-gray-300 mb-1">{label}</p>
            {/* Absent/null → ₹0 (Requirement 9.5) is handled inside formatInr. */}
            <p className={`text-2xl font-bold ${emphasize ? 'text-violet-300' : 'text-white'}`}>{formatInr(value)}</p>
        </div>
    );
}

// useSearchParams() must sit behind a Suspense boundary for prerendering
// (same pattern as signin / create-event).
export default function EventEarningsPage() {
    return (
        <Suspense
            fallback={
                <DashboardLayout>
                    <div className="min-h-screen flex items-center justify-center">
                        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                    </div>
                </DashboardLayout>
            }
        >
            <EarningsContent />
        </Suspense>
    );
}
