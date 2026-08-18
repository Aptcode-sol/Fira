'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { ticketsApi } from '@/lib/api';
import TicketDisplay from '@/components/TicketDisplay';

import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';

interface Ticket {
    _id: string;
    ticketId: string;
    event: {
        _id: string;
        name: string;
        date?: string;
        startTime?: string;
        startDateTime?: string;
        endDateTime?: string;
        venue: {
            name: string;
            address: {
                city: string;
            };
        };
    };
    quantity: number;
    status: string;
    qrCode: string;
    ticketType: string;
}

export default function TicketsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    const [selectedTicket, setSelectedTicket] = useState<any>(null);

    useEffect(() => {
        const fetchTickets = async () => {
            if (!user?._id) return;
            try {
                setLoading(true);
                const data = await ticketsApi.getUserTickets(user._id) as Ticket[];
                setTickets(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load tickets');
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated && user?._id) {
            fetchTickets();
        }
    }, [isAuthenticated, user?._id]);

    const handleDownload = (ticket: Ticket) => {
        setSelectedTicket(ticket);
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

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                <SlideUp>
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">My Tickets</h1>
                        <p className="text-gray-300">Your purchased tickets and event passes</p>
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
                                <div className="flex flex-col md:flex-row">
                                    <div className="md:w-48 p-6 bg-white/[0.03] flex items-center justify-center border-b md:border-b-0 md:border-r border-white/[0.08]">
                                        <div className="w-32 h-32 bg-white/[0.05] rounded-xl animate-pulse" />
                                    </div>
                                    <div className="flex-1 p-6 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-5 w-48 bg-white/[0.05] rounded animate-pulse" />
                                            <div className="h-5 w-16 bg-white/[0.05] rounded-full animate-pulse" />
                                        </div>
                                        <div className="h-4 w-3/4 bg-white/[0.05] rounded animate-pulse" />
                                        <div className="h-4 w-1/2 bg-white/[0.05] rounded animate-pulse" />
                                        <div className="flex gap-3 pt-2">
                                            <div className="h-8 w-28 bg-white/[0.05] rounded animate-pulse" />
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

                {/* Tickets List */}
                {!loading && !error && (
                    <FadeIn>
                        <div className="space-y-4">
                            {tickets.map((ticket) => (
                                <div
                                    key={ticket._id}
                                    className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300"
                                >
                                    <div className="flex flex-col sm:flex-row">
                                        {/* QR Code Section */}
                                        <div className="w-full sm:w-48 p-4 sm:p-6 bg-white/[0.03] flex items-center justify-center border-b sm:border-b-0 sm:border-r border-white/[0.08]">
                                            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-xl flex items-center justify-center p-2">
                                                {ticket.qrCode ? (
                                                    <img src={ticket.qrCode} alt="Ticket QR" className="w-full h-full object-contain" />
                                                ) : (
                                                    <div className="text-center">
                                                        <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-800 mx-auto mb-1 sm:mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                        </svg>
                                                        <span className="text-[10px] sm:text-xs text-gray-300">Scan to enter</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ticket Details */}
                                        <div className="flex-1 p-5 sm:p-6 min-w-0">
                                            {/* Title + status. The badge never shrinks or wraps
                                                onto its own line, however long the event name is. */}
                                            <div className="flex items-start justify-between gap-3 mb-4">
                                                <h3 className="text-lg font-semibold text-white leading-snug break-words min-w-0">
                                                    {ticket.event?.name || 'Event'}
                                                </h3>
                                                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${ticket.status === 'active'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : ticket.status === 'used'
                                                        ? 'bg-gray-500/20 text-gray-300'
                                                        : 'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {ticket.status === 'active' ? 'Valid' : ticket.status === 'used' ? 'Used' : 'Cancelled'}
                                                </span>
                                            </div>

                                            {/* Every field as a label/value row, so they line up
                                                instead of floating at different alignments. */}
                                            <dl className="space-y-2 text-sm">
                                                <div className="flex items-baseline justify-between gap-4">
                                                    <dt className="text-gray-300 shrink-0">Venue</dt>
                                                    <dd className="text-gray-300 text-right break-words min-w-0">
                                                        {ticket.event?.venue?.name || 'TBA'}
                                                        {ticket.event?.venue?.address?.city ? `, ${ticket.event.venue.address.city}` : ''}
                                                    </dd>
                                                </div>
                                                <div className="flex items-baseline justify-between gap-4">
                                                    <dt className="text-gray-300 shrink-0">When</dt>
                                                    <dd className="text-gray-300 text-right">
                                                        {ticket.event?.startDateTime
                                                            ? formatDate(ticket.event.startDateTime)
                                                            : (ticket.event?.date ? formatDate(ticket.event.date) : 'TBA')}
                                                        {' • '}
                                                        {ticket.event?.startDateTime
                                                            ? new Date(ticket.event.startDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                                            : (ticket.event?.startTime || 'TBA')}
                                                    </dd>
                                                </div>
                                                <div className="flex items-baseline justify-between gap-4">
                                                    <dt className="text-gray-300 shrink-0">Ticket ID</dt>
                                                    <dd className="font-mono text-white text-right break-all min-w-0">{ticket.ticketId}</dd>
                                                </div>
                                                <div className="flex items-baseline justify-between gap-4">
                                                    <dt className="text-gray-300 shrink-0">Type</dt>
                                                    <dd className="text-gray-300 text-right">
                                                        {ticket.quantity}x {ticket.ticketType || 'General Admission'}
                                                    </dd>
                                                </div>
                                            </dl>

                                            {/* Actions: hidden entirely for cancelled tickets (Req 6.4).
                                                For active tickets, full width and stacked on narrow,
                                                inline once there is room. */}
                                            {ticket.status !== 'cancelled' && (
                                            <div className="mt-5 pt-4 border-t border-white/[0.05] grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="w-full sm:w-auto justify-center"
                                                    onClick={() => handleDownload(ticket)}
                                                    disabled={ticket.status !== 'active'}
                                                    title={
                                                        ticket.status !== 'active'
                                                            ? `This ticket is ${ticket.status} and cannot be downloaded`
                                                            : undefined
                                                    }
                                                >
                                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    View &amp; Download
                                                </Button>
                                                {ticket.event?._id && (
                                                    <Link href={`/events/${ticket.event._id}`} className="w-full sm:w-auto">
                                                        <Button variant="secondary" size="sm" className="w-full sm:w-auto justify-center">
                                                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                            View Event
                                                        </Button>
                                                    </Link>
                                                )}
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FadeIn>
                )}

                {/* Empty State */}
                {!loading && !error && tickets.length === 0 && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-white mb-2">No tickets yet</h3>
                        <p className="text-gray-300 mb-6">Start exploring events to get your first ticket!</p>
                        <Button onClick={() => router.push('/events')}>Browse Events</Button>
                    </div>
                )}

                {/* Ticket Details Modal */}
                {selectedTicket && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setSelectedTicket(null)}>
                        <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                            <TicketDisplay
                                ticket={selectedTicket}
                                event={selectedTicket.event}
                                onClose={() => setSelectedTicket(null)}
                            />
                        </div>
                    </div>
                )}


            </div>
        </DashboardLayout>
    );
}
