'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import VenueCard from '@/components/VenueCard';
import CitySelector from '@/components/CitySelector';
import { VenueCardSkeleton, Input, Button, FilterPanel } from '@/components/ui';
import type { FilterGroup } from '@/components/ui';
import { venuesApi } from '@/lib/api';
import { Venue, isVenueOwner } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';
import { useCities } from '@/hooks/useCities';
import { useUserCity } from '@/hooks/useUserCity';
import { CITIES, getCityByName } from '@/lib/cities';

const sortOptions = [
    { value: 'topRated', label: 'Top Rated' },
    { value: 'inDemand', label: 'In Demand' },
    { value: 'latest', label: 'Latest' },
    { value: 'priceAsc', label: 'Price: Low to High' },
    { value: 'priceDesc', label: 'Price: High to Low' },
    // LOCATION DISABLED - "Near You" needs GPS coordinates we no longer collect.
    // { value: 'nearby', label: 'Near You' },
];

const venueTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'banquet', label: 'Banquet' },
    { value: 'hall', label: 'Hall' },
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'club', label: 'Club' },
    { value: 'resort', label: 'Resort' },
    { value: 'farmhouse', label: 'Farmhouse' },
    { value: 'rooftop', label: 'Rooftop' },
    { value: 'garden', label: 'Garden' },
    { value: 'beach', label: 'Beach' },
];

const capacityOptions = [
    { value: 'all', label: 'Any Capacity' },
    { value: '50', label: 'Up to 50' },
    { value: '100', label: 'Up to 100' },
    { value: '200', label: 'Up to 200' },
    { value: '500', label: 'Up to 500' },
    { value: '1000', label: 'Up to 1000' },
];

const priceOptions = [
    { value: 'all', label: 'Any Price' },
    { value: '25000', label: 'Under ₹25K' },
    { value: '50000', label: 'Under ₹50K' },
    { value: '100000', label: 'Under ₹1L' },
    { value: '200000', label: 'Under ₹2L' },
];

interface VenuesResponse {
    venues: Venue[];
    totalPages: number;
    currentPage: number;
    total: number;
}

export default function VenuesPage() {
    // Owner-only Create-venue FAB visibility is driven solely by isVenueOwner
    // (Req 5.5): owner shown, non-owner and signed-out (user null) hidden.
    const { user } = useAuth();

    // Section data (for non-filtered view)
    // `nearby` is scoped to the visitor's city; the rest are nationwide - the
    // city leads the page rather than filtering all of it.
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
    const [selectedSort, setSelectedSort] = useState('topRated');

    // LOCATION DISABLED - we no longer ask the browser for GPS coordinates.
    // const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    // const [locationError, setLocationError] = useState(false);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const [showAllMode, setShowAllMode] = useState(false);

    // APPLIED filter state - the only thing that drives the list fetch. These
    // change exactly once per "Show results" submit (8.1), never per option
    // click, so the API is called once per apply rather than on every keystroke
    // inside the filter panel.
    const [selectedVenueType, setSelectedVenueType] = useState('all');
    const [selectedCapacity, setSelectedCapacity] = useState('all');
    const [selectedPrice, setSelectedPrice] = useState('all');
    const [availabilityDate, setAvailabilityDate] = useState('');

    // DRAFT filter state - what the panel controls edit while it is open. The
    // badge count and the pill/list highlights read from these, so selecting an
    // option feels instant, but nothing fetches until they are committed to the
    // applied state above on "Show results".
    const [draftSort, setDraftSort] = useState('topRated');
    const [draftVenueType, setDraftVenueType] = useState('all');
    const [draftCapacity, setDraftCapacity] = useState('all');
    const [draftPrice, setDraftPrice] = useState('all');
    const [draftDate, setDraftDate] = useState('');

    const cities = useCities();

    // CITY-FIRST: city scopes the whole catalogue rather than acting as one
    // filter among many. Seeded from ?city=, then the visitor's saved choice,
    // then their profile city - no location permission prompt anywhere.
    const { city: preferredCity, setCity: persistCity, isResolved: cityResolved } = useUserCity();
    const [selectedCity, setSelectedCity] = useState('');
    const [cityApplied, setCityApplied] = useState(false);

    useEffect(() => {
        if (cityApplied || !cityResolved) return;

        // Read ?city= straight off the URL rather than with useSearchParams().
        // That hook forces the whole page behind a Suspense boundary, which
        // makes Next prerender only the fallback spinner - so crawlers get an
        // empty page for /venues. This runs in an effect anyway, where
        // window.location is always available.
        const fromUrl = new URLSearchParams(window.location.search).get('city');
        const resolved = fromUrl
            ? getCityByName(fromUrl)?.name || fromUrl
            : preferredCity;

        if (resolved) setSelectedCity(resolved);
        setCityApplied(true);
    }, [cityApplied, cityResolved, preferredCity]);

    const changeCity = useCallback((city: string) => {
        setSelectedCity(city);
        persistCity(city);
        setPage(1);
        setGridData([]);
    }, [persistCity]);

    // `selectedCity` is deliberately absent: scoping to a city should not
    // collapse the curated sections into a flat grid - the sections are
    // fetched city-scoped instead.
    const isFiltered = showAllMode || searchQuery !== '' || selectedSort !== 'topRated' || selectedVenueType !== 'all' || selectedCapacity !== 'all' || selectedPrice !== 'all' || availabilityDate !== '';
    const defaultSort = 'topRated';

    // Reset filters. The city scope survives a reset - it is the visitor's
    // standing preference, not something they just toggled. Clears both the
    // draft (what the panel shows) and the applied state (what drives fetches).
    const resetFilters = () => {
        setSearchQuery('');
        setSelectedSort(defaultSort);
        setSelectedVenueType('all');
        setSelectedCapacity('all');
        setSelectedPrice('all');
        setAvailabilityDate('');
        setDraftSort(defaultSort);
        setDraftVenueType('all');
        setDraftCapacity('all');
        setDraftPrice('all');
        setDraftDate('');
        setShowAllMode(false);
        setPage(1);
        setGridData([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Commit the draft to applied state - the single point where a filter
    // change reaches the fetch effect, so "Show results" is the one thing that
    // triggers a list API call (8.1).
    const applyFilters = () => {
        setSelectedSort(draftSort);
        setSelectedVenueType(draftVenueType);
        setSelectedCapacity(draftCapacity);
        setSelectedPrice(draftPrice);
        setAvailabilityDate(draftDate);
    };

    // Every filter lives behind a single "Filters" control instead of a row of
    // dropdowns. The controls edit DRAFT state only; applyFilters() commits.
    const filterGroups: FilterGroup[] = [
        // City is intentionally NOT in here - it has its own always-visible
        // selector next to the search box (see CitySelector).
        {
            key: 'sort',
            label: 'Sort by',
            type: 'pills',
            options: sortOptions,
            value: draftSort,
            defaultValue: defaultSort,
            onChange: setDraftSort,
        },
        {
            key: 'venueType',
            label: 'Venue type',
            type: 'list',
            searchable: true,
            options: venueTypeOptions,
            value: draftVenueType,
            defaultValue: 'all',
            onChange: setDraftVenueType,
        },
        {
            key: 'capacity',
            label: 'Capacity',
            type: 'pills',
            options: capacityOptions,
            value: draftCapacity,
            defaultValue: 'all',
            onChange: setDraftCapacity,
        },
        {
            key: 'price',
            label: 'Budget',
            type: 'pills',
            options: priceOptions,
            value: draftPrice,
            defaultValue: 'all',
            onChange: setDraftPrice,
        },
        {
            key: 'availableOn',
            label: 'Available on',
            type: 'date',
            value: draftDate,
            defaultValue: '',
            minDate: new Date().toISOString().split('T')[0],
            onChange: setDraftDate,
            formatChip: (val) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        },
    ];

    // Fetch sections for homepage view, scoped to the selected city
    useEffect(() => {
        if (isFiltered) return;
        // Wait until the city preference is known, otherwise the first paint
        // fetches nationwide and then immediately refetches by city.
        if (!cityApplied) return;

        const fetchSections = async () => {
            setIsLoading(true);
            try {
                // LOCATION DISABLED - no geolocation prompt on page load
                // if (navigator.geolocation) {
                //     navigator.geolocation.getCurrentPosition(
                //         (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                //         () => setLocationError(true)
                //     );
                // }

                // Only the Near You request is city-scoped. Skipped entirely
                // when no city is known rather than firing a discarded request.
                const nearbyRequest = selectedCity
                    ? venuesApi.getAll({ city: selectedCity, status: 'approved', sort: 'topRated' }) as Promise<VenuesResponse>
                    : Promise.resolve<VenuesResponse>({ venues: [], totalPages: 0, currentPage: 1, total: 0 });

                const [nearbyRes, topRatedRes, inDemandRes, latestRes] = await Promise.all([
                    nearbyRequest,
                    venuesApi.getAll({ status: 'approved', sort: 'topRated' }) as Promise<VenuesResponse>,
                    venuesApi.getAll({ status: 'approved', sort: 'inDemand' }) as Promise<VenuesResponse>,
                    venuesApi.getAll({ status: 'approved', sort: 'latest' }) as Promise<VenuesResponse>,
                ]);

                setSections({
                    topRated: topRatedRes.venues || [],
                    inDemand: inDemandRes.venues || [],
                    latest: latestRes.venues || [],
                    nearby: nearbyRes.venues || []
                });
            } catch (error) {
                console.error('Failed to fetch venues:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSections();
    }, [isFiltered, selectedCity, cityApplied]);

    // LOCATION DISABLED - fetch nearby venues once coordinates are known
    // useEffect(() => {
    //     if (location && !isFiltered) {
    //         venuesApi.getNearby(location.lat, location.lng, 50000)
    //             .then((data) => {
    //                 const venues = Array.isArray(data) ? data : [];
    //                 setSections(prev => ({ ...prev, nearby: venues.slice(0, 4) }));
    //             })
    //             .catch(console.error);
    //     }
    // }, [location, isFiltered]);

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
            if (selectedCity) params.city = selectedCity;
            if (selectedVenueType !== 'all') params.venueType = selectedVenueType;
            if (selectedCapacity !== 'all') params.maxCapacity = selectedCapacity;
            if (selectedPrice !== 'all') params.maxPrice = selectedPrice;
            if (availabilityDate) params.availableOn = availabilityDate;

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
    }, [searchQuery, selectedCity, selectedSort, selectedVenueType, selectedCapacity, selectedPrice, availabilityDate]);

    // Fetch when filters change
    useEffect(() => {
        if (isFiltered) {
            setPage(1);
            const timeout = setTimeout(() => fetchFiltered(1, false), 300);
            return () => clearTimeout(timeout);
        }
    }, [searchQuery, selectedCity, selectedSort, selectedVenueType, selectedCapacity, selectedPrice, isFiltered, fetchFiltered]);

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
        setDraftSort(sort); // keep the panel in sync with the applied sort
        setSearchQuery('');
        setShowAllMode(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // LOCATION DISABLED - browser geolocation prompt
    // const handleEnableLocation = () => {
    //     if (!navigator.geolocation) return;
    //     navigator.geolocation.getCurrentPosition(
    //         (pos) => {
    //             setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    //             setLocationError(false);
    //         },
    //         () => {
    //             setLocationError(true);
    //             alert('Please enable location services in your browser settings.');
    //         }
    //     );
    // };

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
                    {/* Header - names the city so the page states what it
                        actually shows, for visitors and crawlers alike. */}
                    <SlideUp>
                        <div className="text-center mb-12">
                            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6">
                                {/* Generic on purpose: the sections below are
                                    nationwide, with the city surfaced as the
                                    "Near You" block rather than as a filter on
                                    the whole page. */}
                                Discover <span className="text-violet-400">Venues</span>
                            </h1>
                            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                                Find the perfect space for your next event. From intimate gatherings to grand celebrations.
                            </p>
                        </div>
                    </SlideUp>

                    {/* Search & Filter Bar */}
                    <FadeIn delay={0.2}>
                        <div className="relative z-30 bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-12 shadow-2xl">
                            {/* Search + a single Filters entry point */}
                            <div className="flex flex-col md:flex-row gap-3 md:items-center">
                                <div className="flex-1 w-full">
                                    <Input
                                        placeholder="Search venues, locations, amenities..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-black/40 border-white/10 focus:bg-black/60 h-[42px] w-full"
                                        leftIcon={
                                            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        }
                                    />
                                </div>

                                {/* City and Filters share one line, half each,
                                    on mobile - they used to stack onto two rows. */}
                                <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-3">
                                    <CitySelector
                                        value={selectedCity}
                                        onChange={changeCity}
                                        available={cities}
                                        className="w-full md:w-44"
                                    />

                                    <FilterPanel
                                        groups={filterGroups}
                                        onReset={resetFilters}
                                        onApply={applyFilters}
                                        className="w-full md:w-auto"
                                    />
                                </div>

                                {isFiltered && (
                                    <Button
                                        variant="ghost"
                                        onClick={resetFilters}
                                        className="text-violet-400 hover:text-violet-300 text-sm whitespace-nowrap shrink-0 md:ml-auto"
                                    >
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Reset Filters
                                    </Button>
                                )}
                            </div>
                        </div>
                    </FadeIn>

                    {/* Loading State */}
                    {isLoading && (
                        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
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
                            {/* Near You leads when the visitor's city has
                                venues. Section returns null for an empty list,
                                so a city with nothing simply drops the block -
                                no empty state, no dead space. */}
                            <Section
                                title={selectedCity ? `Near You in ${selectedCity}` : 'Near You'}
                                data={sections.nearby}
                            />

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
                                            <p className="text-gray-300 mb-8 max-w-xl mx-auto text-lg">
                                                Partner with us and reach thousands of event organizers.
                                            </p>
                                            <Link href="/signin">
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
                                                <p className="text-gray-300">No venues found near your location.</p>
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
                                                <p className="text-gray-300 max-w-md mb-6">
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
                                <p className="text-gray-300 text-sm">
                                    Showing {gridData.length} venues
                                    {selectedSort !== defaultSort && ` • Sorted by ${sortOptions.find(o => o.value === selectedSort)?.label}`}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
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
                                <div className="text-center py-20 text-gray-300">
                                    <p className="text-xl mb-4">
                                        No venues found matching your criteria
                                        {selectedCity ? ` in ${selectedCity}` : ''}
                                    </p>
                                    <div className="flex flex-wrap gap-3 justify-center">
                                        <Button variant="ghost" className="text-violet-400 hover:text-violet-300" onClick={resetFilters}>
                                            Reset Filters
                                        </Button>
                                        {selectedCity && (
                                            <Button variant="ghost" className="text-violet-400 hover:text-violet-300" onClick={() => changeCity('')}>
                                                Search all cities
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* End of results */}
                            {!hasMore && gridData.length > 0 && (
                                <div className="text-center py-8 text-gray-300">
                                    <p>You&apos;ve seen all venues</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Crawlable links into the city cluster. These give search
                        engines a path to every city landing page from the main
                        listing, and let visitors jump straight to a city. */}
                    <nav aria-label="Venues by city" className="mt-20 pt-10 border-t border-white/5">
                        <h2 className="text-sm font-semibold text-gray-300 mb-4">Browse venues by city</h2>
                        <div className="flex flex-wrap gap-2">
                            {CITIES.map(city => (
                                <Link
                                    key={city.slug}
                                    href={`/venues/in/${city.slug}`}
                                    className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs hover:text-white hover:border-white/20 transition-all"
                                >
                                    Venues in {city.name}
                                </Link>
                            ))}
                        </div>
                    </nav>
                </div>
            </main>

            {/* Owner-only Create-venue FAB. Visibility is driven solely by
                isVenueOwner(user) (Req 5.5) — owner shown; non-owner and
                signed-out hidden. Rendering as a <Link> anchor makes it
                keyboard-focusable/activatable with aria-label as its
                accessible name (Req 5.6). The server Owner_Gate remains the
                real authority; this only decides what to show. */}
            {isVenueOwner(user) && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="fixed bottom-24 md:bottom-8 right-6 z-50"
                >
                    <Link
                        href="/venue-portal/venues/create"
                        aria-label="Create a new venue"
                        className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-lg shadow-violet-500/25 flex items-center justify-center transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                    </Link>
                </motion.div>
            )}
        </>
    );
}
