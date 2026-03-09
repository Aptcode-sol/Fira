'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from './animations';
import { eventsApi } from '@/lib/api';

interface Event {
    _id: string;
    name: string;
    startDateTime: string;
    startTime: string;
    venue?: { name: string; address?: { city: string } };
    venueName?: string;
    images: string[];
    ticketPrice?: number;
    currentAttendees?: number;
}

export default function WeekendEventsSection() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response = await eventsApi.getAll({ weekend: 'true', limit: '4' }) as { events: Event[] };
                setEvents(response.events || []);
            } catch (error) {
                console.error('Failed to fetch weekend events:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEvents();
    }, []);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateNum = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        return { day, dateNum, month };
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formatPrice = (price?: number) => {
        if (!price || price === 0) return 'Free';
        return `₹${price.toLocaleString()}`;
    };

    // Don't render if no events
    if (!isLoading && events.length === 0) {
        return null;
    }

    return (
        <FadeIn>
            <section className="relative py-16 px-4 sm:px-6 lg:px-8">
                <div className="relative z-10 max-w-6xl mx-auto w-full">
                    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/70 backdrop-blur-sm p-8 md:p-12">
                        <div className="relative z-10">
                            {/* Section Header */}
                            <SlideUp>
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl">🎉</span>
                                            <span className="text-orange-400 text-sm font-medium uppercase tracking-wider">This Weekend</span>
                                        </div>
                                        <h2 className="text-3xl sm:text-4xl font-bold text-white">
                                            Weekend <span className="text-orange-400">Events</span>
                                        </h2>
                                        <p className="text-gray-500 mt-2">
                                            Make the most of your weekend
                                        </p>
                                    </div>
                                    <Link
                                        href="/events/weekend"
                                        className="hidden sm:flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors text-sm font-medium"
                                    >
                                        See all
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </Link>
                                </div>
                            </SlideUp>

                            {/* Loading Skeleton */}
                            {isLoading && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="glass-card overflow-hidden animate-pulse">
                                            <div className="h-40 bg-white/10"></div>
                                            <div className="p-4 space-y-2">
                                                <div className="h-4 bg-white/10 rounded w-3/4"></div>
                                                <div className="h-3 bg-white/10 rounded w-1/2"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Events Grid */}
                            {!isLoading && events.length > 0 && (
                                <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {events.map((event) => {
                                        const { day, dateNum, month } = formatDate(event.startDateTime);
                                        const venueName = event.venue?.name || event.venueName || 'Venue TBA';
                                        const venueCity = event.venue?.address?.city || '';
                                        const displayVenue = venueCity ? `${venueName}, ${venueCity}` : venueName;

                                        return (
                                            <StaggerItem key={event._id}>
                                                <Link href={`/events/${event._id}`}>
                                                    <div className="glass-card overflow-hidden group cursor-pointer h-full hover:-translate-y-1 transition-transform duration-300 border border-orange-500/20">
                                                        {/* Image */}
                                                        <div className="relative h-40 overflow-hidden">
                                                            <img
                                                                src={event.images?.[0] || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop'}
                                                                alt={event.name}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                                                            {/* Date Badge */}
                                                            <div className="absolute top-3 left-3 text-white text-center">
                                                                <div className="text-xs text-orange-400 font-medium">{day}</div>
                                                                <div className="text-lg font-bold">{dateNum}</div>
                                                                <div className="text-xs text-gray-300">{month}</div>
                                                            </div>

                                                            {/* Price */}
                                                            <div className="absolute bottom-3 right-3">
                                                                <span className={`text-sm font-medium ${!event.ticketPrice ? 'text-emerald-400' : 'text-white'}`}>
                                                                    {formatPrice(event.ticketPrice)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="p-4">
                                                            <h3 className="text-sm font-medium text-white mb-1 line-clamp-1 group-hover:text-orange-400 transition-colors">
                                                                {event.name}
                                                            </h3>
                                                            <p className="text-gray-500 text-xs flex items-center gap-1 mb-2">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                </svg>
                                                                {displayVenue}
                                                            </p>
                                                            <div className="flex items-center justify-between text-xs text-gray-600">
                                                                <span>{formatTime(event.startDateTime)}</span>
                                                                <span>{(event.currentAttendees || 0)}+ going</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </StaggerItem>
                                        );
                                    })}
                                </StaggerContainer>
                            )}

                            {/* Mobile See All Button */}
                            <SlideUp delay={0.3}>
                                <div className="text-center mt-8 sm:hidden">
                                    <Link
                                        href="/events/weekend"
                                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors"
                                    >
                                        See all weekend events
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </Link>
                                </div>
                            </SlideUp>
                        </div>
                    </div>
                </div>
            </section>
        </FadeIn>
    );
}
