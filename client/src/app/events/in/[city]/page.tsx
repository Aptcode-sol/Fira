import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { CityEventsGrid } from '@/components/city/CityListingGrid';
import { fetchListedCities, getListedCity, otherListedCities } from '@/lib/seo/listedCities';
import { getEventsByCity } from '@/lib/seo/data';
import { SITE_NAME } from '@/lib/siteConfig';
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/lib/seo/jsonLd';
import type { Event } from '@/lib/types';

/**
 * City landing pages. "party venues in hyderabad" and "events in mumbai this
 * weekend" are queries with real volume that a new brand can actually win -
 * unlike the bare word "fira", which is dominated by Fira de Barcelona and
 * Fira, Santorini. These pages are the realistic path to organic traffic.
 *
 * They are statically generated at build time and revalidated hourly, so a
 * crawler always gets fully-rendered HTML with real listings in it.
 */
export const revalidate = 3600;

/**
 * Pre-render the cities that have listings today. A city onboarded tomorrow gets
 * rendered on first request and cached from then on, so no deploy is needed.
 */
export async function generateStaticParams() {
    const cities = await fetchListedCities();
    return cities.map(city => ({ city: city.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ city: string }>;
}): Promise<Metadata> {
    const { city: slug } = await params;
    const city = await getListedCity(slug);

    if (!city) {
        return { title: 'City not found', robots: { index: false, follow: false } };
    }

    const title = `Events in ${city.city} - Parties, Concerts & Festivals`;
    const description =
        `Find events happening in ${city.city} right now. Browse parties, concerts, DJ nights, ` +
        `festivals and live music across ${city.city}, ${city.state} - compare ticket prices and book on ${SITE_NAME}.`;

    return {
        title,
        description,
        keywords: [
            `events in ${city.city}`,
            `parties in ${city.city}`,
            `concerts in ${city.city}`,
            `things to do in ${city.city}`,
            `${city.city} nightlife`,
            `event tickets ${city.city}`,
        ],
        // The slug is canonical even when reached through an alias like
        // /events/in/bengaluru, so aliases never compete with the real page.
        alternates: { canonical: `/events/in/${city.slug}` },
        openGraph: {
            title: `${title} | ${SITE_NAME}`,
            description,
            url: `/events/in/${city.slug}`,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${title} | ${SITE_NAME}`,
            description,
        },
    };
}

export default async function EventsInCityPage({
    params,
}: {
    params: Promise<{ city: string }>;
}) {
    const { city: slug } = await params;
    const city = await getListedCity(slug);

    // Nothing listed here. 404 rather than render, so an arbitrary slug cannot
    // mint an empty page for the index.
    if (!city) notFound();

    // Filtered by slug, not by display name: the same value the listing carries.
    const events = await getEventsByCity(city.slug, 24);
    const otherCities = await otherListedCities(city.slug);

    const faqs = [
        {
            q: `What events are happening in ${city.city} this weekend?`,
            a: `${SITE_NAME} lists parties, concerts, DJ nights and festivals happening across ${city.city}. Use the "This Weekend" filter on the events page to see everything scheduled for the coming Saturday and Sunday.`,
        },
        {
            q: `How do I book event tickets in ${city.city}?`,
            a: `Open any event on this page, choose your ticket type and pay online. Your ticket and QR code are emailed to you immediately and are also available in your ${SITE_NAME} dashboard.`,
        },
        {
            q: `Are there free events in ${city.city}?`,
            a: `Yes. Many events in ${city.city} are free to attend. Filter by ticket type "Free" on the events page to see only those.`,
        },
        {
            q: `Can I host my own event in ${city.city}?`,
            a: `You can. Browse verified venues in ${city.city}, send a booking request to the venue owner, and once it is approved you can publish your event and start selling tickets on ${SITE_NAME}.`,
        },
    ];

    return (
        <>
            <JsonLd
                data={breadcrumbSchema([
                    { name: 'Home', path: '/' },
                    { name: 'Events', path: '/events' },
                    { name: city.city, path: `/events/in/${city.slug}` },
                ])}
            />
            {events.length > 0 && (
                <JsonLd
                    data={itemListSchema(
                        `Events in ${city.city}`,
                        `/events/in/${city.slug}`,
                        events.map(e => ({ name: e.name || 'Event', path: `/events/${e._id}` }))
                    )}
                />
            )}
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'FAQPage',
                    mainEntity: faqs.map(faq => ({
                        '@type': 'Question',
                        name: faq.q,
                        acceptedAnswer: { '@type': 'Answer', text: faq.a },
                    })),
                }}
            />

            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-7xl mx-auto">
                    {/* Visible breadcrumb trail - matches the markup above and
                        gives crawlers an internal link back up the hierarchy. */}
                    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-300">
                        <ol className="flex flex-wrap items-center gap-2">
                            <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                            <li aria-hidden="true">/</li>
                            <li><Link href="/events" className="hover:text-white transition-colors">Events</Link></li>
                            <li aria-hidden="true">/</li>
                            <li className="text-gray-300">{city.city}</li>
                        </ol>
                    </nav>

                    <header className="mb-10">
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                            Events in <span className="text-violet-400">{city.city}</span>
                        </h1>
                        <p className="text-gray-300 text-lg max-w-3xl leading-relaxed">
                            Everything happening in {city.city}, {city.state} - parties, live concerts,
                            DJ nights, festivals and community meetups. Browse what is on, compare
                            ticket prices, and book in a couple of taps. New events are added by
                            organisers across {city.city} every week.
                        </p>
                    </header>

                    {events.length > 0 ? (
                        <>
                            <h2 className="text-xl md:text-2xl font-bold text-white mb-5 relative pl-4">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 md:h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full" />
                                Upcoming events in {city.city}
                            </h2>
                            <CityEventsGrid events={events as unknown as Event[]} />

                            <div className="mt-10">
                                <Link
                                    href={`/events?city=${encodeURIComponent(city.city)}`}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Browse all events in {city.city}
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                            <h2 className="text-xl font-bold text-white mb-2">
                                No events listed in {city.city} yet
                            </h2>
                            <p className="text-gray-300 mb-6 max-w-xl mx-auto">
                                We are just getting started here. Be the first to host something in {city.city},
                                or browse events in a nearby city.
                            </p>
                            <div className="flex flex-wrap gap-3 justify-center">
                                <Link
                                    href="/create/event"
                                    className="px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Host an event
                                </Link>
                                <Link
                                    href="/events"
                                    className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
                                >
                                    All events
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Cross-link to the matching venues page - keeps a visitor
                        who wants to *host* rather than attend on the site. */}
                    <section className="mt-16 rounded-2xl border border-white/10 bg-black/50 p-8">
                        <h2 className="text-2xl font-bold text-white mb-3">
                            Hosting something in {city.city}?
                        </h2>
                        <p className="text-gray-300 mb-6 max-w-2xl">
                            Browse verified banquet halls, rooftops, clubs and farmhouses in {city.city}.
                            Compare capacity and pricing, check availability, and send a booking request
                            to the owner directly.
                        </p>
                        <Link
                            href={`/venues/in/${city.slug}`}
                            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-semibold"
                        >
                            See venues in {city.city} →
                        </Link>
                    </section>

                    {/* FAQ block. Real on-page text, and it backs the FAQPage
                        markup above so the answers can surface in the SERP. */}
                    <section className="mt-16">
                        <h2 className="text-2xl font-bold text-white mb-6">
                            Events in {city.city}: common questions
                        </h2>
                        <div className="space-y-4">
                            {faqs.map(faq => (
                                <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                                    <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                                    <p className="text-gray-300 leading-relaxed">{faq.a}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Internal linking between city pages - this is what lets
                        crawl equity flow across the whole city cluster. */}
                    <section className="mt-16">
                        <h2 className="text-lg font-bold text-white mb-4">Events in other cities</h2>
                        <div className="flex flex-wrap gap-2">
                            {otherCities.map(other => (
                                <Link
                                    key={other.slug}
                                    href={`/events/in/${other.slug}`}
                                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm hover:text-white hover:border-white/20 transition-all"
                                >
                                    Events in {other.city}
                                </Link>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
