import { API_BASE_URL } from '@/lib/siteConfig';

/**
 * The cities that actually have listings, read at build/revalidate time.
 *
 * Replaces a hardcoded list of 15. That list decided which /events/in/<city>
 * and /venues/in/<city> pages existed, which meant the pages were fixed at
 * deploy time while the listings were not: a venue onboarded in Vellore had no
 * city page, and a city on the list with nothing in it shipped an empty page.
 * Now the listings decide, and the answer updates on its own.
 */

export interface ListedCity {
    /** Canonical slug - the URL segment and the value the API filters on. */
    slug: string;
    /** Display spelling. */
    city: string;
    state: string;
    venues: number;
    events: number;
}

/** Matches the revalidate window on the pages that use this. */
const REVALIDATE_SECONDS = 3600;

/**
 * Never throws. A city page or the sitemap failing the build because the API was
 * cold is a worse outcome than briefly generating no city pages, which the next
 * revalidate fixes by itself.
 */
export async function fetchListedCities(): Promise<ListedCity[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/locations/listed`, {
            next: { revalidate: REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.cities) ? data.cities : [];
    } catch {
        return [];
    }
}

/**
 * One city by slug, or undefined when nothing is listed there.
 *
 * Undefined is the signal to 404. Rendering a page for any slug someone types
 * would put unlimited empty pages in the index, which reads as thin content and
 * costs the real city pages their standing.
 */
export async function getListedCity(slug: string): Promise<ListedCity | undefined> {
    const cities = await fetchListedCities();
    return cities.find(c => c.slug === slug);
}

/** The rest, for the cross-linking block at the foot of a city page. */
export async function otherListedCities(slug: string, limit = 12): Promise<ListedCity[]> {
    const cities = await fetchListedCities();
    return cities.filter(c => c.slug !== slug).slice(0, limit);
}

/** Busiest cities first. Used where only a handful of links fit. */
export function byActivity(cities: ListedCity[]): ListedCity[] {
    return [...cities].sort((a, b) => (b.venues + b.events) - (a.venues + a.events));
}
