'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { eventsApi, ticketsApi } from '@/lib/api';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';

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

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header with Filter */}
                <SlideUp>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">My Events</h1>
                            <p className="text-gray-400">Events you&apos;re attending or organizing</p>
                        </div>

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
                </SlideUp>

                {/* Loading State - Skeleton Cards */}
                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                                className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden"
                            >
                                <div className="h-40 bg-white/[0.05] animate-pulse" />
                                <div className="p-5 space-y-3">
                                    <div className="h-5 w-3/4 bg-white/[0.05] rounded animate-pulse" />
                                    <div className="h-4 w-1/2 bg-white/[0.05] rounded animate-pulse" />
                                    <div className="h-4 w-2/3 bg-white/[0.05] rounded animate-pulse" />
                                    <div className="flex gap-2 pt-2">
                                        <div className="h-8 w-20 bg-white/[0.05] rounded animate-pulse" />
                                        <div className="h-8 w-20 bg-white/[0.05] rounded animate-pulse" />
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

                {/* Events Grid */}
                {!loading && !error && (
                    <FadeIn>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {currentEvents.map((event) => (
                                <div
                                    key={event._id}
                                    className="group bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300"
                                >
                                    {/* Event Image */}
                                    <div className="h-40 bg-gradient-to-br from-violet-500/30 to-blue-500/30 relative">
                                        {event.images?.[0] ? (
                                            <img src={event.images[0]} alt={event.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <svg className="w-12 h-12 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}
                                        <div className="absolute top-3 left-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border ${event.status === 'published'
                                                ? 'bg-green-500/20 text-green-400 border-green-500/20'
                                                : event.status === 'draft'
                                                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                                                    : 'bg-gray-500/20 text-gray-400 border-gray-500/20'
                                                }`}>
                                                {event.status || 'Active'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Event Details */}
                                    <div className="p-5">
                                        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-300 transition-colors">
                                            {event.name}
                                        </h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                {formatDate(event.startDateTime)} • {new Date(event.startDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                </svg>
                                                {event.venue?.name}{event.venue?.address?.city ? `, ${event.venue.address.city}` : ''}
                                            </div>
                                        </div>

                                        {/* Capacity Bar for Organizing */}
                                        {activeTab === 'organizing' && event.maxAttendees && (
                                            <div className="mt-4">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-gray-400">Attendees</span>
                                                    <span className="text-white">{event.currentAttendees || 0}/{event.maxAttendees}</span>
                                                </div>
                                                <div className="h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
                                                        style={{ width: `${((event.currentAttendees || 0) / event.maxAttendees) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-4 pt-4 border-t border-white/[0.05] flex gap-2">
                                            {organizingEvents.some(e => e._id === event._id) ? (
                                                <>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={() => router.push(`/dashboard/events/${event._id}`)}
                                                    >
                                                        Manage
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="flex-1 !bg-violet-600 hover:!bg-violet-500"
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
                                                </>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="w-full flex-1"
                                                    onClick={() => router.push(`/events/${event._id}`)}
                                                >
                                                    View Details
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FadeIn>
                )}

                {/* Empty State */}
                {!loading && !error && currentEvents.length === 0 && (
                    <FadeIn>
                        <div className="text-center py-16">
                            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <h3 className="text-xl font-semibold text-white mb-2">
                                {activeTab === 'attending' ? 'No events to attend' : 'No events organized'}
                            </h3>
                            <p className="text-gray-400 mb-6">
                                {activeTab === 'attending'
                                    ? 'Explore events and get your tickets!'
                                    : 'Create your first event and start selling tickets.'}
                            </p>
                            <Button onClick={() => router.push(activeTab === 'attending' ? '/events' : '/create/event')}>
                                {activeTab === 'attending' ? 'Browse Events' : 'Create Event'}
                            </Button>
                        </div>
                    </FadeIn>
                )}

                {/* FAB for Creating Events */}
                {activeTab === 'organizing' && (
                    <Link
                        href="/create/event"
                        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-violet-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30 hover:scale-105 transition-transform"
                    >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </Link>
                )}
            </div>
        </DashboardLayout>
    );
}
