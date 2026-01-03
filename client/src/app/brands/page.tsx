'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import BrandCard from '@/components/BrandCard';
import { Button, Input, Select } from '@/components/ui';
import { brandsApi } from '@/lib/api';
import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';

// Interfaces
interface Brand {
    _id: string;
    name: string;
    type: string;
    bio: string;
    coverPhoto?: string;
    profilePhoto?: string;
    stats: { followers: number; events: number };
    user?: { _id: string; name: string };
}

interface BrandsResponse {
    brands: Brand[];
    totalPages: number;
    currentPage: number;
    total: number;
}

const filterOptions = [
    { value: 'All', label: 'All Types' },
    { value: 'Brand', label: 'Brands' },
    { value: 'Band', label: 'Bands' },
    { value: 'Organizer', label: 'Organizers' },
];

const sortOptions = [
    { value: 'recommended', label: 'Recommended' },
    { value: 'trending', label: 'Trending' },
    { value: 'top', label: 'Top Rated' },
    { value: 'nearby', label: 'Nearby' },
];

export default function BrandsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('All');
    const [selectedSort, setSelectedSort] = useState('recommended');
    const [isLoading, setIsLoading] = useState(true);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState(false);

    const [sections, setSections] = useState<{
        bands: Brand[];
        brands: Brand[];
        organizers: Brand[];
        trending: Brand[];
        top: Brand[];
        nearby: Brand[];
    }>({
        bands: [],
        brands: [],
        organizers: [],
        trending: [],
        top: [],
        nearby: []
    });

    const [gridData, setGridData] = useState<Brand[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const isFiltered = searchQuery !== '' || selectedType !== 'All' || selectedSort !== 'recommended';
    const defaultSort = 'recommended';

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedType('All');
        setSelectedSort(defaultSort);
        setPage(1);
        setGridData([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };



    // Scroll helpers
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSeeAll = (type: string, sort?: string) => {
        if (type) setSelectedType(type);
        if (sort) setSelectedSort(sort);
        scrollToTop();
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
                alert('Please enable location services in your browser settings to see nearby brands.');
            }
        );
    };

    // Fetch initial data
    useEffect(() => {
        // Only fetch initial sections if not filtered (optimization)
        if (isFiltered) return;

        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        () => {
                            console.log('Location permission denied/unavailable');
                            setLocationError(true);
                        }
                    );
                } else {
                    setLocationError(true);
                }

                const [bandsRes, brandsRes, orgRes, trendingRes, topRes] = await Promise.all([
                    brandsApi.getAll({ type: 'Band', limit: '4' }) as Promise<BrandsResponse>,
                    brandsApi.getAll({ type: 'Brand', limit: '4' }) as Promise<BrandsResponse>,
                    brandsApi.getAll({ type: 'Organizer', limit: '4' }) as Promise<BrandsResponse>,
                    brandsApi.getAll({ sort: 'trending', limit: '4' }) as Promise<BrandsResponse>,
                    brandsApi.getAll({ sort: 'top', limit: '4' }) as Promise<BrandsResponse>,
                ]);

                setSections({
                    bands: bandsRes.brands,
                    brands: brandsRes.brands,
                    organizers: orgRes.brands,
                    trending: trendingRes.brands,
                    top: topRes.brands,
                    nearby: []
                });
            } catch (error) {
                console.error('Failed to fetch brands:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []); // Run once on mount

    // Fetch nearby specifically when location is available and not filtered
    useEffect(() => {
        if (location && !isFiltered) {
            (brandsApi.getAll({
                sort: 'nearby',
                lat: location.lat.toString(),
                lng: location.lng.toString(),
                limit: '4'
            }) as Promise<BrandsResponse>).then(res => {
                setSections(prev => ({ ...prev, nearby: res.brands }));
            }).catch(console.error);
        }
    }, [location, isFiltered]);

    // Fetch filtered data
    useEffect(() => {
        if (isFiltered) {
            const fetchFiltered = async () => {
                setIsLoading(true);
                try {
                    const params: any = {
                        search: searchQuery,
                        limit: '20'
                    };

                    if (selectedType !== 'All') params.type = selectedType;

                    if (selectedSort !== 'recommended') {
                        params.sort = selectedSort;
                        if (selectedSort === 'nearby') {
                            if (location) {
                                params.lat = location.lat.toString();
                                params.lng = location.lng.toString();
                            } else {
                                // Fallback if location not available but sort requested
                                console.warn('Location needed for nearby sort');
                            }
                        }
                    }

                    const res = await brandsApi.getAll(params) as BrandsResponse;
                    setGridData(res.brands);
                    setHasMore(res.currentPage < res.totalPages);
                } catch (error) {
                    console.error('Error fetching filtered brands:', error);
                } finally {
                    setIsLoading(false);
                }
            };

            const timeoutId = setTimeout(fetchFiltered, 300);
            return () => clearTimeout(timeoutId);
        }
    }, [searchQuery, selectedType, selectedSort, isFiltered, location]);

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

    // Load more on page change
    useEffect(() => {
        if (page > 1 && isFiltered) {
            const loadMore = async () => {
                setIsLoadingMore(true);
                try {
                    const params: any = {
                        search: searchQuery,
                        limit: '20',
                        page: page.toString()
                    };
                    if (selectedType !== 'All') params.type = selectedType;
                    if (selectedSort !== 'recommended') params.sort = selectedSort;

                    const res = await brandsApi.getAll(params) as BrandsResponse;
                    setGridData(prev => [...prev, ...res.brands]);
                    setHasMore(res.currentPage < res.totalPages);
                } catch (error) {
                    console.error('Error loading more:', error);
                } finally {
                    setIsLoadingMore(false);
                }
            };
            loadMore();
        }
    }, [page, isFiltered, searchQuery, selectedType, selectedSort]);

    const Section = ({ title, data, type, sort }: { title: string, data: any[], type?: string, sort?: string }) => {
        if (!data || data.length === 0) return null;

        return (
            <FadeIn>
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl md:text-2xl font-bold text-white relative pl-4">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 md:h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full"></span>
                            {title}
                        </h2>
                        <Button
                            variant="ghost"
                            className="text-gray-400 hover:text-white text-sm"
                            onClick={() => handleSeeAll(type || (selectedType === 'All' ? 'All' : selectedType), sort)}
                        >
                            See All
                        </Button>
                    </div>
                    {/* Horizontal scroll container */}
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                        {data.map((brand, index) => (
                            <div key={brand._id} className="flex-shrink-0 w-[280px] md:w-[300px] snap-start">
                                <BrandCard brand={brand} index={index} />
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
                                Verified Brands & <span className="text-violet-400">Bands</span>
                            </h1>
                            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                                Discover verified event organizers, bands, and brands.
                            </p>
                        </div>
                    </SlideUp>

                    {/* Sticky Search & Filter */}
                    <FadeIn delay={0.2}>
                        <div className="relative z-30 bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-12 shadow-2xl transition-all">
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 w-full">
                                    <Input
                                        placeholder="Search brands, bands, organizers..."
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
                                    <div className="w-full md:w-48">
                                        <Select
                                            value={selectedType}
                                            onChange={setSelectedType}
                                            options={filterOptions}
                                            placeholder="Filter by Type"
                                            icon={
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                                </svg>
                                            }
                                        />
                                    </div>
                                    <div className="w-full md:w-48">
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

                    {isLoading && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                                    className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden"
                                >
                                    <div className="h-[200px] bg-white/[0.05] animate-pulse" />
                                    <div className="p-5">
                                        <div className="flex justify-between mb-2">
                                            <div className="h-5 w-32 bg-white/[0.05] rounded animate-pulse" />
                                            <div className="h-5 w-16 bg-white/[0.05] rounded-full animate-pulse" />
                                        </div>
                                        <div className="h-4 w-3/4 bg-white/[0.05] rounded animate-pulse mb-3" />
                                        <div className="h-10 w-full bg-white/[0.05] rounded-full animate-pulse" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {!isLoading && !isFiltered && (
                        <>
                            <Section title="Popular Bands" data={sections.bands} type="Band" />
                            <Section title="Featured Brands" data={sections.brands} type="Brand" />
                            <Section title="Top Organizers" data={sections.organizers} type="Organizer" />

                            {/* CTA Section */}
                            <FadeIn>
                                <div className="my-20 relative overflow-hidden rounded-3xl border border-white/10 bg-black/70 backdrop-blur-sm p-8 md:p-12 text-center group">
                                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
                                    <SlideUp>
                                        <div className="relative z-10">
                                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                                Are you a Brand, Band, or Organizer?
                                            </h2>
                                            <p className="text-gray-400 mb-8 max-w-xl mx-auto text-lg">
                                                Get verified, build your profile, and connect with thousands of fans. Access exclusive tools to manage your events.
                                            </p>
                                            <Link href="/create/brand">
                                                <Button size="lg" className="bg-white text-black hover:bg-gray-200 font-bold px-8">
                                                    Apply for Verification
                                                </Button>
                                            </Link>
                                        </div>
                                    </SlideUp>
                                </div>
                            </FadeIn>

                            <Section title="Trending Now" data={sections.trending} sort="trending" />
                            <Section title="Top Rated" data={sections.top} sort="top" />

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
                                                onClick={() => handleSeeAll(selectedType, 'nearby')}
                                            >
                                                See All
                                            </Button>
                                        )}
                                    </div>

                                    {location ? (
                                        sections.nearby.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                {sections.nearby.map((brand, index) => (
                                                    <BrandCard key={brand._id} brand={brand} index={index} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 border border-white/5 rounded-2xl bg-white/5">
                                                <p className="text-gray-400">No brands found near your location.</p>
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
                                                <h3 className="text-xl font-bold text-white mb-2">Locate Brands Nearby</h3>
                                                <p className="text-gray-400 max-w-md mb-6">
                                                    Enable location access to discover bands, brands, and organizers happening around you.
                                                </p>
                                                <Button
                                                    onClick={handleEnableLocation}
                                                    variant="violet"
                                                >
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

                    {!isLoading && isFiltered && (
                        <>
                            <div className="mb-4">
                                <p className="text-gray-400 text-sm">
                                    Showing {gridData.length} results
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {gridData.map((brand) => (
                                    <BrandCard key={brand._id} brand={brand} />
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
                                    <p className="text-xl mb-4">No results found</p>
                                    <Button variant="ghost" className="text-violet-400" onClick={resetFilters}>
                                        Reset Filters
                                    </Button>
                                </div>
                            )}

                            {!hasMore && gridData.length > 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <p>You've seen all results</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
