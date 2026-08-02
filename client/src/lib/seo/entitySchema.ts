import { SITE_URL, SITE_NAME, absoluteUrl } from '@/lib/siteConfig';
import type { SeoEvent, SeoVenue, SeoAddress } from './data';
import { clampText } from './data';

/* eslint-disable @typescript-eslint/no-explicit-any */

function postalAddress(address?: SeoAddress) {
    if (!address) return undefined;
    return {
        '@type': 'PostalAddress',
        ...(address.street ? { streetAddress: address.street } : {}),
        ...(address.city ? { addressLocality: address.city } : {}),
        ...(address.state ? { addressRegion: address.state } : {}),
        ...(address.pincode ? { postalCode: address.pincode } : {}),
        addressCountry: address.country || 'IN',
    };
}

function geo(venue?: SeoVenue) {
    const coords = venue?.location?.coordinates;
    // GeoJSON is [lng, lat]. Skip the placeholder [0,0] and anything malformed.
    if (!coords || coords.length !== 2) return undefined;
    const [lng, lat] = coords;
    if (!lat || !lng) return undefined;
    return { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
}

/**
 * schema.org/Event - the markup behind Google's event rich results and the
 * "Events" carousel. Requires name, startDate and a location at minimum;
 * offers and images are what actually earn the enhanced treatment.
 */
export function eventSchema(event: SeoEvent, id: string) {
    const url = absoluteUrl(`/events/${id}`);
    const venue = event.venue;
    const custom = event.customVenue;

    const location = venue?.name
        ? {
            '@type': 'Place',
            name: venue.name,
            address: postalAddress(venue.address),
            ...(geo(venue) ? { geo: geo(venue) } : {}),
        }
        : custom?.name || custom?.city
            ? {
                '@type': 'Place',
                name: custom.name || 'Event venue',
                address: {
                    '@type': 'PostalAddress',
                    ...(custom.address ? { streetAddress: custom.address } : {}),
                    ...(custom.city ? { addressLocality: custom.city } : {}),
                    ...(custom.state ? { addressRegion: custom.state } : {}),
                    ...(custom.pincode ? { postalCode: custom.pincode } : {}),
                    addressCountry: 'IN',
                },
            }
            : undefined;

    const isSoldOut =
        typeof event.maxAttendees === 'number' &&
        typeof event.currentAttendees === 'number' &&
        event.currentAttendees >= event.maxAttendees;

    const offers = {
        '@type': 'Offer',
        url,
        price: event.ticketType === 'free' ? 0 : event.ticketPrice ?? 0,
        priceCurrency: 'INR',
        availability: isSoldOut
            ? 'https://schema.org/SoldOut'
            : 'https://schema.org/InStock',
        ...(event.createdAt ? { validFrom: event.createdAt } : {}),
    };

    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        '@id': `${url}#event`,
        name: event.name,
        url,
        ...(event.description ? { description: clampText(event.description, 500) } : {}),
        ...(event.images?.length ? { image: event.images.slice(0, 5) } : {}),
        ...(event.startDateTime ? { startDate: event.startDateTime } : {}),
        ...(event.endDateTime ? { endDate: event.endDateTime } : {}),
        eventStatus:
            event.status === 'cancelled'
                ? 'https://schema.org/EventCancelled'
                : 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        ...(location ? { location } : {}),
        offers,
        ...(event.organizer?.name
            ? { organizer: { '@type': 'Organization', name: event.organizer.name } }
            : {}),
        ...(typeof event.maxAttendees === 'number'
            ? { maximumAttendeeCapacity: event.maxAttendees }
            : {}),
        ...(event.tags?.length ? { keywords: event.tags.join(', ') } : {}),
        isAccessibleForFree: event.ticketType === 'free',
        inLanguage: 'en-IN',
        publisher: { '@id': `${SITE_URL}/#organization` },
    };
}

/**
 * schema.org/EventVenue - a bookable place. AggregateRating is only emitted
 * when real reviews exist; inventing one is a manual-action risk.
 */
export function venueSchema(venue: SeoVenue, id: string) {
    const url = absoluteUrl(`/venues/${id}`);
    const hasRatings = (venue.rating?.count ?? 0) > 0 && (venue.rating?.average ?? 0) > 0;

    return {
        '@context': 'https://schema.org',
        '@type': 'EventVenue',
        '@id': `${url}#venue`,
        name: venue.name,
        url,
        ...(venue.description ? { description: clampText(venue.description, 500) } : {}),
        ...(venue.images?.length ? { image: venue.images.slice(0, 5) } : {}),
        ...(postalAddress(venue.address) ? { address: postalAddress(venue.address) } : {}),
        ...(geo(venue) ? { geo: geo(venue) } : {}),
        ...(typeof venue.capacity?.max === 'number'
            ? { maximumAttendeeCapacity: venue.capacity.max }
            : {}),
        ...(venue.amenities?.length
            ? {
                amenityFeature: venue.amenities.slice(0, 20).map(name => ({
                    '@type': 'LocationFeatureSpecification',
                    name,
                    value: true,
                })),
            }
            : {}),
        ...(typeof venue.pricing?.basePrice === 'number'
            ? {
                priceRange: `₹${venue.pricing.basePrice.toLocaleString('en-IN')}+`,
                makesOffer: {
                    '@type': 'Offer',
                    url,
                    price: venue.pricing.basePrice,
                    priceCurrency: venue.pricing.currency || 'INR',
                    availability: 'https://schema.org/InStock',
                },
            }
            : {}),
        ...(hasRatings
            ? {
                aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: venue.rating!.average,
                    reviewCount: venue.rating!.count,
                    bestRating: 5,
                    worstRating: 1,
                },
            }
            : {}),
        isAccessibleForFree: false,
        publisher: { '@id': `${SITE_URL}/#organization` },
        provider: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    };
}
