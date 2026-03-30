'use client';

import { useState } from 'react';
import Hero from '@/components/Hero';
import FollowingFeedSection from '@/components/FollowingFeedSection';
import ReadyToGoSection from '@/components/ReadyToGoSection';
import WeekendEventsSection from '@/components/WeekendEventsSection';
import LocationFilter from '@/components/LocationFilter';
import FeaturedVenues from '@/components/FeaturedVenues';
import CreatePartySection from '@/components/CreatePartySection';
import BrandBandSection from '@/components/BrandBandSection';
import VenueOwnerSection from '@/components/VenueOwnerSection';
import CTASection from '@/components/CTASection';

export default function HomeClient() {
    const [cityFilter, setCityFilter] = useState('');

    return (
        <>
            <Hero />

            <div className="relative z-20 max-w-7xl mx-auto px-4 pt-8 pb-4">
                {/* Global Location filter — searchable city dropdown */}
                <div className="mb-8 flex justify-end">
                    <LocationFilter selectedCity={cityFilter} onCityChange={setCityFilter} />
                </div>

                {/* Following feed — from brands you follow (logged-in users only) */}
                <FollowingFeedSection cityFilter={cityFilter} />

                {/* Ready to Go — today's events */}
                <ReadyToGoSection cityFilter={cityFilter} />

                {/* Weekend Events — Sat & Sun */}
                <WeekendEventsSection cityFilter={cityFilter} />

                {/* Featured Venues */}
                <FeaturedVenues cityFilter={cityFilter} />
            </div>

            <CreatePartySection />
            <BrandBandSection />
            <VenueOwnerSection />
            <CTASection />
        </>
    );
}
