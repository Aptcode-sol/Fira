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
import { motion, AnimatePresence } from 'framer-motion';
import LocationFilter from '@/components/LocationFilter';

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
    { value: 'all', label: 'All Types' },
    { value: 'today', label: 'Today' },
    { value: 'popular', label: 'Popular' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'weekend', label: 'This Weekend' },
];

const ticketTypeOptions = [
    { value: 'all', label: 'All' },
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
        today: Event[];
        popular: Event[];
        upcoming: Event[];
        weekend: Event[];
    }>({
        today: [],
        popular: [],
        upcoming: [],
        weekend: []
    });

    // Filtered/paginated data
    const [gridData, setGridData] = useState<Event[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedSort, setSelectedSort] = useState('all'); // 'all' = sections view (default)
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState(false);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const [showAllMode, setShowAllMode] = useState(false);
    const [selectedTicketType, setSelectedTicketType] = useState('all');
    const [selectedDateFilter, setSelectedDateFilter] = useState('all');
    const [selectedCity, setSelectedCity] = useState('');

    const isFiltered = showAllMode || searchQuery !== '' || selectedCategory !== 'All' || selectedTicketType !== 'all' || selectedDateFilter !== 'all' || selectedCity !== '';
    const defaultSort = 'all';

    // Reset filters
    const resetFilters = () => {
        setSearchQuery('');
        setSelectedCategory('All');
        setSelectedSort('all');
        setSelectedTicketType('all');
        setSelectedDateFilter('all');
        setSelectedCity('');
        setShowAllMode(false);
        setPage(1);
        setGridData([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Active sort label for filtered grid header
    const activeSortLabel = sortOptions.find(o => o.value === selectedSort)?.label || '';

    // Fetch sections
    useEffect(() => {
        if (isFiltered) return;

        const fetchSections = async () => {
            setIsLoading(true);
            try {
                const [todayRes, popularRes, upcomingRes, weekendRes] = await Promise.all([
                    eventsApi.getAll({ eventType: 'public', dateFilter: 'today', sort: 'upcoming' }) as Promise<EventsResponse>,
                    eventsApi.getAll({ status: 'upcoming', eventType: 'public', sort: 'top' }) as Promise<EventsResponse>,
                    eventsApi.getAll({ status: 'upcoming', eventType: 'public', sort: 'upcoming' }) as Promise<EventsResponse>,
                    eventsApi.getAll({ eventType: 'public', weekend: 'true', sort: 'upcoming' }) as Promise<EventsResponse>,
                ]);

                setSections({
                    today: todayRes.events || [],
                    popular: popularRes.events || [],
                    upcoming: upcomingRes.events || [],
                    weekend: weekendRes.events || [],
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
            };
            if (searchQuery) params.search = searchQuery;
            if (selectedCategory !== 'All') params.category = selectedCategory;
            if (selectedTicketType !== 'all') params.ticketType = selectedTicketType;
            if (selectedCity) params.city = selectedCity;

            // Map section sort values to API params
            if (selectedSort === 'today') {
                params.dateFilter = 'today';
                params.sort = 'upcoming';
            } else if (selectedSort === 'popular') {
                params.sort = 'top';
                params.status = 'upcoming';
            } else if (selectedSort === 'upcoming') {
                params.sort = 'upcoming';
                params.status = 'upcoming';
            } else if (selectedSort === 'weekend') {
                params.weekend = 'true';
                params.sort = 'upcoming';
            } else {
                // 'all' or any other value — just show upcoming public events
                params.sort = 'upcoming';
                params.status = 'upcoming';
            }

            // Date filter row overrides
            if (selectedDateFilter === 'today') params.dateFilter = 'today';
            else if (selectedDateFilter === 'tomorrow') params.dateFilter = 'tomorrow';
            else if (selectedDateFilter === 'weekend') params.weekend = 'true';

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
    }, [searchQuery, selectedCategory, selectedSort, selectedTicketType, selectedDateFilter, selectedCity]);

    // Fetch when filters change
    useEffect(() => {
        if (isFiltered || showAllMode) {
            setPage(1);
            const timeout = setTimeout(() => fetchFiltered(1, false), 300);
            return () => clearTimeout(timeout);
        }
    }, [searchQuery, selectedCategory, selectedSort, selectedTicketType, selectedDateFilter, selectedCity, isFiltered, showAllMode, fetchFiltered]);

    // Infinite scroll observer
    useEffect(() => {
        if ((!isFiltered && !showAllMode) || !hasMore || isLoadingMore) return;

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
    }, [hasMore, isLoadingMore, isFiltered, showAllMode]);

    // Load more when page changes
    useEffect(() => {
        if (page > 1 && (isFiltered || showAllMode)) {
            fetchFiltered(page, true);
        }
    }, [page, isFiltered, showAllMode, fetchFiltered]);

    const handleSeeAll = (sort: string) => {
        setSelectedSort(sort);
        setSelectedCategory('All');
        setSearchQuery('');
        setSelectedTicketType('all');
        setSelectedDateFilter('all');
        setSelectedCity('');
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
                                            onChange={(val) => {
                                                setSelectedSort(val);
                                                if (val === 'all') {
                                                    setShowAllMode(false);
                                                    setGridData([]);
                                                } else {
                                                    setShowAllMode(true);
                                                }
                                            }}
                                            options={sortOptions}
                                            placeholder="Sort by"
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Second row: Additional filters */}
                            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 items-center w-full">
                                {/* Ticket Type Filter: Left on Mobile, Left on Desktop */}
                                <div className="col-span-1 md:w-auto flex items-center gap-2">
                                    <span className="text-gray-500 text-sm hidden md:inline">Ticket:</span>
                                    <div className="flex rounded-full bg-white/5 border border-white/10 overflow-hidden w-full md:w-auto">
                                        {ticketTypeOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setSelectedTicketType(option.value)}
                                                className={`px-3 py-1.5 text-xs font-medium transition-all flex-1 text-center md:flex-none ${selectedTicketType === option.value
                                                    ? 'bg-violet-500 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Location Filter: Right on Mobile, Far Right on Desktop */}
                                <div className="col-span-1 flex justify-end md:ml-auto md:order-last">
                                    <LocationFilter
                                        selectedCity={selectedCity}
                                        onCityChange={setSelectedCity}
                                        variant="select"
                                        className="w-full md:w-40"
                                    />
                                </div>

                                {/* Date Filter: Full width below on mobile, Middle on Desktop */}
                                <div className="col-span-2 w-full md:w-auto flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mb-1 md:pb-0 md:mb-0">
                                    <span className="text-gray-500 text-sm hidden md:inline shrink-0">When:</span>
                                    <div className="flex rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0">
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
                                    <Button variant="ghost" onClick={resetFilters} className="text-violet-400 whitespace-nowrap text-sm mt-2 md:mt-0 col-span-2 md:col-span-1 flex justify-center w-full md:w-auto md:order-last">
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
                    {!isLoading && !isFiltered && !showAllMode && (
                        <>
                            <Section title="Today" data={sections.today} sort="today" />
                            <Section title="Popular Events" data={sections.popular} sort="popular" />
                            <Section title="Upcoming Events" data={sections.upcoming} sort="upcoming" />
                            <Section title="This Weekend" data={sections.weekend} sort="weekend" />

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
                    {!isLoading && (isFiltered || showAllMode) && (
                        <>
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    {showAllMode && activeSortLabel && (
                                        <h2 className="text-xl md:text-2xl font-bold text-white relative pl-4 mb-1">
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 md:h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full"></span>
                                            {activeSortLabel === 'Today' ? 'Today' : activeSortLabel === 'Popular' ? 'Popular Events' : activeSortLabel === 'Upcoming' ? 'Upcoming Events' : 'This Weekend'}
                                        </h2>
                                    )}
                                    <p className="text-gray-400 text-sm">Showing {gridData.length} events</p>
                                </div>
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
