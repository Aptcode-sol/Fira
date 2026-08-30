'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import { bookingsApi } from '@/lib/api';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { FadeIn, SlideUp } from '@/components/animations';

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

const statusColor = (status: string) => {
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
            return 'bg-gray-500/20 text-gray-300 border-gray-500/20';
    }
};

export default function BookingsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [statusFilter, setStatusFilter] = useState<BookingStatus>('all');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    if (isLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const filteredBookings = statusFilter === 'all'
        ? bookings
        : bookings.filter((b) => b.status === statusFilter);

    // Paying the advance, cancelling and the full breakdown all live on
    // /dashboard/bookings/[id] now. The Razorpay checkout script went with them,
    // so this list no longer loads a payment SDK just to render rows.
    const columns: Column<Booking>[] = [
        {
            key: 'venue',
            header: 'Venue',
            primary: true,
            cell: (b) => <span className="font-medium text-white">{b.venue?.name || 'Venue'}</span>,
        },
        {
            key: 'date',
            header: 'Date',
            cell: (b) => <span className="whitespace-nowrap">{formatDate(b.bookingDate)}</span>,
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
            cell: (b) => <span className="font-semibold text-white">₹{b.totalAmount?.toLocaleString() || 0}</span>,
        },
        {
            key: 'payment',
            header: 'Payment',
            align: 'center',
            cell: (b) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${b.paymentStatus === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : b.paymentStatus === 'failed'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                    {b.paymentStatus || 'pending'}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            cell: (b) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize border ${statusColor(b.status)}`}>
                    {b.status}
                </span>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header with Filter */}
                <SlideUp>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">My Bookings</h1>
                            <p className="text-gray-300">Manage your venue bookings and reservations</p>
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

                {/* Error State */}
                {error && (
                    <div className="text-center py-16">
                        <p className="text-red-400 mb-4">{error}</p>
                        <Button onClick={() => window.location.reload()}>Try Again</Button>
                    </div>
                )}

                {!error && (
                    <FadeIn animateOnMount>
                        <DataTable
                            rows={filteredBookings}
                            columns={columns}
                            rowKey={(b) => b._id}
                            onRowClick={(b) => router.push(`/dashboard/bookings/${b._id}`)}
                            loading={loading}
                            pageSize={10}
                            label={(n) => `${n} booking${n === 1 ? '' : 's'}`}
                            empty={
                                <>
                                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                    </svg>
                                    <h3 className="text-xl font-semibold text-white mb-2">No bookings found</h3>
                                    <p className="text-gray-300 mb-6">
                                        {statusFilter === 'all'
                                            ? 'Start exploring venues to make your first booking!'
                                            : `No ${statusFilter} bookings at the moment.`}
                                    </p>
                                    <Button onClick={() => router.push('/venues')}>Browse Venues</Button>
                                </>
                            }
                        />
                    </FadeIn>
                )}
            </div>
        </DashboardLayout>
    );
}
