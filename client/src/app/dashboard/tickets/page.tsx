'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import { ticketsApi } from '@/lib/api';
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
        endDateTime?: string;
        venue: {
            name: string;
            address: {
                city: string;
            };
        };
        customVenue?: { isCustom?: boolean; name?: string; city?: string } | null;
    };
    quantity: number;
    status: string;
    qrCode: string;
    ticketType: string;
}

const statusLabel: Record<string, string> = {
    active: 'Valid',
    used: 'Used',
    cancelled: 'Cancelled',
};

const statusStyle: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    used: 'bg-gray-500/20 text-gray-300',
    cancelled: 'bg-red-500/20 text-red-400',
};

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
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // The QR code, download and event link all moved to /dashboard/tickets/[id].
    // The list is now a scan of what you hold; opening one ticket is what shows
    // the pass itself, which is also the only thing you can act on.
    const columns: Column<Ticket>[] = [
        {
            key: 'event',
            header: 'Event',
            primary: true,
            cell: (t) => <span className="font-medium text-white">{t.event?.name || 'Event'}</span>,
        },
        {
            key: 'when',
            header: 'When',
            cell: (t) => {
                const when = t.event?.startDateTime || t.event?.date;
                if (!when) return <span className="text-gray-400">TBA</span>;
                return (
                    <span className="whitespace-nowrap">
                        {formatDate(when)}
                        {' · '}
                        {t.event?.startDateTime
                            ? new Date(t.event.startDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                            : (t.event?.startTime || 'TBA')}
                    </span>
                );
            },
        },
        {
            key: 'venue',
            header: 'Venue',
            cell: (t) => (
                <span className="text-gray-300">{t.event ? venueLabel(t.event) : 'TBA'}</span>
            ),
        },
        {
            key: 'ticketId',
            header: 'Ticket ID',
            cell: (t) => <span className="font-mono text-xs text-gray-300 break-all">{t.ticketId}</span>,
        },
        {
            key: 'type',
            header: 'Type',
            cell: (t) => <span className="text-gray-300">{t.quantity}x {t.ticketType || 'General Admission'}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            cell: (t) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[t.status] ?? statusStyle.cancelled}`}>
                    {statusLabel[t.status] ?? t.status}
                </span>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                <SlideUp>
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">My Tickets</h1>
                        <p className="text-gray-300">Your purchased tickets and event passes</p>
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
                            rows={tickets}
                            columns={columns}
                            rowKey={(t) => t._id}
                            onRowClick={(t) => router.push(`/dashboard/tickets/${t._id}`)}
                            loading={loading}
                            pageSize={10}
                            label={(n) => `${n} ticket${n === 1 ? '' : 's'}`}
                            empty={
                                <>
                                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                    </svg>
                                    <h3 className="text-xl font-semibold text-white mb-2">No tickets yet</h3>
                                    <p className="text-gray-300 mb-6">Start exploring events to get your first ticket!</p>
                                    <Button onClick={() => router.push('/events')}>Browse Events</Button>
                                </>
                            }
                        />
                    </FadeIn>
                )}
            </div>
        </DashboardLayout>
    );
}
