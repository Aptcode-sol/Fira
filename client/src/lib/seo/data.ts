import { cache } from 'react';

/**
 * Server-side reads used by generateMetadata and JSON-LD. These run on the
 * server only, so they use plain fetch rather than lib/api.ts (which reaches
 * for localStorage).
 *
 * Wrapped in React `cache` so a page that needs the same document for both its
 * metadata and its structured data fetches it once per request.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface SeoAddress {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
}

export interface SeoVenue {
    _id?: string;
    name?: string;
    description?: string;
    images?: string[];
    venueType?: string;
    address?: SeoAddress;
    capacity?: { min?: number; max?: number };
    pricing?: { basePrice?: number; currency?: string };
    rating?: { average?: number; count?: number };
    amenities?: string[];
    location?: { coordinates?: number[] };
    updatedAt?: string;
    createdAt?: string;
}

export interface SeoEvent {
    _id?: string;
    name?: string;
    description?: string;
    images?: string[];
    startDateTime?: string;
    endDateTime?: string;
    eventType?: string;
    ticketType?: string;
    ticketPrice?: number;
    category?: string;
    status?: string;
    maxAttendees?: number;
    currentAttendees?: number;
    tags?: string[];
    venue?: SeoVenue;
    customVenue?: {
        isCustom?: boolean;
        name?: string;
        address?: string;
        city?: string;
        state?: string;
        pincode?: string;
    };
    organizer?: {
        _id?: string;
        name?: string;
        avatar?: string;
        /** 'brand' | 'band' | 'organizer' | 'none' - set when they run a creator page. */
        verificationBadge?: string;
    };
    updatedAt?: string;
    createdAt?: string;
}

/** Never let a slow or down API break a page render - degrade to null. */
async function getJson<T>(path: string, revalidate = 600): Promise<T | null> {
    try {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            next: { revalidate },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

export const getEvent = cache(async (id: string): Promise<SeoEvent | null> => {
    const data = await getJson<{ event?: SeoEvent } & SeoEvent>(`/events/${id}`);
    if (!data) return null;
    return data.event ?? data;
});

export const getVenue = cache(async (id: string): Promise<SeoVenue | null> => {
    const data = await getJson<{ venue?: SeoVenue } & SeoVenue>(`/venues/${id}`);
    if (!data) return null;
    return data.venue ?? data;
});

export const getEventsByCity = cache(async (city: string, limit = 24): Promise<SeoEvent[]> => {
    const data = await getJson<{ events?: SeoEvent[] }>(
        `/events?eventType=public&status=upcoming&sort=upcoming&city=${encodeURIComponent(city)}&limit=${limit}`,
        900
    );
    return data?.events ?? [];
});

export const getVenuesByCity = cache(async (city: string, limit = 24): Promise<SeoVenue[]> => {
    const data = await getJson<{ venues?: SeoVenue[] }>(
        `/venues?status=approved&sort=topRated&city=${encodeURIComponent(city)}&limit=${limit}`,
        900
    );
    return data?.venues ?? [];
});

/** Collapse whitespace and cut to a length that survives the SERP snippet. */
export function clampText(text: string, max: number): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** City of an event, whether it uses a listed venue or a custom one. */
export function eventCity(event: SeoEvent): string | undefined {
    return event.venue?.address?.city || event.customVenue?.city || undefined;
}
