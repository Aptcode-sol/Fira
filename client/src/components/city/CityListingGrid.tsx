'use client';

import EventCard from '@/components/EventCard';
import VenueCard from '@/components/VenueCard';
import type { Event, Venue } from '@/lib/types';

/**
 * Renders server-fetched city results using the existing cards.
 *
 * The cards depend on framer-motion so they have to sit behind a client
 * boundary, but the data is fetched on the server and passed down as props -
 * so Next still server-renders the full grid into the HTML and crawlers see
 * every event and venue without executing any JavaScript.
 */
export function CityEventsGrid({ events }: { events: Event[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {events.map((event, index) => (
                <EventCard key={event._id} event={event} index={index} />
            ))}
        </div>
    );
}

export function CityVenuesGrid({ venues }: { venues: Venue[] }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {venues.map((venue, index) => (
                <VenueCard key={venue._id} venue={venue} index={index} />
            ))}
        </div>
    );
}
