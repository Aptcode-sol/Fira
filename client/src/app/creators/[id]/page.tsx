import { getCreator } from '@/lib/seo/data';
import CreatorProfileClient from './CreatorProfileClient';

/**
 * Server shell for the creator profile. Same fix as the event and venue detail pages:
 * the page was a client component that fetched on mount, so a crawler received 423
 * characters of navbar and footer - byte-identical across all 22 profiles in the
 * sitemap, with the creator's name present only in <title> and JSON-LD.
 *
 * `getCreator` is the request-cached read already used by generateMetadata and the
 * entity schema in layout.tsx, so this adds no round trip.
 */
export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const creator = await getCreator(id);

    return <CreatorProfileClient initialBrand={creator ?? null} />;
}
