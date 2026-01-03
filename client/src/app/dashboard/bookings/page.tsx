'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button, Modal } from '@/components/ui';
import { bookingsApi } from '@/lib/api';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { useToast } from '@/components/ui/Toast';
import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';

type BookingStatus = 'all' | 'pending' | 'accepted' | 'completed' | 'cancelled';

interface Booking {
    _id: string;
    venue: {
        _id: string;
        name: string;
        images?: string[];
        address?: {
            street?: string;
            city?: string;
            state?: string;
        };
    };
    bookingDate: string;
    startTime: string;
    endTime: string;
    purpose?: string;
    expectedGuests: number;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    platformFee?: number;
}

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function BookingsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const { showToast } = useToast();
    const [statusFilter, setStatusFilter] = useState<BookingStatus>('all');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    // Load Razorpay script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const fetchBookings = useCallback(async () => {
        if (!user?._id) return;
        try {
            setLoading(true);
            const data = await bookingsApi.getUserBookings(user._id) as Booking[];
            setBookings(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load bookings');
        } finally {
            setLoading(false);
        }
    }, [user?._id]);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated && user?._id) {
            fetchBookings();
        }
    }, [isAuthenticated, user?._id, fetchBookings]);

    // Calculate 10% advance
    const getAdvanceAmount = (total: number) => Math.round(total * 0.10);

    const handlePayAdvance = async (booking: Booking) => {
        if (!user?._id) return;

        setPayingBookingId(booking._id);
        try {
            const advanceAmount = getAdvanceAmount(booking.totalAmount);
            const paymentData = await bookingsApi.initiatePayment(booking._id, user._id);

            const options = {
                key: paymentData.keyId,
                amount: paymentData.amount,
                currency: paymentData.currency,
                name: 'FIRA',
                description: `Advance (10%) - ${booking.venue?.name}`,
                order_id: paymentData.gatewayOrderId,
                handler: async function (response: any) {
                    try {
                        await bookingsApi.verifyPayment(booking._id, {
                            gatewayOrderId: response.razorpay_order_id,
                            gatewayPaymentId: response.razorpay_payment_id,
                            gatewaySignature: response.razorpay_signature,
                        });

                        showToast(`Advance of ₹${advanceAmount.toLocaleString()} paid successfully!`, 'success');
                        fetchBookings();
                    } catch (err) {
                        showToast('Payment verification failed. Please contact support.', 'error');
                    }
                },
                prefill: {
                    name: user.name,
                    email: user.email,
                },
                theme: {
                    color: '#8b5cf6',
                },
                modal: {
                    ondismiss: function () {
                        setPayingBookingId(null);
                    },
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to initiate payment', 'error');
        } finally {
            setPayingBookingId(null);
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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const filteredBookings = statusFilter === 'all'
        ? bookings
        : bookings.filter((b) => b.status === statusFilter);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'accepted':
                return 'bg-green-500/20 text-green-400 border-green-500/20';
            case 'pending':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
            case 'completed':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
            case 'cancelled':
            case 'rejected':
                return 'bg-red-500/20 text-red-400 border-red-500/20';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
        }
    };

    const getPaymentStatusColor = (status: string) => {
        switch (status) {
            case 'paid':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
            case 'pending':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/20';
            case 'failed':
                return 'bg-red-500/20 text-red-400 border-red-500/20';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
        }
    };

    const handleCancelBooking = async (bookingId: string) => {
        if (!user?._id) return;
        try {
            await bookingsApi.cancel(bookingId, user._id);
            setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, status: 'cancelled' } : b));
            showToast('Booking cancelled successfully', 'success');
        } catch (err) {
            showToast('Failed to cancel booking', 'error');
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header with Filter */}
                <SlideUp>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">My Bookings</h1>
                            <p className="text-gray-400">Manage your venue bookings and reservations</p>
                        </div>

                        <FilterDropdown
                            label="Status:"
                            value={statusFilter}
                            onChange={(val) => setStatusFilter(val as BookingStatus)}
                            options={[
                                { value: 'all', label: 'All Bookings' },
                                { value: 'pending', label: 'Pending' },
                                { value: 'accepted', label: 'Accepted' },
                                { value: 'completed', label: 'Completed' },
                                { value: 'cancelled', label: 'Cancelled' },
                            ]}
                        />
                    </div>
                </SlideUp>

                {/* Loading State - Skeleton Cards */}
                {loading && (
                    <div className="space-y-4">
                        {[0, 1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                                className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden"
                            >
                                <div className="flex flex-col md:flex-row md:h-[180px]">
                                    <div className="md:w-40 h-28 md:h-full bg-white/[0.05] animate-pulse" />
                                    <div className="flex-1 p-5 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-5 w-40 bg-white/[0.05] rounded animate-pulse" />
                                            <div className="h-5 w-20 bg-white/[0.05] rounded-full animate-pulse" />
                                        </div>
                                        <div className="h-4 w-3/4 bg-white/[0.05] rounded animate-pulse" />
                                        <div className="h-4 w-1/2 bg-white/[0.05] rounded animate-pulse" />
                                        <div className="flex gap-2 pt-2">
                                            <div className="h-8 w-24 bg-white/[0.05] rounded animate-pulse" />
                                            <div className="h-8 w-24 bg-white/[0.05] rounded animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="text-center py-16">
                        <p className="text-red-400 mb-4">{error}</p>
                        <Button onClick={() => window.location.reload()}>Try Again</Button>
                    </div>
                )}

                {/* Bookings List */}
                {!loading && !error && (
                    <FadeIn>
                        <div className="space-y-4">
                            {filteredBookings.map((booking) => {
                                const advanceAmount = getAdvanceAmount(booking.totalAmount);
                                const remainingAmount = booking.totalAmount - advanceAmount;

                                return (
                                    <div
                                        key={booking._id}
                                        className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300"
                                    >
                                        <div className="flex flex-col md:flex-row md:h-[180px]">
                                            {/* Venue Image */}
                                            <div className="md:w-40 h-28 md:h-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {booking.venue?.images?.[0] ? (
                                                    <img src={booking.venue.images[0]} alt={booking.venue.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <svg className="w-12 h-12 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                )}
                                            </div>

                                            {/* Booking Details */}
                                            <div className="flex-1 p-5 overflow-hidden">
                                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                            <h3 className="text-lg font-semibold text-white">{booking.venue?.name || 'Venue'}</h3>
                                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${getStatusColor(booking.status)}`}>
                                                                {booking.status}
                                                            </span>
                                                            {booking.status === 'accepted' && (
                                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPaymentStatusColor(booking.paymentStatus)}`}>
                                                                    {booking.paymentStatus === 'paid' ? '✓ Advance Paid' : 'Advance Pending'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1 text-sm">
                                                            <div className="flex items-center gap-2 text-gray-400">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                {formatDate(booking.bookingDate)} • {booking.startTime} - {booking.endTime}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-gray-500">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                {booking.expectedGuests} guests {booking.purpose && `• ${booking.purpose}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                                                        <p className="text-xl font-bold text-white">₹{booking.totalAmount?.toLocaleString() || 0}</p>
                                                        {booking.status === 'accepted' && (
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                Advance (10%): <span className="text-violet-400">₹{advanceAmount.toLocaleString()}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-white/[0.05] flex flex-wrap gap-3">
                                                    {/* Pay Advance button for accepted bookings with pending payment */}
                                                    {booking.status === 'accepted' && booking.paymentStatus !== 'paid' && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handlePayAdvance(booking)}
                                                            disabled={payingBookingId === booking._id}
                                                        >
                                                            {payingBookingId === booking._id ? (
                                                                <span className="flex items-center gap-2">
                                                                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                                                    Processing...
                                                                </span>
                                                            ) : (
                                                                `Pay Advance ₹${advanceAmount.toLocaleString()}`
                                                            )}
                                                        </Button>
                                                    )}

                                                    {/* View Details button for paid bookings */}
                                                    {booking.status === 'accepted' && booking.paymentStatus === 'paid' && (
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => setSelectedBooking(booking)}
                                                        >
                                                            View Details
                                                        </Button>
                                                    )}

                                                    {booking.status === 'pending' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-400 hover:text-red-300"
                                                            onClick={() => handleCancelBooking(booking._id)}
                                                        >
                                                            Cancel Request
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </FadeIn>
                )}

                {/* Empty State */}
                {!loading && !error && filteredBookings.length === 0 && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                        </svg>
                        <h3 className="text-xl font-semibold text-white mb-2">No bookings found</h3>
                        <p className="text-gray-400 mb-6">
                            {statusFilter === 'all'
                                ? 'Start exploring venues to make your first booking!'
                                : `No ${statusFilter} bookings at the moment.`}
                        </p>
                        <Button onClick={() => router.push('/venues')}>Browse Venues</Button>
                    </div>
                )}

                {/* Booking Details Modal */}
                <Modal
                    isOpen={!!selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    title="Booking Details"
                    size="md"
                >
                    {selectedBooking && (
                        <div className="space-y-4">
                            {/* Venue Info */}
                            <div className="flex gap-3">
                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex-shrink-0">
                                    {selectedBooking.venue?.images?.[0] ? (
                                        <img src={selectedBooking.venue.images[0]} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{selectedBooking.venue?.name}</h3>
                                    <div className="flex gap-2 mt-1">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize border ${getStatusColor(selectedBooking.status)}`}>
                                            {selectedBooking.status}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPaymentStatusColor(selectedBooking.paymentStatus)}`}>
                                            ✓ Advance Paid
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Booking Info Grid */}
                            <div className="grid grid-cols-2 gap-3 bg-white/5 rounded-lg p-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500">Date</p>
                                    <p className="text-white">{formatDate(selectedBooking.bookingDate)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Time</p>
                                    <p className="text-white">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Guests</p>
                                    <p className="text-white">{selectedBooking.expectedGuests} people</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Purpose</p>
                                    <p className="text-white">{selectedBooking.purpose || 'Not specified'}</p>
                                </div>
                            </div>

                            {/* Payment Breakdown */}
                            <div className="bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-lg p-3 border border-violet-500/20">
                                <h4 className="text-sm font-semibold text-white mb-2">Payment Summary</h4>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Total Amount</span>
                                        <span className="text-white">₹{selectedBooking.totalAmount?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Advance Paid (10%)</span>
                                        <span className="text-emerald-400">₹{getAdvanceAmount(selectedBooking.totalAmount).toLocaleString()}</span>
                                    </div>
                                    <div className="border-t border-white/10 my-1"></div>
                                    <div className="flex justify-between font-medium">
                                        <span className="text-gray-300">Remaining</span>
                                        <span className="text-white">₹{(selectedBooking.totalAmount - getAdvanceAmount(selectedBooking.totalAmount)).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <p className="text-yellow-400 text-xs">
                                💡 Pay the remaining amount at the venue on your booking date.
                            </p>

                            <Button className="w-full" size="sm" onClick={() => setSelectedBooking(null)}>
                                Close
                            </Button>
                        </div>
                    )}
                </Modal>
            </div>
        </DashboardLayout>
    );
}
