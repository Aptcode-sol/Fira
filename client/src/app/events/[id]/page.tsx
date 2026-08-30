import type { Event } from '@/lib/types';
import { getEvent } from '@/lib/seo/data';
import EventDetailClient from './EventDetailClient';

/**
 * Server shell for the event detail page.
 *
 * The whole page used to be a client component that fetched on mount, so the HTML
 * served to a crawler was the navbar, the footer and two loading skeletons - about 450
 * characters, byte-identical for every event on the site. The name, date, venue and
 * price were present only in <title> and JSON-LD, never in the body. Search Console
 * read that as 42 URLs "Discovered - currently not indexed", 4 "Crawled - currently
 * not indexed", and one where it chose its own canonical because two event pages
 * looked like the same document.
 *
 * `getEvent` is the same request-cached read that already feeds generateMetadata and
 * the Event schema in layout.tsx, so handing it to the client component costs no extra
 * round trip - it just means the first paint (and the crawl) contains the real
 * content. The client still refetches on mount for viewer-specific fields.
 *
 * ponytail: seed-and-refetch rather than a full server/client split of a 1100-line
 * page. Ceiling: the seeded document is the anonymous view, so anything gated on the
 * viewer appears one tick later. Upgrade path is passing the authed read down too,
 * once there is a server-side session to read it with.
 */
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const event = await getEvent(id);

    // SeoEvent is a loose view of the same API document the client type describes.
    return <EventDetailClient initialEvent={(event as Event | null) ?? null} />;
}
