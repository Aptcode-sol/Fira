'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import { eventsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { FadeIn, SlideUp } from '@/components/animations';

interface EventRequest {
    _id: string;
    name: string;
    description?: string;
    organizer?: { _id: string; name: string; email: string };
    venue?: { _id: string; name: string };
    startDateTime: string;
    endDateTime: string;
    maxAttendees: number;
    ticketPrice?: number;
    venueApproval?: { status: string; rejectionReason?: string };
    createdAt: string;
}

const statusStyle = (status: string) => {
    switch (status) {
        case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
        default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
};

const formatDateTime = (value?: string) => {
    if (!value) return 'N/A';
    const dt = new Date(value);
    if (isNaN(dt.getTime())) return 'Invalid Date';
    return dt.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

/**
 * One event request in full, opened from a row in the portal's Event Requests
 * list. Approve and Reject are here as well as in the list: the list triages,
 * this decides once the whole request has been read.
 */
export default function VenueEventRequestDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const { showToast } = useToast();
    const [event, setEvent] = useState<EventRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
            return;
        }
        if (!isLoading && isAuthenticated && !isVenueOwner(user)) {
            router.push('/dashboard');
        }
    }, [isLoading, isAuthenticated, user, router]);

    const fetchEvent = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await eventsApi.getById(id) as EventRequest | { event: EventRequest };
            setEvent(data && 'event' in data ? data.event : data as EventRequest);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load event request');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchEvent(); }, [fetchEvent]);

    const decide = async (status: 'approved' | 'rejected') => {
        if (!user?._id || !event) return;
        let rejectionReason: string | undefined;
        if (status === 'rejected') {
            const reason = window.prompt('Please enter a reason for rejecting this event:');
            if (reason === null) return;
            rejectionReason = reason || 'Rejected by venue owner';
        }
        setBusy(true);
        try {
            await eventsApi.venueApprove(event._id, { venueOwnerId: user._id, status, rejectionReason });
            showToast(`Event ${status}!`, 'success');
            fetchEvent();
        } catch {
            showToast('Failed to update event status', 'error');
        } finally {
            setBusy(false);
        }
    };

    if (isLoading || !isAuthenticated || !isVenueOwner(user)) {
        return (
            <VenueDashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </VenueDashboardLayout>
        );
    }

    const status = event?.venueApproval?.status || 'pending';

    return (
        <VenueDashboardLayout>
            <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
                <SlideUp>
                    <Link href="/venue-portal/events" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Event Requests
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                        {loading ? 'Event request' : (event?.name || 'Event request')}
                    </h1>
                </SlideUp>

                {loading ? (
                    <div className="mt-6 h-64 bg-white/[0.04] rounded-2xl animate-pulse" />
                ) : error || !event ? (
                    <div className="mt-10 text-center">
                        <p className="text-red-400 mb-4">{error || 'Event request not found'}</p>
                        <Button onClick={() => router.push('/venue-portal/events')}>Back to Event Requests</Button>
                    </div>
                ) : (
                    <FadeIn animateOnMount>
                        <div className="mt-6 space-y-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${statusStyle(status)}`}>
                                    {status}
                                </span>
                                <span className="text-sm text-gray-400">
                                    Requested {new Date(event.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </div>

                            {event.venueApproval?.rejectionReason && status === 'rejected' && (
                                <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                    Rejection reason: {event.venueApproval.rejectionReason}
                                </p>
                            )}

                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
                                <h2 className="text-sm font-semibold text-white mb-4">Request</h2>
                                <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                    {[
                                        ['Venue', event.venue?.name || '—'],
                                        ['Capacity', `${event.maxAttendees ?? '—'}`],
                                        ['From', formatDateTime(event.startDateTime)],
                                        ['To', formatDateTime(event.endDateTime)],
                                        ['Ticket price', event.ticketPrice ? `₹${event.ticketPrice.toLocaleString()}` : 'Free'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-baseline justify-between gap-4">
                                            <dt className="text-gray-400 shrink-0">{label}</dt>
                                            <dd className="text-gray-200 text-right min-w-0 break-words">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                {event.description && (
                                    <p className="mt-4 pt-4 border-t border-white/[0.05] text-sm text-gray-300 whitespace-pre-line">
                                        {event.description}
                                    </p>
                                )}
                            </div>

                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
                                <h2 className="text-sm font-semibold text-white mb-4">Organizer</h2>
                                <dl className="space-y-3 text-sm">
                                    {[
                                        ['Name', event.organizer?.name || '—'],
                                        ['Email', event.organizer?.email || '—'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-baseline justify-between gap-4">
                                            <dt className="text-gray-400 shrink-0">{label}</dt>
                                            <dd className="text-gray-200 text-right min-w-0 break-all">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            {status === 'pending' && (
                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={() => decide('approved')} disabled={busy}>
                                        {busy ? 'Processing...' : 'Approve Event'}
                                    </Button>
                                    <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => decide('rejected')} disabled={busy}>
                                        Reject
                                    </Button>
                                </div>
                            )}
                        </div>
                    </FadeIn>
                )}
            </div>
        </VenueDashboardLayout>
    );
}
