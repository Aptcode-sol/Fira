'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import VenueCard from '@/components/VenueCard';
import { VenueCardSkeleton, Input, Button, Select } from '@/components/ui';
import { venuesApi } from '@/lib/api';
import { Venue } from '@/lib/types';
import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';

const cities = [
    { value: 'All', label: 'All Cities' },
    { value: 'Mumbai', label: 'Mumbai' },
    { value: 'Delhi', label: 'Delhi' },
    { value: 'Bangalore', label: 'Bangalore' },
    { value: 'Chennai', label: 'Chennai' },
    { value: 'Hyderabad', label: 'Hyderabad' },
    { value: 'Pune', label: 'Pune' },
    { value: 'Kolkata', label: 'Kolkata' },
    { value: 'North Goa', label: 'Goa' },
];

const sortOptions = [
    { value: 'topRated', label: 'Top Rated' },
    { value: 'inDemand', label: 'In Demand' },
    { value: 'latest', label: 'Latest' },
    { value: 'nearby', label: 'Near You' },
];

interface VenuesResponse {
    venues: Venue[];
    totalPages: number;
    currentPage: number;
    total: number;
}

export default function VenuesPage() {
    // Section data (for non-filtered view)
    const [sections, setSections] = useState<{
        topRated: Venue[];
        inDemand: Venue[];
        latest: Venue[];
        nearby: Venue[];
    }>({
        topRated: [],
        inDemand: [],
        latest: [],
        nearby: []
    });

    // Filtered/paginated data
    const [gridData, setGridData] = useState<Venue[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCity, setSelectedCity] = useState('All');
    const [selectedSort, setSelectedSort] = useState('topRated');
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState(false);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const [showAllMode, setShowAllMode] = useState(false);

    const isFiltered = showAllMode || searchQuery !== '' || selectedCity !== 'All' || selectedSort !== 'topRated';
    const defaultSort = 'topRated';

    // Reset filters
    const resetFilters = () => {
        setSearchQuery('');
        setSelectedCity('All');
        setSelectedSort(defaultSort);
        setShowAllMode(false);
        setPage(1);
        setGridData([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Fetch sections for homepage view
    useEffect(() => {
        if (isFiltered) return;

        const fetchSections = async () => {
            setIsLoading(true);
            try {
                // Request location
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        () => setLocationError(true)
                    );
                }

                const [topRatedRes, inDemandRes, latestRes] = await Promise.all([
                    venuesApi.getAll({ status: 'approved', sort: 'topRated', limit: '4' }) as Promise<VenuesResponse>,
                    venuesApi.getAll({ status: 'approved', sort: 'inDemand', limit: '4' }) as Promise<VenuesResponse>,
                    venuesApi.getAll({ status: 'approved', sort: 'latest', limit: '4' }) as Promise<VenuesResponse>,
                ]);

                setSections({
                    topRated: topRatedRes.venues || [],
                    inDemand: inDemandRes.venues || [],
                    latest: latestRes.venues || [],
                    nearby: []
                });
            } catch (error) {
                console.error('Failed to fetch venues:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSections();
    }, [isFiltered]);

    // Fetch nearby when location becomes available
    useEffect(() => {
        if (location && !isFiltered) {
            venuesApi.getNearby(location.lat, location.lng, 50000)
                .then((data) => {
                    const venues = Array.isArray(data) ? data : [];
                    setSections(prev => ({ ...prev, nearby: venues.slice(0, 4) }));
                })
                .catch(console.error);
        }
    }, [location, isFiltered]);

    // Fetch filtered/paginated data
    const fetchFiltered = useCallback(async (pageNum: number, append: boolean = false) => {
        if (pageNum === 1) setIsLoading(true);
        else setIsLoadingMore(true);

        try {
            const params: Record<string, string> = {
                status: 'approved',
                page: pageNum.toString(),
                limit: '12',
                sort: selectedSort,
            };
            if (searchQuery) params.search = searchQuery;
            if (selectedCity !== 'All') params.city = selectedCity;

            const res = await venuesApi.getAll(params) as VenuesResponse;
            const newVenues = res.venues || [];

            if (append) {
                setGridData(prev => [...prev, ...newVenues]);
            } else {
                setGridData(newVenues);
            }

            setHasMore(res.currentPage < res.totalPages);
        } catch (error) {
            console.error('Failed to fetch venues:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [searchQuery, selectedCity, selectedSort]);

    // Fetch when filters change
    useEffect(() => {
        if (isFiltered) {
            setPage(1);
            const timeout = setTimeout(() => fetchFiltered(1, false), 300);
            return () => clearTimeout(timeout);
        }
    }, [searchQuery, selectedCity, selectedSort, isFiltered, fetchFiltered]);

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
        setSearchQuery('');
        setSelectedCity('All');
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
                alert('Please enable location services in your browser settings.');
            }
        );
    };

    const Section = ({ title, data, sort }: { title: string; data: Venue[]; sort?: string }) => {
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
                        {data.map((venue, index) => (
                            <div key={venue._id} className="flex-shrink-0 w-[280px] md:w-[300px] snap-start">
                                <VenueCard venue={venue} index={index} />
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
                                Discover <span className="text-violet-400">Venues</span>
                            </h1>
                            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                                Find the perfect space for your next event. From intimate gatherings to grand celebrations.
                            </p>
                        </div>
                    </SlideUp>

                    {/* Search & Filter Bar */}
                    <FadeIn delay={0.2}>
                        <div className="relative z-30 bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-12 shadow-2xl">
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 w-full">
                                    <Input
                                        placeholder="Search venues, locations, amenities..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-black/40 border-white/10 focus:bg-black/60 h-[42px]"
                                        leftIcon={
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        }
                                    />
                                </div>
                                <div className="flex gap-4 w-full md:w-auto">
                                    <div className="w-full md:w-40">
                                        <Select
                                            value={selectedCity}
                                            onChange={setSelectedCity}
                                            options={cities}
                                            placeholder="City"
                                            icon={
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                </svg>
                                            }
                                        />
                                    </div>
                                    <div className="w-full md:w-40">
                                        <Select
                                            value={selectedSort}
                                            onChange={setSelectedSort}
                                            options={sortOptions}
                                            placeholder="Sort by"
                                            icon={
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                                </svg>
                                            }
                                        />
                                    </div>
                                    {isFiltered && (
                                        <Button
                                            variant="ghost"
                                            onClick={resetFilters}
                                            className="text-violet-400 hover:text-violet-300 whitespace-nowrap"
                                        >
                                            Reset
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </FadeIn>

                    {/* Loading State */}
                    {isLoading && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                                >
                                    <VenueCardSkeleton />
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Section View (not filtered) */}
                    {!isLoading && !isFiltered && (
                        <>
                            <Section title="Top Rated" data={sections.topRated} sort="topRated" />
                            <Section title="In Demand" data={sections.inDemand} sort="inDemand" />
                            <Section title="Recently Added" data={sections.latest} sort="latest" />

                            {/* CTA Section */}
                            <FadeIn>
                                <div className="my-20 relative overflow-hidden rounded-3xl border border-white/10 bg-black/70 backdrop-blur-sm p-8 md:p-12 text-center">
                                    <SlideUp>
                                        <div className="relative z-10">
                                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                                Looking to list a venue?
                                            </h2>
                                            <p className="text-gray-400 mb-8 max-w-xl mx-auto text-lg">
                                                Partner with us and reach thousands of event organizers.
                                            </p>
                                            <Link href="/create/venue">
                                                <Button size="lg" className="bg-white text-black hover:bg-gray-200 font-bold px-8">
                                                    List Your Venue
                                                </Button>
                                            </Link>
                                        </div>
                                    </SlideUp>
                                </div>
                            </FadeIn>

                            {/* Near You Section - Commented out for now
                            <FadeIn>
                                <div className="mb-16">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-2xl font-bold text-white relative pl-4">
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full"></span>
                                            Near You
                                        </h2>
                                        {location && (
                                            <Button
                                                variant="ghost"
                                                className="text-gray-400 hover:text-white text-sm"
                                                onClick={() => handleSeeAll('nearby')}
                                            >
                                                See All
                                            </Button>
                                        )}
                                    </div>

                                    {location ? (
                                        sections.nearby.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                {sections.nearby.map((venue, index) => (
                                                    <VenueCard key={venue._id} venue={venue} index={index} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 border border-white/5 rounded-2xl bg-white/5">
                                                <p className="text-gray-400">No venues found near your location.</p>
                                            </div>
                                        )
                                    ) : (
                                        <SlideUp>
                                            <div className="flex flex-col items-center justify-center py-16 border border-white/10 rounded-2xl bg-gradient-to-b from-white/5 to-transparent text-center">
                                                <div className="w-16 h-16 bg-violet-500/20 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-xl font-bold text-white mb-2">Locate Venues Nearby</h3>
                                                <p className="text-gray-400 max-w-md mb-6">
                                                    Enable location access to discover venues near you.
                                                </p>
                                                <Button onClick={handleEnableLocation} variant="violet">
                                                    Enable Location
                                                </Button>
                                            </div>
                                        </SlideUp>
                                    )}
                                </div>
                            </FadeIn>
                            */}
                        </>
                    )}

                    {/* Filtered Grid View with Infinite Scroll */}
                    {!isLoading && isFiltered && (
                        <>
                            <div className="mb-4 flex items-center justify-between">
                                <p className="text-gray-400 text-sm">
                                    Showing {gridData.length} venues
                                    {selectedSort !== defaultSort && ` • Sorted by ${sortOptions.find(o => o.value === selectedSort)?.label}`}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {gridData.map((venue) => (
                                    <VenueCard key={venue._id} venue={venue} />
                                ))}
                            </div>

                            {/* Load more trigger */}
                            {hasMore && (
                                <div ref={loadMoreRef} className="flex justify-center py-8">
                                    {isLoadingMore && (
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
                                    )}
                                </div>
                            )}

                            {/* No results */}
                            {gridData.length === 0 && (
                                <div className="text-center py-20 text-gray-500">
                                    <p className="text-xl mb-4">No venues found matching your criteria</p>
                                    <Button variant="ghost" className="text-violet-400 hover:text-violet-300" onClick={resetFilters}>
                                        Reset Filters
                                    </Button>
                                </div>
                            )}

                            {/* End of results */}
                            {!hasMore && gridData.length > 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <p>You've seen all venues</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
