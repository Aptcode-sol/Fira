import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { CityEventsGrid } from '@/components/city/CityListingGrid';
import { CITIES, getCityBySlug } from '@/lib/cities';
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

export function generateStaticParams() {
    return CITIES.map(city => ({ city: city.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ city: string }>;
}): Promise<Metadata> {
    const { city: slug } = await params;
    const city = getCityBySlug(slug);

    if (!city) {
        return { title: 'City not found', robots: { index: false, follow: false } };
    }

    const title = `Events in ${city.name} - Parties, Concerts & Festivals`;
    const description =
        `Find events happening in ${city.name} right now. Browse parties, concerts, DJ nights, ` +
        `festivals and live music across ${city.name}, ${city.state} - compare ticket prices and book on ${SITE_NAME}.`;

    return {
        title,
        description,
        keywords: [
            `events in ${city.name}`,
            `parties in ${city.name}`,
            `concerts in ${city.name}`,
            `things to do in ${city.name}`,
            `${city.name} nightlife`,
            `event tickets ${city.name}`,
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
    const city = getCityBySlug(slug);

    if (!city) notFound();

    const events = await getEventsByCity(city.name, 24);
    const otherCities = CITIES.filter(c => c.slug !== city.slug).slice(0, 12);

    const faqs = [
        {
            q: `What events are happening in ${city.name} this weekend?`,
            a: `${SITE_NAME} lists parties, concerts, DJ nights and festivals happening across ${city.name}. Use the "This Weekend" filter on the events page to see everything scheduled for the coming Saturday and Sunday.`,
        },
        {
            q: `How do I book event tickets in ${city.name}?`,
            a: `Open any event on this page, choose your ticket type and pay online. Your ticket and QR code are emailed to you immediately and are also available in your ${SITE_NAME} dashboard.`,
        },
        {
            q: `Are there free events in ${city.name}?`,
            a: `Yes. Many events in ${city.name} are free to attend. Filter by ticket type "Free" on the events page to see only those.`,
        },
        {
            q: `Can I host my own event in ${city.name}?`,
            a: `You can. Browse verified venues in ${city.name}, send a booking request to the venue owner, and once it is approved you can publish your event and start selling tickets on ${SITE_NAME}.`,
        },
    ];

    return (
        <>
            <JsonLd
                data={breadcrumbSchema([
                    { name: 'Home', path: '/' },
                    { name: 'Events', path: '/events' },
                    { name: city.name, path: `/events/in/${city.slug}` },
                ])}
            />
            {events.length > 0 && (
                <JsonLd
                    data={itemListSchema(
                        `Events in ${city.name}`,
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
                    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
                        <ol className="flex flex-wrap items-center gap-2">
                            <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                            <li aria-hidden="true">/</li>
                            <li><Link href="/events" className="hover:text-white transition-colors">Events</Link></li>
                            <li aria-hidden="true">/</li>
                            <li className="text-gray-300">{city.name}</li>
                        </ol>
                    </nav>

                    <header className="mb-10">
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                            Events in <span className="text-violet-400">{city.name}</span>
                        </h1>
                        <p className="text-gray-400 text-lg max-w-3xl leading-relaxed">
                            Everything happening in {city.name}, {city.state} - parties, live concerts,
                            DJ nights, festivals and community meetups. Browse what is on, compare
                            ticket prices, and book in a couple of taps. New events are added by
                            organisers across {city.name} every week.
                        </p>
                    </header>

                    {events.length > 0 ? (
                        <>
                            <h2 className="text-xl md:text-2xl font-bold text-white mb-5 relative pl-4">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 md:h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full" />
                                Upcoming events in {city.name}
                            </h2>
                            <CityEventsGrid events={events as unknown as Event[]} />

                            <div className="mt-10">
                                <Link
                                    href={`/events?city=${encodeURIComponent(city.name)}`}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Browse all events in {city.name}
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                            <h2 className="text-xl font-bold text-white mb-2">
                                No events listed in {city.name} yet
                            </h2>
                            <p className="text-gray-400 mb-6 max-w-xl mx-auto">
                                We are just getting started here. Be the first to host something in {city.name},
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
                            Hosting something in {city.name}?
                        </h2>
                        <p className="text-gray-400 mb-6 max-w-2xl">
                            Browse verified banquet halls, rooftops, clubs and farmhouses in {city.name}.
                            Compare capacity and pricing, check availability, and send a booking request
                            to the owner directly.
                        </p>
                        <Link
                            href={`/venues/in/${city.slug}`}
                            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-semibold"
                        >
                            See venues in {city.name} →
                        </Link>
                    </section>

                    {/* FAQ block. Real on-page text, and it backs the FAQPage
                        markup above so the answers can surface in the SERP. */}
                    <section className="mt-16">
                        <h2 className="text-2xl font-bold text-white mb-6">
                            Events in {city.name}: common questions
                        </h2>
                        <div className="space-y-4">
                            {faqs.map(faq => (
                                <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                                    <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                                    <p className="text-gray-400 leading-relaxed">{faq.a}</p>
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
                                    Events in {other.name}
                                </Link>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
