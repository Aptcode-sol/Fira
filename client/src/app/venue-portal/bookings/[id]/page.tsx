'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import { bookingsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { FadeIn, SlideUp } from '@/components/animations';

interface Booking {
    _id: string;
    venue: { _id: string; name: string; images?: string[] };
    user: { _id: string; name: string; email: string; phone?: string };
    bookingDate: string;
    startTime: string;
    endTime: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    purpose?: string;
    expectedGuests?: number;
    createdAt: string;
}

const statusStyle = (status: string) => {
    switch (status) {
        case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'accepted': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
        default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
};

/**
 * One booking request in full, opened from a row in the portal's Bookings list.
 * Accept and Reject are here as well as in the list: the list is for triaging at
 * a glance, this is for deciding once you have read the whole request.
 */
export default function VenueBookingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const { showToast } = useToast();
    const [booking, setBooking] = useState<Booking | null>(null);
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

    const fetchBooking = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await bookingsApi.getById(id) as Booking | { booking: Booking };
            setBooking('booking' in data ? data.booking : data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load booking');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchBooking(); }, [fetchBooking]);

    const updateStatus = async (status: 'accepted' | 'rejected') => {
        if (!booking) return;
        let reason = '';
        if (status === 'rejected') {
            const promptReason = window.prompt('Please enter a reason for rejecting this booking:');
            if (promptReason === null) return;
            reason = promptReason || 'Rejected by venue owner';
        }
        setBusy(true);
        try {
            await bookingsApi.updateStatus(booking._id, status, reason);
            showToast(`Booking ${status} successfully`, 'success');
            fetchBooking();
        } catch {
            showToast('Failed to update booking status', 'error');
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

    return (
        <VenueDashboardLayout>
            <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
                <SlideUp>
                    <Link href="/venue-portal/bookings" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Bookings
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                        {loading ? 'Booking' : (booking?.venue?.name || 'Booking')}
                    </h1>
                </SlideUp>

                {loading ? (
                    <div className="mt-6 h-64 bg-white/[0.04] rounded-2xl animate-pulse" />
                ) : error || !booking ? (
                    <div className="mt-10 text-center">
                        <p className="text-red-400 mb-4">{error || 'Booking not found'}</p>
                        <Button onClick={() => router.push('/venue-portal/bookings')}>Back to Bookings</Button>
                    </div>
                ) : (
                    <FadeIn animateOnMount>
                        <div className="mt-6 space-y-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${statusStyle(booking.status)}`}>
                                    {booking.status}
                                </span>
                                <span className="text-sm text-gray-400">
                                    Requested {new Date(booking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </div>

                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
                                <h2 className="text-sm font-semibold text-white mb-4">Request</h2>
                                <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                    {[
                                        ['Date', new Date(booking.bookingDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })],
                                        ['Time', `${booking.startTime} - ${booking.endTime}`],
                                        ['Expected guests', booking.expectedGuests ? `${booking.expectedGuests}` : '—'],
                                        ['Purpose', booking.purpose || 'Not specified'],
                                        ['Total price', `₹${booking.totalAmount?.toLocaleString() ?? 0}`],
                                        ['Payment', booking.paymentStatus],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-baseline justify-between gap-4">
                                            <dt className="text-gray-400 shrink-0">{label}</dt>
                                            <dd className="text-gray-200 text-right min-w-0 break-words capitalize">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
                                <h2 className="text-sm font-semibold text-white mb-4">Booker</h2>
                                <dl className="space-y-3 text-sm">
                                    {[
                                        ['Name', booking.user?.name],
                                        ['Email', booking.user?.email],
                                        ['Phone', booking.user?.phone || '—'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-baseline justify-between gap-4">
                                            <dt className="text-gray-400 shrink-0">{label}</dt>
                                            <dd className="text-gray-200 text-right min-w-0 break-all">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            {booking.status === 'pending' && (
                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={() => updateStatus('accepted')} disabled={busy}>
                                        {busy ? 'Processing...' : 'Accept Booking'}
                                    </Button>
                                    <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => updateStatus('rejected')} disabled={busy}>
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
