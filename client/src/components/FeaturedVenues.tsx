'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import VenueCard from './VenueCard';
import { venuesApi } from '@/lib/api';
import { Venue } from '@/lib/types';
import { FadeIn } from './animations';

interface FeaturedVenuesProps {
    cityFilter?: string;
}

export default function FeaturedVenues({ cityFilter }: FeaturedVenuesProps) {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchVenues = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: Record<string, string> = { limit: '10', status: 'approved' };
            if (cityFilter) params.city = cityFilter;
            const response = await venuesApi.getAll(params) as { venues?: Venue[] } | Venue[];
            const list = Array.isArray(response) ? response : (response as { venues?: Venue[] }).venues || [];
            setVenues(list);
        } catch {
            setVenues([]);
        } finally {
            setIsLoading(false);
        }
    }, [cityFilter]);

    useEffect(() => { fetchVenues(); }, [fetchVenues]);

    if (!isLoading && venues.length === 0) return null;

    const seeAllHref = cityFilter
        ? `/venues?city=${encodeURIComponent(cityFilter)}`
        : '/venues';

    return (
        <FadeIn>
            <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-white relative pl-4">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 md:h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full"></span>
                        Featured Venues
                    </h2>
                    <Link href={seeAllHref} className="text-gray-400 hover:text-white text-sm transition-colors">
                        See All
                    </Link>
                </div>

                {isLoading ? (
                    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex-shrink-0 w-[280px] md:w-[300px]">
                                <div className="bg-black/70 border border-white/5 rounded-2xl overflow-hidden animate-pulse">
                                    <div className="h-48 bg-white/10" />
                                    <div className="p-5 space-y-3">
                                        <div className="h-5 bg-white/10 rounded w-3/4" />
                                        <div className="h-4 bg-white/10 rounded w-1/2" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                        {venues.map((venue, index) => (
                            <div key={venue._id} className="flex-shrink-0 w-[280px] md:w-[300px] snap-start">
                                <VenueCard venue={venue} index={index} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </FadeIn>
    );
}
