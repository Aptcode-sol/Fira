import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/siteConfig';
import { getCreator, clampText } from '@/lib/seo/data';
import { creatorSchema } from '@/lib/seo/entitySchema';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/jsonLd';

/**
 * This layout exists because its absence was actively de-indexing every creator page.
 *
 * With no metadata of its own, /creators/<id> inherited the parent segment's
 * `alternates.canonical: '/creators'` - so each profile shipped
 * `<link rel="canonical" href="https://letsfira.com/creators">`, telling Google in as
 * many words that it is a duplicate of the listing page and should not be indexed
 * itself. That is Search Console's "Alternative page with proper canonical" and
 * "Duplicate, Google chose different canonical": not a crawl problem, an instruction we
 * were issuing. A canonical inherited from a parent route is almost never right for a
 * dynamic child.
 *
 * Everything else here mirrors the event and venue layouts: per-profile title,
 * description, OG image and entity markup.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const creator = await getCreator(id);

    if (!creator?.name) {
        return {
            title: 'Creator',
            alternates: { canonical: `/creators/${id}` },
            robots: { index: false, follow: true },
        };
    }

    const city = creator.primaryCity || creator.cities?.[0];
    const kind = creator.type ? creator.type.replace(/_/g, ' ') : 'creator';
    const title = city ? `${creator.name} - ${kind} in ${city}` : `${creator.name} - ${kind}`;
    const description = creator.bio
        ? clampText(creator.bio, 155)
        : clampText(
            `${creator.name} is a ${kind}${city ? ` based in ${city}` : ''} on ${SITE_NAME}. ` +
            `See upcoming events, follow for new shows, and enquire about your own event.`,
            155
        );
    const image = creator.coverPhoto || creator.profilePhoto;

    // Only approved profiles are publicly listed, so an unapproved one must not be
    // indexed either - the listing API already filters them out, which would otherwise
    // leave an indexed page with no route in from anywhere.
    const isIndexable = creator.status === 'approved';

    return {
        title,
        description,
        alternates: { canonical: `/creators/${id}` },
        robots: isIndexable ? undefined : { index: false, follow: false },
        openGraph: {
            title: `${title} | ${SITE_NAME}`,
            description,
            url: `/creators/${id}`,
            type: 'profile',
            ...(image ? { images: [{ url: image, alt: creator.name }] } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: `${title} | ${SITE_NAME}`,
            description,
            ...(image ? { images: [image] } : {}),
        },
    };
}

export default async function CreatorDetailLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const creator = await getCreator(id);
    const showSchema = Boolean(creator?.name) && creator?.status === 'approved';

    return (
        <>
            {showSchema && creator && (
                <>
                    <JsonLd data={creatorSchema(creator, id)} />
                    <JsonLd
                        data={breadcrumbSchema([
                            { name: 'Home', path: '/' },
                            { name: 'Creators', path: '/creators' },
                            { name: creator.name!, path: `/creators/${id}` },
                        ])}
                    />
                </>
            )}
            {children}
        </>
    );
}
