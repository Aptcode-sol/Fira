import type { MetadataRoute } from 'next';
import { SITE_URL, API_BASE_URL } from '@/lib/siteConfig';
import { fetchListedCities } from '@/lib/seo/listedCities';

// Regenerate the sitemap once an hour so newly published events and venues get
// picked up without a redeploy.
export const revalidate = 3600;

interface SitemapDoc {
    _id: string;
    updatedAt?: string;
    createdAt?: string;
}

/**
 * Fetch a listing endpoint for sitemap entries. The sitemap must never break a
 * build, so any failure (API down, cold start, bad shape) degrades to an empty
 * list and we still ship the static routes.
 */
async function fetchDocs(path: string, key: string): Promise<SitemapDoc[]> {
    try {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            next: { revalidate },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];

        const data = await res.json();
        const docs = Array.isArray(data) ? data : data?.[key];
        return Array.isArray(docs) ? docs : [];
    } catch {
        return [];
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const staticRoutes: MetadataRoute.Sitemap = [
        { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
        { url: `${SITE_URL}/events`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
        { url: `${SITE_URL}/venues`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
        { url: `${SITE_URL}/brands`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/creators`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/events/weekend`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
        { url: `${SITE_URL}/events/ready-to-go`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
        { url: `${SITE_URL}/venue-portal/landing`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
        // The brand entity page - what search engines read to learn what
        // "FIRA" actually is. High priority despite being a static page.
        { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
        { url: `${SITE_URL}/help`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
        { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${SITE_URL}/refund-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${SITE_URL}/community-guidelines`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    ];

    // City landing pages. These are the realistic organic-traffic surface -
    // "events in mumbai", "banquet halls in hyderabad" - so they rank just
    // below the main listings in priority.
    //
    // Taken from the cities that have listings, matching what the city pages
    // actually render. Submitting a URL that 404s (a listed-nowhere city) is a
    // crawl error on every fetch, so the two must come from one source.
    const listedCities = await fetchListedCities();
    const cityRoutes: MetadataRoute.Sitemap = listedCities.flatMap(city => [
        {
            url: `${SITE_URL}/events/in/${city.slug}`,
            lastModified: now,
            changeFrequency: 'daily' as const,
            priority: 0.85,
        },
        {
            url: `${SITE_URL}/venues/in/${city.slug}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.85,
        },
    ]);

    const [events, venues, brands] = await Promise.all([
        fetchDocs('/events?eventType=public&status=upcoming&limit=500', 'events'),
        fetchDocs('/venues?status=approved&limit=500', 'venues'),
        fetchDocs('/brands?limit=500', 'brands'),
    ]);

    const toEntry = (prefix: string, doc: SitemapDoc, priority: number): MetadataRoute.Sitemap[number] => ({
        url: `${SITE_URL}${prefix}/${doc._id}`,
        lastModified: doc.updatedAt || doc.createdAt ? new Date(doc.updatedAt || doc.createdAt!) : now,
        changeFrequency: 'weekly',
        priority,
    });

    return [
        ...staticRoutes,
        ...cityRoutes,
        ...events.map(doc => toEntry('/events', doc, 0.8)),
        ...venues.map(doc => toEntry('/venues', doc, 0.8)),
        ...brands.map(doc => toEntry('/brands', doc, 0.5)),
    ];
}
