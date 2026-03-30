'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import EventCard from './EventCard';
import { eventsApi } from '@/lib/api';
import { Event } from '@/lib/types';
import { FadeIn } from './animations';

interface FollowingFeedSectionProps {
    cityFilter?: string;
}

export default function FollowingFeedSection({ cityFilter }: FollowingFeedSectionProps) {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const fetchEvents = useCallback(async (token: string) => {
        setIsLoading(true);
        try {
            const params: Record<string, string> = { following: 'true', limit: '10' };
            if (cityFilter) params.city = cityFilter;
            const response = await eventsApi.getAll(params) as { events: Event[] };
            setEvents(response.events || []);
        } catch {
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [cityFilter]);

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('fira_token') : null;
        setIsLoggedIn(!!token);
        if (!token) { setIsLoading(false); return; }
        fetchEvents(token);
    }, [fetchEvents]);

    if (!isLoggedIn || (!isLoading && events.length === 0)) return null;

    return (
        <FadeIn>
            <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-white relative pl-4">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 md:h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full"></span>
                        From Brands You Follow
                    </h2>
                    <Link
                        href="/events?following=true"
                        className="text-gray-400 hover:text-white text-sm transition-colors"
                    >
                        See All
                    </Link>
                </div>

                {isLoading ? (
                    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex-shrink-0 w-[280px] md:w-[300px]">
                                <div className="bg-black/70 border border-white/5 rounded-2xl overflow-hidden animate-pulse">
                                    <div className="h-44 bg-white/10" />
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
                        {events.map((event, index) => (
                            <div key={event._id} className="flex-shrink-0 w-[280px] md:w-[300px] snap-start">
                                <EventCard event={event} index={index} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </FadeIn>
    );
}
