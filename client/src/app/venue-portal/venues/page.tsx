'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { Button } from '@/components/ui';
import { FadeIn, SlideUp } from '@/components/animations';

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
        basePrice: number;
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

    useEffect(() => {
        const fetchVenues = async () => {
            if (!isAuthenticated || user?.role !== 'venue_owner') return;

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

        if (isAuthenticated && user?.role === 'venue_owner') {
            fetchVenues();
        }
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

    if (!isAuthenticated || user?.role !== 'venue_owner') {
        return null;
    }

    return (
        <VenueDashboardLayout>
            <div className="p-4 sm:p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 sm:mb-8 gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">My Venues</h1>
                            <p className="text-sm sm:text-base text-gray-400">Manage all your listed venues</p>
                        </div>
                        <Link href="/venue-portal/venues/create">
                            <Button variant="violet" className="shadow-lg shadow-violet-500/25 w-full sm:w-auto">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add New Venue
                            </Button>
                        </Link>
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
                                <option value="all" className="bg-[#1a1a1a]">All Venues ({venues.length})</option>
                                <option value="approved" className="bg-[#1a1a1a]">Approved ({venues.filter(v => v.status === 'approved').length})</option>
                                <option value="pending" className="bg-[#1a1a1a]">Pending ({venues.filter(v => v.status === 'pending').length})</option>
                                <option value="rejected" className="bg-[#1a1a1a]">Rejected ({venues.filter(v => v.status === 'rejected').length})</option>
                            </select>
                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </FadeIn>

                {/* Venues Grid */}
                <FadeIn delay={0.2}>
                    {loading ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                                    <div className="h-40 bg-white/5 animate-pulse" />
                                    <div className="p-4">
                                        <div className="w-3/4 h-5 bg-white/5 rounded animate-pulse mb-2" />
                                        <div className="w-1/2 h-4 bg-white/5 rounded animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredVenues.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredVenues.map((venue) => (
                                <div key={venue._id} className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden group hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300">
                                    <div className="h-40 bg-gradient-to-br from-violet-500/20 to-blue-500/20 relative">
                                        {venue.images?.[0] && (
                                            <img
                                                src={venue.images[0]}
                                                alt={venue.name}
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                        <span className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${venue.status === 'approved'
                                            ? 'bg-green-500/20 text-green-400'
                                            : venue.status === 'pending'
                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            {venue.status}
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-white truncate mb-1">{venue.name}</h3>
                                        <p className="text-sm text-gray-500 mb-3">
                                            {venue.address?.city}, {venue.address?.state}
                                        </p>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-400">
                                                ₹{venue.pricing?.basePrice?.toLocaleString()}
                                            </span>
                                            <span className="text-gray-500">
                                                {venue.capacity?.min}-{venue.capacity?.max} guests
                                            </span>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <Link href={`/venues/${venue._id}`} className="flex-1">
                                                <Button variant="secondary" size="sm" className="w-full">View</Button>
                                            </Link>
                                            <Link href={`/venue-portal/venues/${venue._id}/edit`} className="flex-1">
                                                <Button variant="violet" size="sm" className="w-full shadow-lg shadow-violet-500/25">Edit</Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                                <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">No venues found</h3>
                            <p className="text-gray-400 mb-6">
                                {filter === 'all'
                                    ? "You haven't listed any venues yet. Start by adding your first venue."
                                    : `No ${filter} venues found.`}
                            </p>
                            {filter === 'all' && (
                                <Link href="/venue-portal/venues/create">
                                    <Button variant="violet">
                                        Add Your First Venue
                                    </Button>
                                </Link>
                            )}
                        </div>
                    )}
                </FadeIn>
            </div>
        </VenueDashboardLayout>
    );
}
