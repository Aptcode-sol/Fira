'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { bookingsApi, venuesApi, eventsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

interface Booking {
    _id: string;
    user: { _id: string; name: string; email: string; phone?: string };
    venue: { _id: string; name: string };
    bookingDate: string;
    startTime: string;
    endTime: string;
    purpose: string;
    expectedGuests: number;
    totalAmount: number;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
    createdAt: string;
}

interface EventRequest {
    _id: string;
    name: string;
    organizer: { _id: string; name: string; email: string; avatar?: string };
    venue: { _id: string; name: string; images?: string[] };
    startDateTime: string;
    endDateTime: string;
    maxAttendees: number;
    ticketPrice?: number;
    venueApproval?: { status: string };
    createdAt: string;
}

interface Venue {
    _id: string;
    name: string;
}

type TabType = 'bookings' | 'events';

export default function RequestsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState<TabType>('bookings');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
    const [venues, setVenues] = useState<Venue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVenue, setSelectedVenue] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectingEvent, setRejectingEvent] = useState<EventRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated && user) {
            fetchVenues();
            fetchEventRequests();
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (venues.length > 0) {
            fetchBookings();
        }
    }, [venues, selectedVenue]);

    const fetchVenues = async () => {
        if (!user?._id) return;
        try {
            const data = await venuesApi.getUserVenues(user._id) as { venues?: Venue[] } | Venue[];
            setVenues(Array.isArray(data) ? data : data.venues || []);
        } catch (error) {
            console.error('Failed to fetch venues:', error);
        }
    };

    const fetchBookings = async () => {
        setIsLoading(true);
        try {
            let allBookings: Booking[] = [];
            if (selectedVenue === 'all') {
                for (const venue of venues) {
                    const data = await bookingsApi.getVenueBookings(venue._id) as Booking[];
                    allBookings = [...allBookings, ...(data || [])];
                }
            } else {
                const data = await bookingsApi.getVenueBookings(selectedVenue) as Booking[];
                allBookings = data || [];
            }
            allBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setBookings(allBookings);
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchEventRequests = async () => {
        if (!user?._id) return;
        try {
            const data = await eventsApi.getVenueRequests(user._id) as { events: EventRequest[] };
            setEventRequests(data.events || []);
        } catch (error) {
            console.error('Failed to fetch event requests:', error);
        }
    };

    const handleBookingStatusUpdate = async (bookingId: string, status: 'accepted' | 'rejected') => {
        setProcessingId(bookingId);
        try {
            await bookingsApi.updateStatus(bookingId, status);
            showToast(`Booking ${status}!`, 'success');
            fetchBookings();
        } catch (error) {
            console.error('Failed to update booking:', error);
            showToast('Failed to update booking status', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleEventApproval = async (eventId: string, status: 'approved' | 'rejected', reason?: string) => {
        if (!user?._id) return;
        setProcessingId(eventId);
        try {
            await eventsApi.venueApprove(eventId, {
                venueOwnerId: user._id,
                status,
                rejectionReason: reason
            });
            showToast(`Event ${status}!`, 'success');
            setRejectingEvent(null);
            setRejectionReason('');
            fetchEventRequests();
        } catch (error) {
            console.error('Failed to update event:', error);
            showToast('Failed to update event status', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const filteredBookings = bookings.filter(b =>
        statusFilter === 'all' || b.status === statusFilter
    );

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    // Format DateTime like "3 Jan 2026 14:00"
    const formatDateTime = (dateTimeStr: string) => {
        if (!dateTimeStr) return 'N/A';
        const dt = new Date(dateTimeStr);
        if (isNaN(dt.getTime())) return 'Invalid Date';
        const day = dt.getDate();
        const month = dt.toLocaleString('en-US', { month: 'short' });
        const year = dt.getFullYear();
        const hours = dt.getHours().toString().padStart(2, '0');
        const mins = dt.getMinutes().toString().padStart(2, '0');
        return `${day} ${month} ${year} ${hours}:${mins}`;
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0
        }).format(price);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'accepted':
            case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    if (authLoading) {
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
            <div className="max-w-6xl mx-auto py-8 px-4">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Requests</h1>
                    <p className="text-gray-400">Manage incoming booking and event requests for your venues</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('bookings')}
                        className={`px-4 py-3 text-sm font-medium transition-colors relative ${activeTab === 'bookings'
                            ? 'text-violet-400'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Booking Requests
                        {bookings.filter(b => b.status === 'pending').length > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                {bookings.filter(b => b.status === 'pending').length}
                            </span>
                        )}
                        {activeTab === 'bookings' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('events')}
                        className={`px-4 py-3 text-sm font-medium transition-colors relative ${activeTab === 'events'
                            ? 'text-violet-400'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Event Requests
                        {eventRequests.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                {eventRequests.length}
                            </span>
                        )}
                        {activeTab === 'events' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
                        )}
                    </button>
                </div>

                {/* Booking Requests Tab */}
                {activeTab === 'bookings' && (
                    <>
                        <div className="flex flex-wrap gap-4 mb-6">
                            <select
                                value={selectedVenue}
                                onChange={(e) => setSelectedVenue(e.target.value)}
                                className="px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                            >
                                <option value="all">All Venues</option>
                                {venues.map(v => (
                                    <option key={v._id} value={v._id}>{v.name}</option>
                                ))}
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                <div className="text-2xl font-bold text-yellow-400">
                                    {bookings.filter(b => b.status === 'pending').length}
                                </div>
                                <div className="text-sm text-gray-400">Pending</div>
                            </div>
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                <div className="text-2xl font-bold text-green-400">
                                    {bookings.filter(b => b.status === 'accepted').length}
                                </div>
                                <div className="text-sm text-gray-400">Accepted</div>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                <div className="text-2xl font-bold text-red-400">
                                    {bookings.filter(b => b.status === 'rejected').length}
                                </div>
                                <div className="text-sm text-gray-400">Rejected</div>
                            </div>
                            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                                <div className="text-2xl font-bold text-violet-400">
                                    {formatPrice(bookings.filter(b => b.status === 'accepted').reduce((sum, b) => sum + b.totalAmount, 0))}
                                </div>
                                <div className="text-sm text-gray-400">Revenue</div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                            </div>
                        ) : filteredBookings.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                No booking requests found
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredBookings.map(booking => (
                                    <div key={booking._id} className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-6">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}>
                                                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                                    </span>
                                                    <span className="text-gray-500 text-sm">{formatDate(booking.createdAt)}</span>
                                                </div>

                                                <h3 className="text-lg font-semibold text-white mb-1">
                                                    {booking.venue?.name || 'Venue'}
                                                </h3>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-gray-500">Date:</span>
                                                        <span className="text-white ml-2">{formatDate(booking.bookingDate)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Time:</span>
                                                        <span className="text-white ml-2">{booking.startTime} - {booking.endTime}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Guests:</span>
                                                        <span className="text-white ml-2">{booking.expectedGuests}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Amount:</span>
                                                        <span className="text-white ml-2">{formatPrice(booking.totalAmount)}</span>
                                                    </div>
                                                </div>

                                                {booking.purpose && (
                                                    <p className="text-gray-400 text-sm mt-2">
                                                        <span className="text-gray-500">Purpose:</span> {booking.purpose}
                                                    </p>
                                                )}

                                                <div className="mt-3 pt-3 border-t border-white/10">
                                                    <span className="text-gray-500 text-sm">Customer: </span>
                                                    <span className="text-white text-sm">{booking.user?.name}</span>
                                                    <span className="text-gray-500 text-sm ml-3">{booking.user?.email}</span>
                                                </div>
                                            </div>

                                            {booking.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleBookingStatusUpdate(booking._id, 'rejected')}
                                                        disabled={processingId === booking._id}
                                                    >
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleBookingStatusUpdate(booking._id, 'accepted')}
                                                        disabled={processingId === booking._id}
                                                    >
                                                        {processingId === booking._id ? 'Processing...' : 'Accept'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Event Requests Tab */}
                {activeTab === 'events' && (
                    <>
                        <div className="mb-6">
                            <p className="text-gray-400 text-sm">
                                Events created at your venues need your approval before going live. Review and approve or reject event requests below.
                            </p>
                        </div>

                        {eventRequests.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                No pending event requests
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {eventRequests.map(event => (
                                    <div key={event._id} className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-6">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            {/* Event Image */}
                                            <div className="w-full md:w-32 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex-shrink-0">
                                                {event.venue?.images?.[0] ? (
                                                    <img src={event.venue.images[0]} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Event Details */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.venueApproval?.status || 'pending')}`}>
                                                        Pending Your Approval
                                                    </span>
                                                    <span className="text-gray-500 text-sm">{formatDate(event.createdAt)}</span>
                                                </div>

                                                <h3 className="text-lg font-semibold text-white mb-1">{event.name}</h3>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                                                    <div>
                                                        <span className="text-gray-500">Venue:</span>
                                                        <span className="text-white ml-2">{event.venue?.name}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">From:</span>
                                                        <span className="text-white ml-2">{formatDateTime(event.startDateTime)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">To:</span>
                                                        <span className="text-white ml-2">{formatDateTime(event.endDateTime)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Capacity:</span>
                                                        <span className="text-white ml-2">{event.maxAttendees}</span>
                                                    </div>
                                                </div>

                                                <div className="pt-3 border-t border-white/10">
                                                    <span className="text-gray-500 text-sm">Organizer: </span>
                                                    <span className="text-white text-sm">{event.organizer?.name}</span>
                                                    <span className="text-gray-500 text-sm ml-3">{event.organizer?.email}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2 items-start">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setRejectingEvent(event)}
                                                    disabled={processingId === event._id}
                                                >
                                                    Reject
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleEventApproval(event._id, 'approved')}
                                                    disabled={processingId === event._id}
                                                >
                                                    {processingId === event._id ? 'Processing...' : 'Approve'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Rejection Modal */}
            {rejectingEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold text-white mb-2">Reject Event?</h3>
                        <p className="text-gray-400 mb-4">
                            Please provide a reason for rejecting "{rejectingEvent.name}"
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white mb-4"
                            rows={3}
                        />
                        <div className="flex gap-3 justify-end">
                            <Button variant="ghost" onClick={() => { setRejectingEvent(null); setRejectionReason(''); }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => handleEventApproval(rejectingEvent._id, 'rejected', rejectionReason)}
                                disabled={processingId === rejectingEvent._id}
                                className="bg-red-500 hover:bg-red-600"
                            >
                                Reject Event
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
