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
/**
 * Is this a city worth having a page for?
 *
 * The city list is built from address fields typed by venue owners and organisers, so
 * it carries whatever they typed. The live list currently includes a city named
 * "bokkaa" in a state called "midanaabadh", and one whose state is the literal string
 * "https://vwver". The sitemap has previously advertised /events/in/a,
 * /events/in/haiene, /events/in/narasa and /events/in/narasaraopet - every one of which
 * 404s now, because the listing behind it was edited or removed. Submitting URLs that
 * 404 is a crawl error on every fetch, and a page per typo is thin content that costs
 * the real city pages their standing.
 *
 * Exported and pure so it is checkable without a network call, and applied inside
 * fetchListedCities so the sitemap and the city page cannot apply different rules -
 * they were the two sides of the 404.
 *
 * Deliberately permissive: this rejects obvious noise, not unfamiliar places. Real
 * Indian city names it must keep include "Goa" (4 letters) and "Nellore Rural" (two
 * words). ponytail: a name/length heuristic, not a gazetteer. Ceiling: it cannot tell
 * "Bokkaa" from a real small town. The durable fix is validating the city field at
 * entry, against the same list the search box uses.
 */
export function isPublishableCity(city: ListedCity): boolean {
    const name = (city?.city || '').trim();
    const slug = (city?.slug || '').trim();
    if (!name || !slug) return false;
    // 'a' was a real entry. Two characters is below any Indian city name.
    if (name.length < 3) return false;
    // Letters, spaces, hyphens, apostrophes and dots only - excludes the entry whose
    // state field was a URL, and anything else pasted in by accident.
    //
    // `\p{M}` is not optional here. Indic scripts write vowels as combining marks, so
    // "बंगलौर" is Letter + Mark + Letter + Letter + Mark + Letter: a letters-only
    // pattern rejects every Devanagari, Telugu and Tamil spelling of a real city. On an
    // Indian product that is not an edge case.
    if (!/^[\p{L}][\p{L}\p{M}\s.'-]*$/u.test(name)) return false;
    // A city page with nothing on it is an empty page.
    return (city.venues ?? 0) + (city.events ?? 0) > 0;
}

export async function fetchListedCities(): Promise<ListedCity[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/locations/listed`, {
            next: { revalidate: REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data?.cities)) return [];
        return (data.cities as ListedCity[]).filter(isPublishableCity);
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
