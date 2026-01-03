'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { ticketsApi } from '@/lib/api';
import TicketDisplay from '@/components/TicketDisplay';
import { CancellationModal } from '@/components/CancellationModal';
import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';

interface Ticket {
    _id: string;
    ticketId: string;
    event: {
        _id: string;
        name: string;
        date: string;
        startTime: string;
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
    const [cancelTicket, setCancelTicket] = useState<Ticket | null>(null);

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
                        <p className="text-gray-400">Your purchased tickets and event passes</p>
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
                                    <div className="flex flex-col md:flex-row">
                                        {/* QR Code Section */}
                                        <div className="md:w-48 p-6 bg-white/[0.03] flex items-center justify-center border-b md:border-b-0 md:border-r border-white/[0.08]">
                                            <div className="w-32 h-32 bg-white rounded-xl flex items-center justify-center p-2">
                                                {ticket.qrCode ? (
                                                    <img src={ticket.qrCode} alt="Ticket QR" className="w-full h-full object-contain" />
                                                ) : (
                                                    <div className="text-center">
                                                        <svg className="w-16 h-16 text-gray-800 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                        </svg>
                                                        <span className="text-xs text-gray-600">Scan to enter</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ticket Details */}
                                        <div className="flex-1 p-6">
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h3 className="text-lg font-semibold text-white">{ticket.event?.name || 'Event'}</h3>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ticket.status === 'active'
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : ticket.status === 'used'
                                                                ? 'bg-gray-500/20 text-gray-400'
                                                                : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {ticket.status === 'active' ? 'Valid' : ticket.status === 'used' ? 'Used' : 'Cancelled'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-400 mb-1">
                                                        {ticket.event?.venue?.name}{ticket.event?.venue?.address?.city ? `, ${ticket.event.venue.address.city}` : ''}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {ticket.event?.date ? formatDate(ticket.event.date) : ''} • {ticket.event?.startTime || ''}
                                                    </p>
                                                </div>

                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500 mb-1">Ticket ID</p>
                                                    <p className="text-sm font-mono text-white">{ticket.ticketId}</p>
                                                    <p className="text-xs text-gray-500 mt-2">{ticket.quantity}x {ticket.ticketType || 'General Admission'}</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-white/[0.05] flex flex-wrap gap-3">
                                                <Button variant="secondary" size="sm" onClick={() => handleDownload(ticket)}>
                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    View & Download
                                                </Button>
                                                {ticket.event?._id && (
                                                    <Link href={`/events/${ticket.event._id}`}>
                                                        <Button variant="ghost" size="sm">
                                                            View Event
                                                        </Button>
                                                    </Link>
                                                )}
                                                {ticket.status === 'active' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                        onClick={() => setCancelTicket(ticket)}
                                                    >
                                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                        Cancel Ticket
                                                    </Button>
                                                )}
                                            </div>
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
                        <p className="text-gray-400 mb-6">Start exploring events to get your first ticket!</p>
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

                {/* Cancellation Modal */}
                {cancelTicket && user && (
                    <CancellationModal
                        isOpen={!!cancelTicket}
                        onClose={() => setCancelTicket(null)}
                        ticketId={cancelTicket._id}
                        eventName={cancelTicket.event?.name || 'Event'}
                        userId={user._id}
                        onSuccess={() => {
                            // Refresh tickets list
                            setTickets(prev => prev.map(t =>
                                t._id === cancelTicket._id
                                    ? { ...t, status: 'cancelled' }
                                    : t
                            ));
                            setCancelTicket(null);
                        }}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}
