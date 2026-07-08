'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi, bookingsApi } from '@/lib/api';
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

export default function VenuePortalBookingsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const { showToast } = useToast();
    
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'completed' | 'rejected' | 'cancelled'>('all');
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/venue-portal/signin');
            return;
        }

        if (!isLoading && isAuthenticated && user?.role !== 'venue_owner') {
            router.push('/dashboard');
            return;
        }
    }, [isLoading, isAuthenticated, user, router]);

    const fetchBookings = useCallback(async () => {
        if (!user?._id) return;
        try {
            setLoading(true);
            // 1. Get owner's venues
            const response = await venuesApi.getUserVenues(user._id) as any;
            const venueList = Array.isArray(response) ? response : (response?.venues || []);

            // 2. Fetch bookings for each venue
            let allBookings: Booking[] = [];
            for (const venue of venueList) {
                try {
                    const data = await bookingsApi.getVenueBookings(venue._id) as Booking[];
                    allBookings = [...allBookings, ...(data || [])];
                } catch (bookingErr) {
                    console.error(`Failed to fetch bookings for venue ${venue._id}:`, bookingErr);
                }
            }

            // Sort bookings by creation date descending
            allBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setBookings(allBookings);
        } catch (err) {
            console.error('Failed to load bookings:', err);
        } finally {
            setLoading(false);
        }
    }, [user?._id]);

    useEffect(() => {
        if (isAuthenticated && user?._id) {
            fetchBookings();
        }
    }, [isAuthenticated, user?._id, fetchBookings]);

    const handleUpdateStatus = async (bookingId: string, status: 'accepted' | 'rejected') => {
        let reason = '';
        if (status === 'rejected') {
            const promptReason = window.prompt('Please enter a reason for rejecting this booking:');
            if (promptReason === null) return; // User cancelled
            reason = promptReason || 'Rejected by venue owner';
        }

        setProcessingId(bookingId);
        try {
            await bookingsApi.updateStatus(bookingId, status, reason);
            showToast(`Booking ${status === 'accepted' ? 'accepted' : 'rejected'} successfully`, 'success');
            fetchBookings();
        } catch (err) {
            console.error('Failed to update booking status:', err);
            showToast('Failed to update booking status', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'accepted': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getPaymentStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'text-green-400 bg-green-500/10';
            case 'pending': return 'text-yellow-400 bg-yellow-500/10';
            case 'failed': return 'text-red-400 bg-red-500/10';
            default: return 'text-gray-400 bg-gray-500/10';
        }
    };

    const filteredBookings = bookings.filter((booking) => {
        if (filter === 'all') return true;
        if (filter === 'accepted') {
            return booking.status === 'accepted' || booking.status === 'confirmed';
        }
        return booking.status === filter;
    });

    if (isLoading) {
        return (
            <VenueDashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </VenueDashboardLayout>
        );
    }

    if (!isAuthenticated || user?.role !== 'venue_owner') {
        return null;
    }

    return (
        <VenueDashboardLayout>
            <div className="p-4 sm:p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Bookings</h1>
                        <p className="text-sm sm:text-base text-gray-400">Manage venue booking requests</p>
                    </div>
                </SlideUp>

                {/* Filter Dropdown */}
                <FadeIn delay={0.1}>
                    <div className="mb-6">
                        <div className="relative w-full sm:w-56">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                className="w-full appearance-none bg-white/[0.04] border border-white/[0.1] text-white text-sm font-medium rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer hover:bg-white/[0.06]"
                                style={{ colorScheme: 'dark' }}
                            >
                                <option value="all" className="bg-[#1a1a1a]">All Bookings</option>
                                <option value="pending" className="bg-[#1a1a1a]">Pending</option>
                                <option value="accepted" className="bg-[#1a1a1a]">Accepted</option>
                                <option value="completed" className="bg-[#1a1a1a]">Completed</option>
                                <option value="rejected" className="bg-[#1a1a1a]">Rejected</option>
                                <option value="cancelled" className="bg-[#1a1a1a]">Cancelled</option>
                            </select>
                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </FadeIn>

                {/* Bookings List */}
                <FadeIn delay={0.2}>
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
                                    <div className="flex gap-4">
                                        <div className="w-16 h-16 bg-white/5 rounded-xl animate-pulse" />
                                        <div className="flex-1">
                                            <div className="w-1/3 h-5 bg-white/5 rounded animate-pulse mb-2" />
                                            <div className="w-1/2 h-4 bg-white/5 rounded animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredBookings.length > 0 ? (
                        <div className="space-y-4">
                            {filteredBookings.map((booking) => (
                                <div key={booking._id} className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-6 hover:bg-white/[0.04] transition-all duration-300">
                                    <div className="flex flex-col lg:flex-row gap-6">
                                        {/* Venue Image */}
                                        <div className="w-full lg:w-36 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex-shrink-0">
                                            {booking.venue?.images?.[0] ? (
                                                <img src={booking.venue.images[0]} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500 bg-white/5">
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Booking Info */}
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}>
                                                    {booking.status}
                                                </span>
                                                <span className="text-gray-500 text-sm">
                                                    {new Date(booking.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                <span className="text-gray-500 text-sm">•</span>
                                                <span className="text-gray-400 text-sm font-medium">
                                                    {booking.startTime} - {booking.endTime}
                                                </span>
                                            </div>

                                            <h3 className="text-lg font-bold text-white mb-2">{booking.venue?.name}</h3>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-4">
                                                {booking.purpose && (
                                                    <div>
                                                        <span className="text-gray-500">Purpose:</span>
                                                        <span className="text-white ml-2">{booking.purpose}</span>
                                                    </div>
                                                )}
                                                {booking.expectedGuests && (
                                                    <div>
                                                        <span className="text-gray-500">Expected Guests:</span>
                                                        <span className="text-white ml-2">{booking.expectedGuests}</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-gray-500">Payment:</span>
                                                    <span className={`ml-2 px-2 py-0.5 rounded-md text-xs font-semibold ${getPaymentStatusColor(booking.paymentStatus)}`}>
                                                        {booking.paymentStatus}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Booker Contact Details */}
                                            <div className="pt-3 border-t border-white/5 flex flex-wrap gap-4 text-xs sm:text-sm">
                                                <div>
                                                    <span className="text-gray-500">Booker:</span>
                                                    <span className="text-gray-200 ml-1 font-semibold">{booking.user?.name}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Email:</span>
                                                    <span className="text-gray-300 ml-1">{booking.user?.email}</span>
                                                </div>
                                                {booking.user?.phone && (
                                                    <div>
                                                        <span className="text-gray-500">Phone:</span>
                                                        <span className="text-gray-300 ml-1">{booking.user?.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action buttons (only for pending bookings) */}
                                        <div className="flex flex-row lg:flex-col items-end justify-between lg:justify-center gap-4 flex-shrink-0">
                                            <div className="text-right lg:mb-2">
                                                <div className="text-xs text-gray-500">Total Price</div>
                                                <div className="text-xl font-bold text-white">₹{booking.totalAmount.toLocaleString()}</div>
                                            </div>

                                            {booking.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleUpdateStatus(booking._id, 'rejected')}
                                                        disabled={processingId === booking._id}
                                                    >
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleUpdateStatus(booking._id, 'accepted')}
                                                        disabled={processingId === booking._id}
                                                    >
                                                        {processingId === booking._id ? 'Processing...' : 'Accept'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                                <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">No bookings found</h3>
                            <p className="text-gray-400">
                                No booking requests matching the selected filter were found.
                            </p>
                        </div>
                    )}
                </FadeIn>
            </div>
        </VenueDashboardLayout>
    );
}
