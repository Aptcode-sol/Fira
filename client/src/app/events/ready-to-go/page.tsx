'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import EventCard from '@/components/EventCard';
import { EventCardSkeleton } from '@/components/ui';
import { eventsApi } from '@/lib/api';
import { Event } from '@/lib/types';
import { FadeIn, SlideUp } from '@/components/animations';

interface EventsResponse {
    events: Event[];
    totalPages: number;
    currentPage: number;
    total: number;
}

export default function ReadyToGoPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const fetchEvents = useCallback(async (pageNum: number, append: boolean = false) => {
        try {
            if (append) setIsLoadingMore(true);
            else setIsLoading(true);

            const response = await eventsApi.getAll({
                todayOnly: 'true',
                page: pageNum.toString(),
                limit: '12'
            }) as EventsResponse;

            if (append) {
                setEvents(prev => [...prev, ...response.events]);
            } else {
                setEvents(response.events || []);
            }
            setHasMore(pageNum < response.totalPages);
        } catch (error) {
            console.error('Failed to fetch ready-to-go events:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        fetchEvents(1);
    }, [fetchEvents]);

    // Infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchEvents(nextPage, true);
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, isLoading, page, fetchEvents]);

    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours <= 0 && diffMins <= 0) return 'Starting now';
        if (diffHours === 0) return `In ${diffMins}m`;
        if (diffHours < 12) return `In ${diffHours}h ${diffMins}m`;
        return `In ${diffHours}h`;
    };

    return (
        <>
            <PartyBackground />
            <main className="relative min-h-screen z-20">
                <Navbar />

                <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <FadeIn>
                            <div className="mb-8">
                                <Link
                                    href="/"
                                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Back to Home
                                </Link>

                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-emerald-400 text-sm font-medium uppercase tracking-wider">Happening Now</span>
                                </div>
                                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">
                                    Ready to <span className="text-emerald-400">Go</span>
                                </h1>
                                <p className="text-gray-400 text-lg">
                                    Events starting within the next 24 hours — grab your tickets before it's too late!
                                </p>
                            </div>
                        </FadeIn>

                        {/* Events Grid */}
                        {isLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {[...Array(8)].map((_, i) => (
                                    <EventCardSkeleton key={i} />
                                ))}
                            </div>
                        ) : events.length === 0 ? (
                            <SlideUp>
                                <div className="text-center py-20">
                                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                        <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">No events starting soon</h3>
                                    <p className="text-gray-400 mb-6">Check back later or browse all upcoming events</p>
                                    <Link
                                        href="/events"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-colors"
                                    >
                                        Browse All Events
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </Link>
                                </div>
                            </SlideUp>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {events.map((event) => (
                                        <div key={event._id} className="relative">
                                            {/* Urgency Badge */}
                                            <div className="absolute top-3 left-3 z-10 bg-emerald-500/90 backdrop-blur-sm px-2 py-1 rounded-full">
                                                <span className="text-white text-xs font-semibold">
                                                    {formatRelativeTime(event.startDateTime)}
                                                </span>
                                            </div>
                                            <EventCard event={event} />
                                        </div>
                                    ))}
                                </div>

                                {/* Load More */}
                                <div ref={loadMoreRef} className="mt-8">
                                    {isLoadingMore && (
                                        <div className="flex justify-center">
                                            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
