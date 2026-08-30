'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import { venuesApi, earningsApi } from '@/lib/api';
import type { VenueEarningsBooking } from '@/lib/api';
import { formatInr } from '@/lib/formatInr';
import { Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { FadeIn, SlideUp } from '@/components/animations';

interface OwnerVenue {
    _id: string;
    name: string;
}

/** One owned venue rolled up from its per-booking earnings rows. */
interface VenueEarningsRow {
    venueId: string;
    venueName: string;
    bookings: number;
    gross: number;
    commission: number;
    net: number;
    /** Net payable that has not reached the owner's account yet. */
    pendingPayout: number;
}

// Req 12.3: retrieval that does not complete within 30 seconds is treated as a
// failure. The shared `request` helper has no timeout, so the earnings fetch
// races against this deadline and surfaces the error state on breach.
const RETRIEVAL_TIMEOUT_MS = 30000;

type EarningsState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; rows: VenueEarningsRow[] };

/**
 * Money that has been earned but not yet settled by the platform. "failed" is
 * deliberately excluded - it needs support, not patience, so folding it into a
 * "pending payout" figure would overstate what is actually on its way.
 */
const isAwaitingPayout = (status: VenueEarningsBooking['payoutStatus']) =>
    status === 'pending' || status === 'processing' || status === 'not yet initiated';

const rollUp = (venue: OwnerVenue, bookings: VenueEarningsBooking[]): VenueEarningsRow => ({
    venueId: venue._id,
    venueName: venue.name,
    bookings: bookings.length,
    gross: bookings.reduce((t, b) => t + (b.grossBookingAmount || 0), 0),
    commission: bookings.reduce((t, b) => t + (b.commissionDeducted || 0), 0),
    net: bookings.reduce((t, b) => t + (b.netPayable || 0), 0),
    pendingPayout: bookings
        .filter((b) => isAwaitingPayout(b.payoutStatus))
        .reduce((t, b) => t + (b.netPayable || 0), 0),
});

/**
 * Earnings answers two questions at the top - what have I earned in total, and
 * what is the platform still holding - and then breaks the total down by venue.
 *
 * It replaced a per-booking table behind a venue picker: that view could only
 * ever show one venue at a time and never added up to a total, so an owner with
 * four venues had to do the arithmetic themselves.
 */
export default function VenuePortalEarningsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const [earnings, setEarnings] = useState<EarningsState>({ status: 'loading' });

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
            return;
        }
        if (!isLoading && isAuthenticated && !isVenueOwner(user)) {
            router.push('/dashboard');
        }
    }, [isLoading, isAuthenticated, user, router]);

    const fetchEarnings = useCallback(async () => {
        if (!user?._id) return;
        setEarnings({ status: 'loading' });
        try {
            const rows = await Promise.race([
                (async () => {
                    const response = await venuesApi.getUserVenues(user._id) as unknown;
                    const list = Array.isArray(response)
                        ? response
                        : ((response as { venues?: OwnerVenue[] })?.venues || []);
                    const venues: OwnerVenue[] = list.map((v: { _id: string; name: string }) => ({ _id: v._id, name: v.name }));

                    // One venue's breakdown failing must not blank the others, so
                    // each is settled on its own and failures are left out.
                    const settled = await Promise.allSettled(
                        venues.map(async (v) => rollUp(v, (await earningsApi.getVenueEarnings(v._id))?.bookings ?? []))
                    );
                    return settled
                        .filter((r): r is PromiseFulfilledResult<VenueEarningsRow> => r.status === 'fulfilled')
                        .map((r) => r.value)
                        .sort((a, b) => b.net - a.net);
                })(),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), RETRIEVAL_TIMEOUT_MS)
                ),
            ]);
            setEarnings({ status: 'ready', rows });
        } catch {
            setEarnings({ status: 'error' });
        }
    }, [user?._id]);

    useEffect(() => {
        if (isAuthenticated && user?._id) fetchEarnings();
    }, [isAuthenticated, user?._id, fetchEarnings]);

    if (isLoading) {
        return (
            <VenueDashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </VenueDashboardLayout>
        );
    }

    if (!isAuthenticated || !isVenueOwner(user)) {
        return null;
    }

    const rows = earnings.status === 'ready' ? earnings.rows : [];
    const loading = earnings.status === 'loading';
    const totals = {
        net: rows.reduce((t, r) => t + r.net, 0),
        pending: rows.reduce((t, r) => t + r.pendingPayout, 0),
        gross: rows.reduce((t, r) => t + r.gross, 0),
    };
    const settled = totals.net - totals.pending;

    const columns: Column<VenueEarningsRow>[] = [
        {
            key: 'venue',
            header: 'Venue',
            primary: true,
            cell: (r) => <span className="font-medium text-white">{r.venueName}</span>,
        },
        {
            key: 'bookings',
            header: 'Bookings',
            align: 'right',
            cell: (r) => <span>{r.bookings}</span>,
        },
        {
            key: 'gross',
            header: 'Gross',
            align: 'right',
            cell: (r) => <span className="text-gray-300">{formatInr(r.gross)}</span>,
        },
        {
            key: 'commission',
            header: 'Commission',
            align: 'right',
            cell: (r) => <span className="text-gray-300">{formatInr(r.commission)}</span>,
        },
        {
            key: 'net',
            header: 'Earnings',
            align: 'right',
            cell: (r) => <span className="font-semibold text-white">{formatInr(r.net)}</span>,
        },
        {
            key: 'pending',
            header: 'Pending payout',
            align: 'right',
            cell: (r) =>
                r.pendingPayout > 0
                    ? <span className="text-amber-400 font-medium">{formatInr(r.pendingPayout)}</span>
                    : <span className="text-gray-500">—</span>,
        },
    ];

    return (
        <VenueDashboardLayout>
            <div className="p-4 sm:p-6 lg:p-8">
                <SlideUp>
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Earnings</h1>
                        <p className="text-sm sm:text-base text-gray-300">
                            What your venues have earned, and what is still to be paid out
                        </p>
                    </div>
                </SlideUp>

                {/* Total earnings and the pending payout lead, because they are the
                    two numbers an owner actually opens this page for. */}
                <FadeIn delay={0.1}>
                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 mb-6">
                        <div className="bg-gradient-to-br from-emerald-500/15 to-violet-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-5 sm:p-6">
                            <div className="text-sm text-gray-300 mb-1">Total earnings</div>
                            <div className="text-3xl sm:text-4xl font-bold text-white">
                                {loading ? <span className="inline-block w-32 h-9 bg-white/10 rounded animate-pulse" /> : formatInr(totals.net)}
                            </div>
                            <div className="text-xs text-gray-400 mt-2">
                                {loading ? '\u00A0' : `From ${formatInr(totals.gross)} gross across ${rows.length} venue${rows.length === 1 ? '' : 's'}`}
                            </div>
                        </div>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-amber-500/20 rounded-2xl p-5 sm:p-6">
                            <div className="text-sm text-gray-300 mb-1">Pending payout from admin</div>
                            <div className="text-3xl sm:text-4xl font-bold text-amber-400">
                                {loading ? <span className="inline-block w-32 h-9 bg-white/10 rounded animate-pulse" /> : formatInr(totals.pending)}
                            </div>
                            <div className="text-xs text-gray-400 mt-2">
                                {loading ? '\u00A0' : `${formatInr(settled)} already settled`}
                            </div>
                        </div>
                    </div>
                </FadeIn>

                {earnings.status === 'error' ? (
                    // Req 12.3 / 6.9: error indication + retry, shown alone
                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl text-center py-12">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                            </svg>
                        </div>
                        <p className="text-gray-200 text-sm mb-4">Earnings could not be loaded.</p>
                        <Button onClick={fetchEarnings}>Retry</Button>
                    </div>
                ) : (
                    <FadeIn delay={0.2}>
                        <h2 className="text-base sm:text-lg font-semibold text-white mb-3">Earnings by venue</h2>
                        <DataTable
                            rows={rows}
                            columns={columns}
                            rowKey={(r) => r.venueId}
                            onRowClick={(r) => router.push(`/dashboard/venues/${r.venueId}`)}
                            loading={loading}
                            pageSize={10}
                            label={(n) => `${n} venue${n === 1 ? '' : 's'}`}
                            empty={
                                <>
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m-6 4h6m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                                        </svg>
                                    </div>
                                    <p className="text-gray-300 text-sm">No venue earnings yet. Add a venue and take a booking to see it here.</p>
                                </>
                            }
                        />
                    </FadeIn>
                )}
            </div>
        </VenueDashboardLayout>
    );
}
