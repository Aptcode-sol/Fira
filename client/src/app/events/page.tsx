'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import EventCard from '@/components/EventCard';
import { EventCardSkeleton, Input, Button, Select } from '@/components/ui';
import { eventsApi } from '@/lib/api';
import { Event } from '@/lib/types';
import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';

interface EventsResponse {
    events: Event[];
    totalPages: number;
    currentPage: number;
    total: number;
}

const categories = [
    { value: 'All', label: 'All Categories' },
    { value: 'party', label: 'Party' },
    { value: 'concert', label: 'Concert' },
    { value: 'wedding', label: 'Wedding' },
    { value: 'festival', label: 'Festival' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'music', label: 'Music' },
    { value: 'dance', label: 'Dance' },
    { value: 'dj', label: 'DJ Night' },
    { value: 'clubbing', label: 'Clubbing' },
    { value: 'fitness', label: 'Fitness' },
    { value: 'birthday', label: 'Birthday' },
];

const sortOptions = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'top', label: 'Popular' },
    { value: 'featured', label: 'Featured' },
    { value: 'latest', label: 'Latest' },
    { value: 'nearby', label: 'Near You' },
];

const ticketTypeOptions = [
    { value: 'all', label: 'All Tickets' },
    { value: 'free', label: 'Free' },
    { value: 'paid', label: 'Paid' },
];

const dateFilterOptions = [
    { value: 'all', label: 'Any Date' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'weekend', label: 'This Weekend' },
];

export default function EventsPage() {
    // Section data
    const [sections, setSections] = useState<{
        upcoming: Event[];
        top: Event[];
        latest: Event[];
        nearby: Event[];
    }>({
        upcoming: [],
        top: [],
        latest: [],
        nearby: []
    });

    // Filtered/paginated data
    const [gridData, setGridData] = useState<Event[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedSort, setSelectedSort] = useState('upcoming');
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState(false);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const [showAllMode, setShowAllMode] = useState(false);
    const [selectedTicketType, setSelectedTicketType] = useState('all');
    const [selectedDateFilter, setSelectedDateFilter] = useState('all');

    const isFiltered = showAllMode || searchQuery !== '' || selectedCategory !== 'All' || selectedSort !== 'upcoming' || selectedTicketType !== 'all' || selectedDateFilter !== 'all';
    const defaultSort = 'upcoming';

    // Reset filters
    const resetFilters = () => {
        setSearchQuery('');
        setSelectedCategory('All');
        setSelectedSort(defaultSort);
        setSelectedTicketType('all');
        setSelectedDateFilter('all');
        setShowAllMode(false);
        setPage(1);
        setGridData([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Fetch sections
    useEffect(() => {
        if (isFiltered) return;

        const fetchSections = async () => {
            setIsLoading(true);
            try {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        () => setLocationError(true)
                    );
                }

                const [upcomingRes, topRes, latestRes] = await Promise.all([
                    eventsApi.getAll({ status: 'upcoming', eventType: 'public', sort: 'upcoming' }) as Promise<EventsResponse>,
                    eventsApi.getAll({ status: 'upcoming', eventType: 'public', sort: 'top' }) as Promise<EventsResponse>,
                    eventsApi.getAll({ eventType: 'public', sort: 'latest' }) as Promise<EventsResponse>,
                ]);

                setSections({
                    upcoming: upcomingRes.events || [],
                    top: topRes.events || [],
                    latest: latestRes.events || [],
                    nearby: []
                });
            } catch (error) {
                console.error('Failed to fetch events:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSections();
    }, [isFiltered]);

    // Fetch filtered/paginated data
    const fetchFiltered = useCallback(async (pageNum: number, append: boolean = false) => {
        if (pageNum === 1) setIsLoading(true);
        else setIsLoadingMore(true);

        try {
            const params: Record<string, string> = {
                eventType: 'public',
                page: pageNum.toString(),
                limit: '12',
                sort: selectedSort,
            };
            if (searchQuery) params.search = searchQuery;
            if (selectedCategory !== 'All') params.category = selectedCategory;
            if (selectedTicketType !== 'all') params.ticketType = selectedTicketType;
            if (selectedDateFilter === 'today') params.dateFilter = 'today';
            else if (selectedDateFilter === 'tomorrow') params.dateFilter = 'tomorrow';
            else if (selectedDateFilter === 'weekend') params.weekend = 'true';

            // Featured filter
            if (selectedSort === 'featured') params.featured = 'true';

            const res = await eventsApi.getAll(params) as EventsResponse;
            const newEvents = res.events || [];

            if (append) {
                setGridData(prev => [...prev, ...newEvents]);
            } else {
                setGridData(newEvents);
            }

            setHasMore(res.currentPage < res.totalPages);
        } catch (error) {
            console.error('Failed to fetch events:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [searchQuery, selectedCategory, selectedSort, selectedTicketType, selectedDateFilter]);

    // Fetch when filters change
    useEffect(() => {
        if (isFiltered) {
            setPage(1);
            const timeout = setTimeout(() => fetchFiltered(1, false), 300);
            return () => clearTimeout(timeout);
        }
    }, [searchQuery, selectedCategory, selectedSort, selectedTicketType, selectedDateFilter, isFiltered, fetchFiltered]);

    // Infinite scroll observer
    useEffect(() => {
        if (!isFiltered || !hasMore || isLoadingMore) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    setPage(prev => prev + 1);
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => observerRef.current?.disconnect();
    }, [hasMore, isLoadingMore, isFiltered]);

    // Load more when page changes
    useEffect(() => {
        if (page > 1 && isFiltered) {
            fetchFiltered(page, true);
        }
    }, [page, isFiltered, fetchFiltered]);

    const handleSeeAll = (sort: string) => {
        setSelectedSort(sort);
        setSelectedCategory('All');
        setSearchQuery('');
        setShowAllMode(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEnableLocation = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationError(false);
            },
            () => {
                setLocationError(true);
                alert('Please enable location services.');
            }
        );
    };

    const Section = ({ title, data, sort }: { title: string; data: Event[]; sort?: string }) => {
        if (!data || data.length === 0) return null;

        return (
            <FadeIn>
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl md:text-2xl font-bold text-white relative pl-4">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 md:h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full"></span>
                            {title}
                        </h2>
                        {sort && (
                            <Button
                                variant="ghost"
                                className="text-gray-400 hover:text-white text-sm"
                                onClick={() => handleSeeAll(sort)}
                            >
                                See All
                            </Button>
                        )}
                    </div>
                    {/* Horizontal scroll container */}
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                        {data.map((event, index) => (
                            <div key={event._id} className="flex-shrink-0 w-[280px] md:w-[300px] snap-start">
                                <EventCard event={event} index={index} />
                            </div>
                        ))}
                    </div>
                </div>
            </FadeIn>
        );
    };

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <SlideUp>
                        <div className="text-center mb-12">
                            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6">
                                Discover <span className="text-violet-400">Events</span>
                            </h1>
                            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                                Find parties, concerts, festivals and more happening around you.
                            </p>
                        </div>
                    </SlideUp>

                    {/* Search & Filter */}
                    <FadeIn delay={0.2}>
                        <div className="relative z-30 bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-12">
                            {/* First row: Search and primary filters */}
                            <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
                                <div className="flex-1 w-full">
                                    <Input
                                        placeholder="Search events..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-black/40 border-white/10 h-[42px]"
                                        leftIcon={
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        }
                                    />
                                </div>
                                <div className="flex gap-3 w-full md:w-auto flex-wrap">
                                    <div className="w-[calc(50%-6px)] md:w-36">
                                        <Select
                                            value={selectedCategory}
                                            onChange={setSelectedCategory}
                                            options={categories}
                                            placeholder="Category"
                                        />
                                    </div>
                                    <div className="w-[calc(50%-6px)] md:w-32">
                                        <Select
                                            value={selectedSort}
                                            onChange={setSelectedSort}
                                            options={sortOptions}
                                            placeholder="Sort by"
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Second row: Additional filters */}
                            <div className="flex flex-wrap gap-3 items-center">
                                {/* Ticket Type Filter (Free/Paid) */}
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-sm hidden md:inline">Ticket:</span>
                                    <div className="flex rounded-full bg-white/5 border border-white/10 overflow-hidden">
                                        {ticketTypeOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setSelectedTicketType(option.value)}
                                                className={`px-3 py-1.5 text-xs font-medium transition-all ${selectedTicketType === option.value
                                                    ? 'bg-violet-500 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Date Filter */}
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-sm hidden md:inline">When:</span>
                                    <div className="flex rounded-full bg-white/5 border border-white/10 overflow-hidden">
                                        {dateFilterOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setSelectedDateFilter(option.value)}
                                                className={`px-3 py-1.5 text-xs font-medium transition-all ${selectedDateFilter === option.value
                                                    ? 'bg-violet-500 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Reset button */}
                                {isFiltered && (
                                    <Button variant="ghost" onClick={resetFilters} className="text-violet-400 whitespace-nowrap text-sm ml-auto">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Reset
                                    </Button>
                                )}
                            </div>
                        </div>
                    </FadeIn>

                    {/* Loading */}
                    {isLoading && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                                >
                                    <EventCardSkeleton />
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Sections */}
                    {!isLoading && !isFiltered && (
                        <>
                            <Section title="Upcoming Events" data={sections.upcoming} sort="upcoming" />
                            <Section title="Top Events" data={sections.top} sort="top" />
                            <Section title="Recently Added" data={sections.latest} sort="latest" />

                            {/* CTA */}
                            <FadeIn>
                                <div className="my-20 rounded-3xl border border-white/10 bg-black/70 backdrop-blur-sm p-8 md:p-12 text-center">
                                    <SlideUp>
                                        <h2 className="text-3xl font-bold text-white mb-4">Host Your Own Event</h2>
                                        <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                                            Create events, sell tickets, and connect with your audience.
                                        </p>
                                        <Link href="/create/event">
                                            <Button size="lg" className="bg-white text-black hover:bg-gray-200 font-bold px-8">
                                                Create Event
                                            </Button>
                                        </Link>
                                    </SlideUp>
                                </div>
                            </FadeIn>

                            {/* Near You - Commented out for now
                            <FadeIn>
                                <div className="mb-16">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-2xl font-bold text-white relative pl-4">
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full"></span>
                                            Near You
                                        </h2>
                                    </div>
                                    {location ? (
                                        sections.nearby && sections.nearby.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                {sections.nearby.map((event, index) => (
                                                    <EventCard key={event._id} event={event} index={index} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 border border-white/5 rounded-2xl bg-white/5">
                                                <p className="text-gray-400">No events found near your location.</p>
                                            </div>
                                        )
                                    ) : (
                                        <SlideUp>
                                            <div className="flex flex-col items-center py-16 border border-white/10 rounded-2xl bg-gradient-to-b from-white/5 to-transparent text-center">
                                                <div className="w-16 h-16 bg-violet-500/20 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-xl font-bold text-white mb-2">Find Events Nearby</h3>
                                                <p className="text-gray-400 max-w-md mb-6">Enable location to discover events around you.</p>
                                                <Button onClick={handleEnableLocation} variant="violet">Enable Location</Button>
                                            </div>
                                        </SlideUp>
                                    )}
                                </div>
                            </FadeIn>
                            */}
                        </>
                    )}

                    {/* Filtered Grid */}
                    {!isLoading && isFiltered && (
                        <>
                            <div className="mb-4">
                                <p className="text-gray-400 text-sm">
                                    Showing {gridData.length} events
                                    {selectedSort !== defaultSort && ` • Sorted by ${sortOptions.find(o => o.value === selectedSort)?.label}`}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {gridData.map((event) => (
                                    <EventCard key={event._id} event={event} />
                                ))}
                            </div>

                            {hasMore && (
                                <div ref={loadMoreRef} className="flex justify-center py-8">
                                    {isLoadingMore && (
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
                                    )}
                                </div>
                            )}

                            {gridData.length === 0 && (
                                <div className="text-center py-20 text-gray-500">
                                    <p className="text-xl mb-4">No events found</p>
                                    <Button variant="ghost" className="text-violet-400" onClick={resetFilters}>Reset Filters</Button>
                                </div>
                            )}

                            {!hasMore && gridData.length > 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <p>You've seen all events</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
