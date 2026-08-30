'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { bookingsApi } from '@/lib/api';
import { FadeIn, SlideUp } from '@/components/animations';

interface Booking {
    _id: string;
    venue: { _id: string; name: string; images?: string[]; address?: { city?: string; state?: string } };
    bookingDate: string;
    startTime: string;
    endTime: string;
    purpose?: string;
    expectedGuests: number;
    status: string;
    paymentStatus: string;
    totalAmount: number;
}

declare global {
    interface Window {
        Razorpay: any;
    }
}

const statusStyle = (status: string) => {
    switch (status) {
        case 'accepted': return 'bg-green-500/20 text-green-400 border-green-500/20';
        case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
        case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
        case 'cancelled':
        case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/20';
        default: return 'bg-gray-500/20 text-gray-300 border-gray-500/20';
    }
};

/** Advance is 10% of the total, same rule the list used to state inline. */
const advanceOf = (total: number) => Math.round(total * 0.10);

/**
 * Dedicated page for one booking, opened from a row in My Bookings. Everything
 * that acts on a booking - paying the advance, cancelling a pending request -
 * lives here, so the Razorpay checkout script is only loaded on the one screen
 * that can actually use it.
 */
export default function BookingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const { showToast } = useToast();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.push('/signin');
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, []);

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

    const handlePayAdvance = async () => {
        if (!user?._id || !booking) return;
        setBusy(true);
        try {
            const advance = advanceOf(booking.totalAmount);
            const paymentData = await bookingsApi.initiatePayment(booking._id, user._id);
            const razorpay = new window.Razorpay({
                key: paymentData.keyId,
                amount: paymentData.amount,
                currency: paymentData.currency,
                name: 'FIRA',
                description: `Advance (10%) - ${booking.venue?.name}`,
                order_id: paymentData.gatewayOrderId,
                handler: async (response: any) => {
                    try {
                        await bookingsApi.verifyPayment(booking._id, {
                            gatewayOrderId: response.razorpay_order_id,
                            gatewayPaymentId: response.razorpay_payment_id,
                            gatewaySignature: response.razorpay_signature,
                        });
                        showToast(`Advance of ₹${advance.toLocaleString()} paid successfully!`, 'success');
                        fetchBooking();
                    } catch {
                        showToast('Payment verification failed. Please contact support.', 'error');
                    }
                },
                prefill: { name: user.name, email: user.email },
                theme: { color: '#8b5cf6' },
                modal: { ondismiss: () => setBusy(false) },
            });
            razorpay.open();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to initiate payment', 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleCancel = async () => {
        if (!user?._id || !booking) return;
        setBusy(true);
        try {
            await bookingsApi.cancel(booking._id, user._id);
            setBooking({ ...booking, status: 'cancelled' });
            showToast('Booking cancelled successfully', 'success');
        } catch {
            showToast('Failed to cancel booking', 'error');
        } finally {
            setBusy(false);
        }
    };

    if (isLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    const formatDate = (value: string) =>
        new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const advance = booking ? advanceOf(booking.totalAmount) : 0;

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 max-w-3xl">
                <SlideUp>
                    <Link href="/dashboard/bookings" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to My Bookings
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
                        <Button onClick={() => router.push('/dashboard/bookings')}>Back to My Bookings</Button>
                    </div>
                ) : (
                    <FadeIn animateOnMount>
                        <div className="mt-6 space-y-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${statusStyle(booking.status)}`}>
                                    {booking.status}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${booking.paymentStatus === 'paid'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                    : 'bg-orange-500/20 text-orange-400 border-orange-500/20'
                                    }`}>
                                    {booking.paymentStatus === 'paid' ? 'Advance paid' : 'Advance pending'}
                                </span>
                            </div>

                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
                                <h2 className="text-sm font-semibold text-white mb-4">Booking</h2>
                                <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                    {[
                                        ['Date', formatDate(booking.bookingDate)],
                                        ['Time', `${booking.startTime} - ${booking.endTime}`],
                                        ['Guests', `${booking.expectedGuests} people`],
                                        ['Purpose', booking.purpose || 'Not specified'],
                                        ['Location', [booking.venue?.address?.city, booking.venue?.address?.state].filter(Boolean).join(', ') || '—'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-baseline justify-between gap-4">
                                            <dt className="text-gray-400 shrink-0">{label}</dt>
                                            <dd className="text-gray-200 text-right min-w-0 break-words">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            <div className="bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-2xl p-5 border border-violet-500/20">
                                <h2 className="text-sm font-semibold text-white mb-3">Payment summary</h2>
                                <dl className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="text-gray-300">Total amount</dt>
                                        <dd className="text-white">₹{booking.totalAmount?.toLocaleString()}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-300">Advance (10%)</dt>
                                        <dd className={booking.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-violet-400'}>
                                            ₹{advance.toLocaleString()}
                                        </dd>
                                    </div>
                                    <div className="border-t border-white/10 pt-2 flex justify-between font-medium">
                                        <dt className="text-gray-300">Remaining</dt>
                                        <dd className="text-white">₹{(booking.totalAmount - advance).toLocaleString()}</dd>
                                    </div>
                                </dl>
                                <p className="text-yellow-400 text-xs mt-3">
                                    Pay the remaining amount at the venue on your booking date.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {booking.status === 'accepted' && booking.paymentStatus !== 'paid' && (
                                    <Button onClick={handlePayAdvance} disabled={busy}>
                                        {busy ? 'Processing...' : `Pay Advance ₹${advance.toLocaleString()}`}
                                    </Button>
                                )}
                                {booking.status === 'pending' && (
                                    <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={handleCancel} disabled={busy}>
                                        Cancel Request
                                    </Button>
                                )}
                                {booking.venue?._id && (
                                    <Link href={`/venues/${booking.venue._id}`}>
                                        <Button variant="secondary">View Venue</Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </FadeIn>
                )}
            </div>
        </DashboardLayout>
    );
}
