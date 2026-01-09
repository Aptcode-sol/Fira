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

export default function PartiesSection() {
    const [parties, setParties] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchParties = async () => {
            try {
                const response = await eventsApi.getAll({ sort: 'upcoming', limit: '4' }) as { events: Event[] };
                setParties(response.events || []);
            } catch (error) {
                console.error('Failed to fetch parties:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchParties();
    }, []);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        return { day, month };
    };

    const formatTime = (time: string) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}${minutes !== '00' ? ':' + minutes : ''} ${ampm}`;
    };

    const formatPrice = (price?: number) => {
        if (!price || price === 0) return 'Free';
        return `₹${price.toLocaleString()}`;
    };

    return (
        <FadeIn>
            <section id="parties-section" className="relative min-h-screen py-24 px-4 sm:px-6 lg:px-8 flex items-center">
                {/* Full-screen glassmorphic background */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

                <div className="relative z-10 max-w-6xl mx-auto w-full">
                    <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 md:p-12">
                        <div className="relative z-10">
                            {/* Section Header */}
                            <SlideUp>
                                <div className="text-center mb-16">
                                    <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 text-white">
                                        Upcoming <span className="accent-text">Parties</span>
                                    </h2>
                                    <p className="text-gray-500 max-w-xl mx-auto">
                                        Discover the hottest events happening around you
                                    </p>
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

                            {/* Empty State */}
                            {!isLoading && parties.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-gray-400 text-lg">No upcoming events found</p>
                                    <Link href="/events" className="text-violet-400 hover:text-violet-300 mt-2 inline-block">
                                        Browse all events →
                                    </Link>
                                </div>
                            )}

                            {/* Parties Grid */}
                            {!isLoading && parties.length > 0 && (
                                <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {parties.map((party) => {
                                        const { day, month } = formatDate(party.startDateTime);
                                        const venueName = party.venue?.name || party.venueName || 'Venue TBA';
                                        const venueCity = party.venue?.address?.city || '';
                                        const displayVenue = venueCity ? `${venueName}, ${venueCity}` : venueName;

                                        return (
                                            <StaggerItem key={party._id}>
                                                <Link href={`/events/${party._id}`}>
                                                    <div className="glass-card overflow-hidden group cursor-pointer h-full hover:-translate-y-1 transition-transform duration-300">
                                                        {/* Image */}
                                                        <div className="relative h-40 overflow-hidden">
                                                            <img
                                                                src={party.images?.[0] || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop'}
                                                                alt={party.name}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                                                            {/* Date Badge */}
                                                            <div className="absolute top-3 left-3 text-white">
                                                                <div className="text-lg font-bold">{day}</div>
                                                                <div className="text-xs text-gray-300">{month}</div>
                                                            </div>

                                                            {/* Price */}
                                                            <div className="absolute bottom-3 right-3">
                                                                <span className={`text-sm font-medium ${!party.ticketPrice ? 'text-emerald-400' : 'text-white'}`}>
                                                                    {formatPrice(party.ticketPrice)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="p-4">
                                                            <h3 className="text-sm font-medium text-white mb-1 line-clamp-1 group-hover:text-violet-400 transition-colors">
                                                                {party.name}
                                                            </h3>
                                                            <p className="text-gray-500 text-xs flex items-center gap-1 mb-2">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                </svg>
                                                                {displayVenue}
                                                            </p>
                                                            <div className="flex items-center justify-between text-xs text-gray-600">
                                                                <span>{formatTime(party.startTime)}</span>
                                                                <span>{(party.currentAttendees || 0)}+ going</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </StaggerItem>
                                        );
                                    })}
                                </StaggerContainer>
                            )}

                            {/* View More Button */}
                            <SlideUp delay={0.3}>
                                <div className="text-center mt-12">
                                    <Link
                                        href="/events"
                                        className="btn-primary px-6 py-3 rounded-full inline-flex items-center gap-2"
                                    >
                                        View all parties
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
