'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { eventsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { FadeIn, SlideUp } from '@/components/animations';

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

export default function VenuePortalEventsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const { showToast } = useToast();
    const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
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

    const fetchEventRequests = useCallback(async () => {
        if (!user?._id) return;
        try {
            setLoading(true);
            const data = await eventsApi.getVenueRequests(user._id) as any;
            setEventRequests(data.events || []);
        } catch (err) {
            console.error('Failed to load event requests:', err);
        } finally {
            setLoading(false);
        }
    }, [user?._id]);

    useEffect(() => {
        if (isAuthenticated && user?._id) {
            fetchEventRequests();
        }
    }, [isAuthenticated, user?._id, fetchEventRequests]);

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
            fetchEventRequests();
        } catch (error) {
            console.error('Failed to update event:', error);
            showToast('Failed to update event status', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (eventId: string) => {
        const reason = window.prompt('Please enter a reason for rejecting this event:');
        if (reason === null) return; // User cancelled prompt
        await handleEventApproval(eventId, 'rejected', reason || 'Rejected by venue owner');
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const filteredRequests = eventRequests.filter((event) => {
        const status = event.venueApproval?.status || 'pending';
        if (filter === 'all') return true;
        return status === filter;
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
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Event Requests</h1>
                        <p className="text-sm sm:text-base text-gray-400">Review and approve event requests for your venues</p>
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
                                <option value="all" className="bg-[#1a1a1a]">All Requests</option>
                                <option value="pending" className="bg-[#1a1a1a]">Pending</option>
                                <option value="approved" className="bg-[#1a1a1a]">Approved</option>
                                <option value="rejected" className="bg-[#1a1a1a]">Rejected</option>
                            </select>
                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </FadeIn>

                {/* Requests List */}
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
                    ) : filteredRequests.length > 0 ? (
                        <div className="space-y-4">
                            {filteredRequests.map((event) => (
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
                                                    {event.venueApproval?.status || 'pending'}
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
                                        {(event.venueApproval?.status === 'pending' || !event.venueApproval?.status) && (
                                            <div className="flex gap-2 items-start md:self-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleReject(event._id)}
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
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                                <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">No event requests</h3>
                            <p className="text-gray-400">
                                Event organizers who want to host events at your venues will appear here.
                            </p>
                        </div>
                    )}
                </FadeIn>
            </div>
        </VenueDashboardLayout>
    );
}
