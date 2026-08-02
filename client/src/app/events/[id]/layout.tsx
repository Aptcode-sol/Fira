import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/siteConfig';
import { getEvent, clampText, eventCity } from '@/lib/seo/data';
import { eventSchema } from '@/lib/seo/entitySchema';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/jsonLd';

/**
 * Event pages are the long-tail search surface - "<event name> tickets",
 * "<category> in <city> this weekend" - so each one gets its own title,
 * description, OG image and Event rich-result markup rather than inheriting
 * the generic site defaults.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const event = await getEvent(id);

    if (!event?.name) {
        return {
            title: 'Event',
            alternates: { canonical: `/events/${id}` },
            robots: { index: false, follow: true },
        };
    }

    const city = eventCity(event);
    const title = city ? `${event.name} in ${city}` : event.name;
    const price =
        event.ticketType === 'free'
            ? 'Free entry'
            : event.ticketPrice
                ? `Tickets from ₹${event.ticketPrice}`
                : 'Book tickets';
    const description = event.description
        ? clampText(event.description, 155)
        : clampText(`${price} for ${event.name}${city ? ` in ${city}` : ''} on ${SITE_NAME}.`, 155);
    const image = event.images?.[0];

    // Private, cancelled and unapproved events must not enter the index.
    const isIndexable =
        event.eventType !== 'private' &&
        event.status !== 'cancelled' &&
        event.status !== 'draft' &&
        event.status !== 'rejected' &&
        event.status !== 'blocked';

    return {
        title,
        description,
        alternates: { canonical: `/events/${id}` },
        robots: isIndexable ? undefined : { index: false, follow: false },
        openGraph: {
            title: `${title} | ${SITE_NAME}`,
            description,
            url: `/events/${id}`,
            type: 'website',
            images: image ? [{ url: image, alt: event.name }] : undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title: `${title} | ${SITE_NAME}`,
            description,
            images: image ? [image] : undefined,
        },
    };
}

export default async function EventDetailLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const event = await getEvent(id);

    // Only mark up events a crawler is allowed to see in the first place.
    const showSchema = Boolean(event?.name) && event?.eventType !== 'private';
    const city = event ? eventCity(event) : undefined;

    return (
        <>
            {showSchema && event && (
                <>
                    <JsonLd data={eventSchema(event, id)} />
                    <JsonLd
                        data={breadcrumbSchema([
                            { name: 'Home', path: '/' },
                            { name: 'Events', path: '/events' },
                            ...(city ? [{ name: city, path: `/events/in/${city.toLowerCase()}` }] : []),
                            { name: event.name!, path: `/events/${id}` },
                        ])}
                    />
                </>
            )}
            {children}
        </>
    );
}
