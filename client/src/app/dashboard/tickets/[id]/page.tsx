'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { ticketsApi } from '@/lib/api';
import TicketDisplay from '@/components/TicketDisplay';
import { FadeIn, SlideUp } from '@/components/animations';
import { venueLabel } from '@/lib/venueDisplay';

interface Ticket {
    _id: string;
    ticketId: string;
    event: {
        _id: string;
        name: string;
        date?: string;
        startTime?: string;
        startDateTime?: string;
        venue?: { name?: string; address?: { city?: string } };
        customVenue?: { isCustom?: boolean; name?: string; city?: string } | null;
    };
    quantity: number;
    status: string;
    qrCode: string;
    ticketType: string;
    totalAmount?: number;
    createdAt?: string;
}

/**
 * Dedicated page for one ticket, opened by clicking its row in My Tickets.
 * This is where the pass itself lives - TicketDisplay already owns the QR and
 * the download, so the page frames it rather than reimplementing it.
 */
export default function TicketDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { isAuthenticated, isLoading } = useAuth();
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.push('/signin');
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setLoading(true);
                const data = await ticketsApi.getById(id) as Ticket | { ticket: Ticket };
                setTicket('ticket' in data ? data.ticket : data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load ticket');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (isLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    const formatDate = (value?: string) =>
        value
            ? new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
            : 'TBA';

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 max-w-3xl">
                <SlideUp>
                    <Link href="/dashboard/tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to My Tickets
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                        {loading ? 'Ticket' : (ticket?.event?.name || 'Ticket')}
                    </h1>
                    <p className="text-sm text-gray-300 font-mono break-all">{ticket?.ticketId}</p>
                </SlideUp>

                {loading ? (
                    <div className="mt-6 h-64 bg-white/[0.04] rounded-2xl animate-pulse" />
                ) : error || !ticket ? (
                    <div className="mt-10 text-center">
                        <p className="text-red-400 mb-4">{error || 'Ticket not found'}</p>
                        <Button onClick={() => router.push('/dashboard/tickets')}>Back to My Tickets</Button>
                    </div>
                ) : (
                    <FadeIn animateOnMount>
                        <div className="mt-6 grid gap-6 md:grid-cols-2">
                            {/* The pass. onClose returns to the list, since there is
                                no overlay to dismiss on a page. */}
                            <div>
                                <TicketDisplay
                                    ticket={ticket}
                                    event={ticket.event}
                                    onClose={() => router.push('/dashboard/tickets')}
                                />
                            </div>

                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 h-fit">
                                <h2 className="text-sm font-semibold text-white mb-4">Details</h2>
                                <dl className="space-y-3 text-sm">
                                    {[
                                        ['Status', ticket.status === 'active' ? 'Valid' : ticket.status === 'used' ? 'Used' : 'Cancelled'],
                                        ['When', `${formatDate(ticket.event?.startDateTime || ticket.event?.date)}${ticket.event?.startDateTime ? ` · ${new Date(ticket.event.startDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}`],
                                        ['Venue', ticket.event ? venueLabel(ticket.event) : 'TBA'],
                                        ['Type', `${ticket.quantity}x ${ticket.ticketType || 'General Admission'}`],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-baseline justify-between gap-4">
                                            <dt className="text-gray-400 shrink-0">{label}</dt>
                                            <dd className="text-gray-200 text-right min-w-0 break-words">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                {ticket.event?._id && (
                                    <Link href={`/events/${ticket.event._id}`} className="block mt-5">
                                        <Button variant="secondary" size="sm" className="w-full justify-center">
                                            View Event
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </FadeIn>
                )}
            </div>
        </DashboardLayout>
    );
}
