'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import { eventsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import { Select } from '@/components/ui/Select';
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
            router.push('/signin');
            return;
        }

        if (!isLoading && isAuthenticated && !isVenueOwner(user)) {
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
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
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

    if (!isAuthenticated || !isVenueOwner(user)) {
        return null;
    }

    const columns: Column<EventRequest>[] = [
        {
            key: 'name',
            header: 'Event',
            primary: true,
            cell: (e) => <span className="font-medium text-white">{e.name}</span>,
        },
        {
            key: 'venue',
            header: 'Venue',
            cell: (e) => <span className="text-gray-300">{e.venue?.name || '—'}</span>,
        },
        {
            key: 'organizer',
            header: 'Organizer',
            cell: (e) => <span className="text-gray-200">{e.organizer?.name || '—'}</span>,
        },
        {
            key: 'from',
            header: 'From',
            cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.startDateTime)}</span>,
        },
        {
            key: 'to',
            header: 'To',
            cell: (e) => <span className="whitespace-nowrap text-gray-300">{formatDateTime(e.endDateTime)}</span>,
        },
        {
            key: 'capacity',
            header: 'Capacity',
            align: 'right',
            cell: (e) => <span>{e.maxAttendees ?? '—'}</span>,
        },
        {
            key: 'requested',
            header: 'Requested',
            cell: (e) => <span className="whitespace-nowrap text-gray-300">{formatDate(e.createdAt)}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            cell: (e) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize border ${getStatusColor(e.venueApproval?.status || 'pending')}`}>
                    {e.venueApproval?.status || 'pending'}
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
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Event Requests</h1>
                        <p className="text-sm sm:text-base text-gray-300">Review and approve event requests for your venues</p>
                    </div>
                </SlideUp>

                {/* Filter Dropdown */}
                <FadeIn delay={0.1}>
                    <div className="mb-6">
                        <div className="w-full sm:w-56">
                            <Select
                                value={filter}
                                onChange={(value) => setFilter(value as typeof filter)}
                                options={[
                                    { value: 'all', label: 'All Requests' },
                                    { value: 'pending', label: 'Pending' },
                                    { value: 'approved', label: 'Approved' },
                                    { value: 'rejected', label: 'Rejected' },
                                ]}
                            />
                        </div>
                    </div>
                </FadeIn>

                {/* Requests table. Organizer contact and the full request move to
                    /venue-portal/events/[id], which the row opens; Approve and
                    Reject stay here because triaging is what this list is for. */}
                <FadeIn delay={0.2}>
                    <DataTable
                        rows={filteredRequests}
                        columns={columns}
                        rowKey={(e) => e._id}
                        onRowClick={(e) => router.push(`/venue-portal/events/${e._id}`)}
                        loading={loading}
                        pageSize={10}
                        label={(n) => `${n} request${n === 1 ? '' : 's'}`}
                        empty={
                            <>
                                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                                    <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">No event requests</h3>
                                <p className="text-gray-300">
                                    Event organizers who want to host events at your venues will appear here.
                                </p>
                            </>
                        }
                        actions={(event) =>
                            (event.venueApproval?.status ?? 'pending') === 'pending' ? (
                                <>
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
                                        {processingId === event._id ? '...' : 'Approve'}
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => router.push(`/venue-portal/events/${event._id}`)}
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
