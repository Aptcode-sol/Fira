'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import { venuesApi } from '@/lib/api';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import { FadeIn, SlideUp } from '@/components/animations';
import { openCreateVenue, openEditVenue } from '@/components/modals/CreateVenueLauncher';
import { VENUE_SAVED } from '@/components/modals/CreateVenueModal';
import { venueDayRate } from '@/lib/venuePricing';

interface Venue {
    _id: string;
    name: string;
    images: string[];
    status: string;
    address: {
        city: string;
        state: string;
    };
    pricing: {
        pricePerDay?: number | null;
        /** Legacy flat fee, still mirrored server-side. venueDayRate falls back to it. */
        basePrice?: number | null;
    };
    capacity: {
        min: number;
        max: number;
    };
    rating?: {
        average: number;
        count: number;
    };
    createdAt: string;
}

export default function VenuePortalVenuesPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
    const [filterOpen, setFilterOpen] = useState(false);

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

    useEffect(() => {
        const fetchVenues = async () => {
            if (!isAuthenticated || !isVenueOwner(user)) return;

            try {
                setLoading(true);
                const data = await venuesApi.getMyVenues() as Venue[];
                setVenues(data);
            } catch (err) {
                console.error('Failed to fetch venues:', err);
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated && isVenueOwner(user)) {
            fetchVenues();
        }
        // Creating and editing both happen in a modal over this list.
        window.addEventListener(VENUE_SAVED, fetchVenues);
        return () => window.removeEventListener(VENUE_SAVED, fetchVenues);
    }, [isAuthenticated, user]);

    const filteredVenues = venues.filter(v => {
        if (filter === 'all') return true;
        return v.status === filter;
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

    const columns: Column<Venue>[] = [
        {
            key: 'name',
            header: 'Venue',
            primary: true,
            cell: (v) => (
                <div className="flex items-center gap-3">
                    <div className="hidden md:block w-9 h-9 rounded-lg overflow-hidden bg-white/5 shrink-0">
                        {v.images?.[0] ? (
                            <img src={v.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-violet-500/10 text-violet-400 text-xs font-bold">
                                {v.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <span className="font-medium text-white">{v.name}</span>
                </div>
            ),
        },
        {
            key: 'location',
            header: 'Location',
            cell: (v) => (
                <span className="text-gray-300">
                    {[v.address?.city, v.address?.state].filter(Boolean).join(', ') || '—'}
                </span>
            ),
        },
        {
            key: 'rate',
            header: 'Day rate',
            align: 'right',
            cell: (v) => <span className="whitespace-nowrap">₹{venueDayRate(v).toLocaleString()}</span>,
        },
        {
            key: 'capacity',
            header: 'Capacity',
            align: 'right',
            // "1-100 guests" was the usual reading, since a minimum headcount is
            // no longer collected and defaults to 1.
            cell: (v) => (
                <span className="whitespace-nowrap text-gray-300">
                    {(v.capacity?.min ?? 1) > 1
                        ? `${v.capacity?.min}-${v.capacity?.max}`
                        : `Up to ${v.capacity?.max}`}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            cell: (v) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${v.status === 'approved'
                    ? 'bg-green-500/20 text-green-400'
                    : v.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                    {v.status}
                </span>
            ),
        },
    ];

    return (
        <VenueDashboardLayout>
            <div className="p-4 sm:p-6 lg:p-8">
                {/* Header. Title and Add New Venue sit at opposite ends of the
                    same row on every width, mobile included - the button used to
                    drop to its own full-width line below the subtitle, which put
                    the primary action furthest from the heading it belongs to. */}
                <SlideUp>
                    <div className="flex flex-row items-start justify-between gap-3 mb-6 sm:mb-8">
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">My Venues</h1>
                            <p className="text-sm sm:text-base text-gray-300">Manage all your listed venues</p>
                        </div>
                        <Button variant="violet" onClick={openCreateVenue} className="shadow-lg shadow-violet-500/25 shrink-0">
                            <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {/* On a narrow screen the plus alone carries it, and the
                                accessible name comes from the sr-only text. */}
                            <span className="hidden sm:inline">Add New Venue</span>
                            <span className="sr-only sm:hidden">Add New Venue</span>
                        </Button>
                    </div>
                </SlideUp>

                {/* Filter Dropdown */}
                <FadeIn delay={0.1}>
                    <div className="mb-6">
                        <div className="relative w-full sm:w-56">
                            <button
                                onClick={() => setFilterOpen(!filterOpen)}
                                className="w-full flex items-center justify-between bg-white/[0.04] border border-white/[0.1] text-white text-sm font-medium rounded-xl px-4 py-3 hover:bg-white/[0.08] hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                            >
                                <span>
                                    {filter === 'all' && `All Venues (${venues.length})`}
                                    {filter === 'approved' && `Approved (${venues.filter(v => v.status === 'approved').length})`}
                                    {filter === 'pending' && `Pending (${venues.filter(v => v.status === 'pending').length})`}
                                    {filter === 'rejected' && `Rejected (${venues.filter(v => v.status === 'rejected').length})`}
                                </span>
                                <svg
                                    className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {filterOpen && (
                                <div className="absolute top-full left-0 mt-2 w-full z-30 bg-black/90 backdrop-blur-xl border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl shadow-black/50">
                                    {[
                                        { value: 'all', label: `All Venues (${venues.length})` },
                                        { value: 'approved', label: `Approved (${venues.filter(v => v.status === 'approved').length})` },
                                        { value: 'pending', label: `Pending (${venues.filter(v => v.status === 'pending').length})` },
                                        { value: 'rejected', label: `Rejected (${venues.filter(v => v.status === 'rejected').length})` },
                                    ].map(({ value, label }) => (
                                        <button
                                            key={value}
                                            onClick={() => { setFilter(value as any); setFilterOpen(false); }}
                                            className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                                                filter === value
                                                    ? 'bg-violet-500/20 text-violet-300'
                                                    : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </FadeIn>

                {/* Venues table. Clicking a row opens that venue's manage screen
                    - the one place photo ordering, date blocking, activate and
                    delete live - so this list never grows a second copy of them. */}
                <FadeIn delay={0.2}>
                    <DataTable
                        rows={filteredVenues}
                        columns={columns}
                        rowKey={(v) => v._id}
                        onRowClick={(v) => router.push(`/dashboard/venues/${v._id}`)}
                        loading={loading}
                        pageSize={10}
                        label={(n) => `${n} venue${n === 1 ? '' : 's'}`}
                        empty={
                            <>
                                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                                    <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">No venues found</h3>
                                <p className="text-gray-300 mb-6">
                                    {filter === 'all'
                                        ? "You haven't listed any venues yet. Start by adding your first venue."
                                        : `No ${filter} venues found.`}
                                </p>
                                {filter === 'all' && (
                                    <Button variant="violet" onClick={openCreateVenue}>
                                        Add Your First Venue
                                    </Button>
                                )}
                            </>
                        }
                        actions={(venue) => (
                            <>
                                <Link href={`/venue-portal/venues/${venue._id}/preview`}>
                                    <Button variant="secondary" size="sm">Preview</Button>
                                </Link>
                                <Button
                                    variant="violet"
                                    size="sm"
                                    className="shadow-lg shadow-violet-500/25"
                                    onClick={() => openEditVenue(venue._id)}
                                >
                                    Edit
                                </Button>
                            </>
                        )}
                    />
                </FadeIn>
            </div>
        </VenueDashboardLayout>
    );
}
