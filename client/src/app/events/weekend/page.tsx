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

export default function WeekendEventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Calculate weekend dates
    const getWeekendDates = () => {
        const now = new Date();
        const day = now.getDay();
        const daysUntilFriday = day <= 5 ? 5 - day : 6;
        const friday = new Date(now);
        friday.setDate(now.getDate() + daysUntilFriday);
        friday.setHours(18, 0, 0, 0);

        const sunday = new Date(friday);
        sunday.setDate(friday.getDate() + 2);
        sunday.setHours(23, 59, 59, 999);

        return { friday, sunday };
    };

    const weekendDates = getWeekendDates();
    const weekendLabel = weekendDates.friday.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    }) + ' - ' + weekendDates.sunday.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });

    const fetchEvents = useCallback(async (pageNum: number, append: boolean = false) => {
        try {
            if (append) setIsLoadingMore(true);
            else setIsLoading(true);

            const response = await eventsApi.getAll({
                weekend: 'true',
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
            console.error('Failed to fetch weekend events:', error);
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

    const formatEventDay = (dateStr: string) => {
        const date = new Date(dateStr);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
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
                                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-violet-400 text-sm font-medium uppercase tracking-wider">{weekendLabel}</span>
                                </div>
                                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">
                                    Weekend <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">Events</span>
                                </h1>
                                <p className="text-gray-400 text-lg">
                                    Plan your perfect weekend with these amazing events
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
                                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-violet-500/10 flex items-center justify-center">
                                        <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">No weekend events yet</h3>
                                    <p className="text-gray-400 mb-6">Check back soon for weekend happenings</p>
                                    <Link
                                        href="/events"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white rounded-full transition-all"
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
                                            {/* Day Badge */}
                                            <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-violet-500/90 to-pink-500/90 backdrop-blur-sm px-2 py-1 rounded-full">
                                                <span className="text-white text-xs font-semibold">
                                                    {formatEventDay(event.startDateTime)}
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
                                            <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full"></div>
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
