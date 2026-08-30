'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import { venuesApi, bookingsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
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
            router.push('/signin');
            return;
        }

        if (!isLoading && isAuthenticated && !isVenueOwner(user)) {
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
            case 'cancelled': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    };

    const getPaymentStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'text-green-400 bg-green-500/10';
            case 'pending': return 'text-yellow-400 bg-yellow-500/10';
            case 'failed': return 'text-red-400 bg-red-500/10';
            default: return 'text-gray-300 bg-gray-500/10';
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

    if (!isAuthenticated || !isVenueOwner(user)) {
        return null;
    }

    const columns: Column<Booking>[] = [
        {
            key: 'venue',
            header: 'Venue',
            primary: true,
            cell: (b) => <span className="font-medium text-white">{b.venue?.name || 'Venue'}</span>,
        },
        {
            key: 'booker',
            header: 'Booker',
            cell: (b) => <span className="text-gray-200">{b.user?.name || '—'}</span>,
        },
        {
            key: 'date',
            header: 'Date',
            cell: (b) => (
                <span className="whitespace-nowrap">
                    {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
            ),
        },
        {
            key: 'time',
            header: 'Time',
            cell: (b) => <span className="whitespace-nowrap text-gray-300">{b.startTime} - {b.endTime}</span>,
        },
        {
            key: 'guests',
            header: 'Guests',
            align: 'right',
            cell: (b) => <span>{b.expectedGuests ?? '—'}</span>,
        },
        {
            key: 'amount',
            header: 'Total',
            align: 'right',
            cell: (b) => <span className="font-semibold text-white">₹{b.totalAmount?.toLocaleString() ?? 0}</span>,
        },
        {
            key: 'payment',
            header: 'Payment',
            align: 'center',
            cell: (b) => (
                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${getPaymentStatusColor(b.paymentStatus)}`}>
                    {b.paymentStatus}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            cell: (b) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize border ${getStatusColor(b.status)}`}>
                    {b.status}
                </span>
            ),
        },
    ];

    return (
        <VenueDashboardLayout>
            <div className="p-4 sm:p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Bookings</h1>
                        <p className="text-sm sm:text-base text-gray-300">Manage venue booking requests</p>
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
                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </FadeIn>

                {/* Bookings table. Booker contact details, purpose and the full
                    breakdown moved to /venue-portal/bookings/[id], which the row
                    opens - Accept and Reject stay here because triaging pending
                    requests is what this list is for. */}
                <FadeIn delay={0.2}>
                    <DataTable
                        rows={filteredBookings}
                        columns={columns}
                        rowKey={(b) => b._id}
                        onRowClick={(b) => router.push(`/venue-portal/bookings/${b._id}`)}
                        loading={loading}
                        pageSize={10}
                        label={(n) => `${n} booking${n === 1 ? '' : 's'}`}
                        empty={
                            <>
                                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                                    <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">No bookings found</h3>
                                <p className="text-gray-300">
                                    No booking requests matching the selected filter were found.
                                </p>
                            </>
                        }
                        actions={(booking) =>
                            booking.status === 'pending' ? (
                                <>
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
                                        {processingId === booking._id ? '...' : 'Accept'}
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => router.push(`/venue-portal/bookings/${booking._id}`)}
                                >
                                    View
                                </Button>
                            )
                        }
                    />
                </FadeIn>
            </div>
        </VenueDashboardLayout>
    );
}
