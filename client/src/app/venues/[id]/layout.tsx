import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/siteConfig';
import { getVenue, clampText } from '@/lib/seo/data';
import { venueSchema } from '@/lib/seo/entitySchema';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/jsonLd';

/**
 * "<Venue> in <City>" is the phrasing people actually search for, so it leads
 * the title. Each venue also emits EventVenue markup with address, capacity,
 * price range and (only when genuine) an aggregate rating.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const venue = await getVenue(id);

    if (!venue?.name) {
        return {
            title: 'Venue',
            alternates: { canonical: `/venues/${id}` },
            robots: { index: false, follow: true },
        };
    }

    const city = venue.address?.city;
    const title = city ? `${venue.name} in ${city}` : venue.name;
    const capacity = venue.capacity?.max;
    const price = venue.pricing?.basePrice;

    const fallback =
        `Book ${venue.name}${city ? `, ${city}` : ''} on ${SITE_NAME}` +
        `${capacity ? ` - up to ${capacity} guests` : ''}` +
        `${price ? `, from ₹${price.toLocaleString('en-IN')}` : ''}. Check availability and pricing.`;

    const description = venue.description ? clampText(venue.description, 155) : clampText(fallback, 155);
    const image = venue.images?.[0];

    return {
        title,
        description,
        alternates: { canonical: `/venues/${id}` },
        openGraph: {
            title: `${title} | ${SITE_NAME}`,
            description,
            url: `/venues/${id}`,
            type: 'website',
            images: image ? [{ url: image, alt: venue.name }] : undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title: `${title} | ${SITE_NAME}`,
            description,
            images: image ? [image] : undefined,
        },
    };
}

export default async function VenueDetailLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const venue = await getVenue(id);
    const city = venue?.address?.city;

    return (
        <>
            {venue?.name && (
                <>
                    <JsonLd data={venueSchema(venue, id)} />
                    <JsonLd
                        data={breadcrumbSchema([
                            { name: 'Home', path: '/' },
                            { name: 'Venues', path: '/venues' },
                            ...(city ? [{ name: city, path: `/venues/in/${city.toLowerCase()}` }] : []),
                            { name: venue.name, path: `/venues/${id}` },
                        ])}
                    />
                </>
            )}
            {children}
        </>
    );
}
