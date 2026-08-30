'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import { eventsApi, ticketsApi } from '@/lib/api';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { FadeIn, SlideUp } from '@/components/animations';

interface Event {
    _id: string;
    name: string;
    date?: string;
    startDateTime: string;
    endDateTime: string;
    venue: {
        name: string;
        address: { city: string };
    };
    images?: string[];
    status: string;
    currentAttendees?: number;
    maxAttendees?: number;
}

interface Ticket {
    _id: string;
    event: Event;
    status: string;
}

export default function EventsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [activeTab, setActiveTab] = useState<'all' | 'attending' | 'organizing'>('all');
    const [showCompleted, setShowCompleted] = useState(false);
    const [attendingEvents, setAttendingEvents] = useState<Event[]>([]);
    const [organizingEvents, setOrganizingEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        const fetchEvents = async () => {
            if (!user?._id) return;
            try {
                setLoading(true);
                setError('');

                // Fetch organizing events
                const orgResponse = await eventsApi.getUserEvents(user._id) as Event[] | { events?: Event[]; data?: Event[] };
                // Handle if API returns { events: [...] } or direct array
                const orgEvents = Array.isArray(orgResponse) ? orgResponse : ((orgResponse as { events?: Event[]; data?: Event[] })?.events || (orgResponse as { events?: Event[]; data?: Event[] })?.data || []);
                setOrganizingEvents(orgEvents);

                // Fetch attending events (from tickets)
                const ticketsResponse = await ticketsApi.getUserTickets(user._id) as Ticket[] | { tickets?: Ticket[]; data?: Ticket[] };
                const tickets = Array.isArray(ticketsResponse) ? ticketsResponse : ((ticketsResponse as { tickets?: Ticket[]; data?: Ticket[] })?.tickets || (ticketsResponse as { tickets?: Ticket[]; data?: Ticket[] })?.data || []);
                const attending = tickets
                    .filter(t => t.status === 'active' && t.event)
                    .map(t => t.event);
                setAttendingEvents(attending);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load events');
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated && user?._id) {
            fetchEvents();
        }
    }, [isAuthenticated, user?._id]);

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
        });
    };

    const allEvents = [...attendingEvents, ...organizingEvents];
    const now = new Date();
    const filteredEvents = showCompleted
        ? allEvents
        : allEvents.filter(e => new Date(e.date || e.startDateTime || 0) >= now);
    const currentEvents = activeTab === 'all' ? filteredEvents : activeTab === 'attending' ? attendingEvents.filter(e => showCompleted || new Date(e.date || e.startDateTime || 0) >= now) : organizingEvents.filter(e => showCompleted || new Date(e.date || e.startDateTime || 0) >= now);

    const isOrganizing = (event: Event) => organizingEvents.some(e => e._id === event._id);

    // Organizers get the manage screen, attendees get the public event page.
    // Both are dedicated pages that already exist, so the row is the only new
    // way in - no second copy of those screens.
    const detailHref = (event: Event) =>
        isOrganizing(event) ? `/dashboard/events/${event._id}` : `/events/${event._id}`;

    const columns: Column<Event>[] = [
        {
            key: 'name',
            header: 'Event',
            primary: true,
            cell: (e) => <span className="font-medium text-white">{e.name}</span>,
        },
        {
            key: 'when',
            header: 'Date',
            cell: (e) => {
                const when = e.date || e.startDateTime;
                if (!when) return <span className="text-gray-400">TBA</span>;
                return (
                    <span className="whitespace-nowrap">
                        {formatDate(when)}
                        {' · '}
                        {new Date(when).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                );
            },
        },
        {
            key: 'venue',
            header: 'Venue',
            cell: (e) => (
                <span className="text-gray-300">
                    {e.venue?.name || 'TBA'}
                    {e.venue?.address?.city ? `, ${e.venue.address.city}` : ''}
                </span>
            ),
        },
        {
            key: 'role',
            header: 'Role',
            cell: (e) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isOrganizing(e)
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'bg-green-500/20 text-green-400'
                    }`}>
                    {isOrganizing(e) ? 'Organizing' : 'Attending'}
                </span>
            ),
        },
        {
            key: 'attendees',
            header: 'Attendees',
            align: 'right',
            cell: (e) =>
                e.maxAttendees
                    ? <span className="whitespace-nowrap">{e.currentAttendees || 0}/{e.maxAttendees}</span>
                    : <span className="text-gray-500">—</span>,
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            cell: (e) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${e.status === 'published'
                    ? 'bg-green-500/20 text-green-400'
                    : e.status === 'draft'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-gray-500/20 text-gray-300'
                    }`}>
                    {e.status || 'active'}
                </span>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header with Filter */}
                <SlideUp>
                    <div className="flex flex-col gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">My Events</h1>
                            <p className="text-gray-300">Events you&apos;re attending or organizing</p>
                        </div>

                        {/* Two equal halves, side by side at every width. This was a
                            wrapping flex row, so View and Status sat on one line or two
                            purely according to how wide the platform's font rendered -
                            one line on Android, two on iOS. A 2-column grid is the same
                            on both because it does not consult the content's width. */}
                        <div className="grid grid-cols-2 gap-3">
                        <FilterDropdown
                            label="View:"
                            value={activeTab}
                            onChange={(val) => setActiveTab(val as 'all' | 'attending' | 'organizing')}
                            options={[
                                { value: 'all', label: `All (${filteredEvents.length})` },
                                { value: 'attending', label: `Attending (${attendingEvents.filter(e => showCompleted || new Date(e.date || e.startDateTime || 0) >= now).length})` },
                                { value: 'organizing', label: `Organizing (${organizingEvents.filter(e => showCompleted || new Date(e.date || e.startDateTime || 0) >= now).length})` },
                            ]}
                        />

                        <FilterDropdown
                            label="Status:"
                            value={showCompleted ? 'all' : 'upcoming'}
                            onChange={(val) => setShowCompleted(val === 'all')}
                            options={[
                                { value: 'upcoming', label: 'Upcoming' },
                                { value: 'all', label: 'All (incl. Completed)' },
                            ]}
                        />
                        </div>
                    </div>
                </SlideUp>

                {/* Error State */}
                {error && (
                    <div className="text-center py-16">
                        <p className="text-red-400 mb-4">{error}</p>
                        <Button onClick={() => window.location.reload()}>Try Again</Button>
                    </div>
                )}

                {/* Events table. The cards became a table so the same columns
                    read the same way on every row; the row itself is the link to
                    the dedicated page (manage screen for organizers, public
                    event page for attendees). */}
                {!error && (
                    <FadeIn animateOnMount>
                        <DataTable
                            rows={currentEvents}
                            columns={columns}
                            rowKey={(e) => e._id}
                            onRowClick={(e) => router.push(detailHref(e))}
                            loading={loading}
                            pageSize={10}
                            label={(n) => `${n} event${n === 1 ? '' : 's'}`}
                            empty={
                                <>
                                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        {activeTab === 'attending' ? 'No events to attend' : 'No events organized'}
                                    </h3>
                                    <p className="text-gray-300 mb-6">
                                        {activeTab === 'attending'
                                            ? 'Explore events and get your tickets!'
                                            : 'Create your first event and start selling tickets.'}
                                    </p>
                                    <Button onClick={() => router.push(activeTab === 'attending' ? '/events' : '/create/event')}>
                                        {activeTab === 'attending' ? 'Browse Events' : 'Create Event'}
                                    </Button>
                                </>
                            }
                            actions={(event) =>
                                isOrganizing(event) ? (
                                    <Button
                                        size="sm"
                                        className="!bg-violet-600 hover:!bg-violet-500"
                                        onClick={() => router.push(`/dashboard/events/${event._id}/scanner`)}
                                    >
                                        <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="3" width="7" height="7" />
                                            <rect x="14" y="3" width="7" height="7" />
                                            <rect x="3" y="14" width="7" height="7" />
                                            <path d="M14 14h3v3" />
                                            <path d="M17 17h4v4" />
                                            <path d="M14 21v-4" />
                                            <path d="M21 14h-4" />
                                        </svg>
                                        Scan
                                    </Button>
                                ) : (
                                    <Button variant="secondary" size="sm" onClick={() => router.push(`/events/${event._id}`)}>
                                        View
                                    </Button>
                                )
                            }
                        />
                    </FadeIn>
                )}

                {/* No page-specific create button: the app-wide FloatingActionButton
                    covers this, and a second plus in a different colour at a slightly
                    different offset made the control mean different things on
                    different screens. The empty-state button above is still here for
                    when there is nothing to look at yet. */}
            </div>
        </DashboardLayout>
    );
}
