'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from './animations';
import { eventsApi } from '@/lib/api';

interface Event {
    _id: string;
    name: string;
    startDateTime: string;
    venue?: { name: string; address?: { city: string } };
    venueName?: string;
    images: string[];
    ticketPrice?: number;
    currentAttendees?: number;
    organizer?: {
        _id: string;
        name: string;
        avatar?: string;
    };
}

export default function FollowingFeedSection() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        // Check if user is logged in
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        setIsLoggedIn(!!token);

        if (!token) {
            setIsLoading(false);
            return;
        }

        const fetchFollowingEvents = async () => {
            try {
                // Fetch events from followed brands
                const response = await eventsApi.getAll({ following: 'true', limit: '6' }) as { events: Event[] };
                setEvents(response.events || []);
            } catch (error) {
                console.error('Failed to fetch following events:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFollowingEvents();
    }, []);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formatPrice = (price?: number) => {
        if (!price || price === 0) return 'Free';
        return `₹${price.toLocaleString()}`;
    };

    // Don't render if not logged in or no events
    if (!isLoggedIn) {
        return null;
    }

    if (!isLoading && events.length === 0) {
        return (
            <FadeIn>
                <section className="relative py-16 px-4 sm:px-6 lg:px-8">
                    <div className="relative z-10 max-w-6xl mx-auto w-full">
                        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/70 backdrop-blur-sm p-8 md:p-12">
                            <div className="relative z-10 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Follow brands you love</h3>
                                <p className="text-gray-400 mb-6">Get personalized event updates from your favorite creators</p>
                                <Link
                                    href="/creators"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white rounded-full transition-all"
                                >
                                    Discover Creators
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </FadeIn>
        );
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
                                            <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                            </svg>
                                            <span className="text-pink-400 text-sm font-medium uppercase tracking-wider">Your Feed</span>
                                        </div>
                                        <h2 className="text-3xl sm:text-4xl font-bold text-white">
                                            From Brands You <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">Follow</span>
                                        </h2>
                                        <p className="text-gray-500 mt-2">
                                            Upcoming events from creators you're following
                                        </p>
                                    </div>
                                    <Link
                                        href="/creators"
                                        className="hidden sm:flex items-center gap-2 text-pink-400 hover:text-pink-300 transition-colors text-sm font-medium"
                                    >
                                        Discover more
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </Link>
                                </div>
                            </SlideUp>

                            {/* Loading Skeleton */}
                            {isLoading && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[1, 2, 3].map((i) => (
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
                                <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {events.map((event) => {
                                        const venueName = event.venue?.name || event.venueName || 'Venue TBA';
                                        const venueCity = event.venue?.address?.city || '';
                                        const displayVenue = venueCity ? `${venueName}, ${venueCity}` : venueName;

                                        return (
                                            <StaggerItem key={event._id}>
                                                <Link href={`/events/${event._id}`}>
                                                    <div className="glass-card overflow-hidden group cursor-pointer h-full hover:-translate-y-1 transition-transform duration-300 border border-pink-500/20">
                                                        {/* Image */}
                                                        <div className="relative h-40 overflow-hidden">
                                                            <img
                                                                src={event.images?.[0] || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop'}
                                                                alt={event.name}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                                                            {/* Organizer Avatar */}
                                                            {event.organizer && (
                                                                <div className="absolute top-3 left-3 flex items-center gap-2">
                                                                    <img
                                                                        src={event.organizer.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40'}
                                                                        alt={event.organizer.name}
                                                                        className="w-8 h-8 rounded-full border-2 border-pink-500/50"
                                                                    />
                                                                    <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
                                                                        {event.organizer.name}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Price */}
                                                            <div className="absolute bottom-3 right-3">
                                                                <span className={`text-sm font-medium ${!event.ticketPrice ? 'text-emerald-400' : 'text-white'}`}>
                                                                    {formatPrice(event.ticketPrice)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="p-4">
                                                            <h3 className="text-sm font-medium text-white mb-1 line-clamp-1 group-hover:text-pink-400 transition-colors">
                                                                {event.name}
                                                            </h3>
                                                            <p className="text-gray-500 text-xs flex items-center gap-1 mb-2">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                </svg>
                                                                {displayVenue}
                                                            </p>
                                                            <div className="flex items-center justify-between text-xs text-gray-600">
                                                                <span>{formatDate(event.startDateTime)} • {formatTime(event.startDateTime)}</span>
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
                        </div>
                    </div>
                </div>
            </section>
        </FadeIn>
    );
}
