'use client';

import Hero from '@/components/Hero';
// FOLLOWING FEED DISABLED - commented out for now
// import FollowingFeedSection from '@/components/FollowingFeedSection';
import ReadyToGoSection from '@/components/ReadyToGoSection';
// WEEKEND EVENTS DISABLED - commented out for now
// import WeekendEventsSection from '@/components/WeekendEventsSection';
// CITY FILTER DISABLED - commented out for now. City filtering lives on
// /events and /venues, which is where people go looking for it.
// import LocationFilter from '@/components/LocationFilter';
// FEATURED VENUES DISABLED - commented out for now
// import FeaturedVenues from '@/components/FeaturedVenues';
// WHAT IS FIRA DISABLED - commented out for now
// import WhatIsFira from '@/components/WhatIsFira';
import CreatePartySection from '@/components/CreatePartySection';
import BrandBandSection from '@/components/BrandBandSection';
import VenueOwnerSection from '@/components/VenueOwnerSection';
import CTASection from '@/components/CTASection';

export default function HomeClient() {
    // The `cityFilter` state went with the LocationFilter above. The remaining
    // sections take an optional cityFilter, so omitting it shows all cities.
    return (
        <>
            <Hero />

            {/* WHAT IS FIRA DISABLED - commented out for now.
                Re-enable together with the import at the top of this file.
                The same explainer content still lives on /about.
            <WhatIsFira />
            */}

            <div className="relative z-20 max-w-7xl mx-auto px-4 pt-8 pb-4">
                {/* CITY FILTER DISABLED - commented out for now.
                    Restoring it means bringing back the `cityFilter` state above
                    and passing it to the sections below.
                <div className="mb-8 flex justify-end">
                    <LocationFilter selectedCity={cityFilter} onCityChange={setCityFilter} />
                </div>
                */}

                {/* FOLLOWING FEED DISABLED - commented out for now.
                    Re-enable together with the import at the top of this file.
                <FollowingFeedSection cityFilter={cityFilter} />
                */}

                {/* Ready to Go — today's events */}
                <ReadyToGoSection />

                {/* WEEKEND EVENTS DISABLED - commented out for now.
                    Re-enable together with the import at the top of this file.
                <WeekendEventsSection cityFilter={cityFilter} />
                */}

                {/* FEATURED VENUES DISABLED - commented out for now.
                    Re-enable together with the import at the top of this file.
                <FeaturedVenues cityFilter={cityFilter} />
                */}
            </div>

            <CreatePartySection />
            <BrandBandSection />
            <VenueOwnerSection />
            <CTASection />
        </>
    );
}
