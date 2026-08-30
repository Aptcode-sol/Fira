import type { Venue } from '@/lib/types';
import { getVenue } from '@/lib/seo/data';
import VenueDetailClient from './VenueDetailClient';

/**
 * Server shell for the venue detail page. Same reasoning as the event page: the whole
 * page was a client component fetching on mount, so a crawler received the navbar, the
 * footer and two skeletons - the same ~450 characters on every venue URL, with the
 * name and city present only in <title> and JSON-LD.
 *
 * Venues are the larger share of the "Discovered - currently not indexed" set, because
 * the sitemap carries many venue URLs and only the few events that pass the public
 * filter.
 *
 * `getVenue` is the request-cached read already used by generateMetadata and the Place
 * schema in layout.tsx, so this adds no round trip.
 */
export default async function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const venue = await getVenue(id);

    return <VenueDetailClient initialVenue={(venue as Venue | null) ?? null} />;
}
