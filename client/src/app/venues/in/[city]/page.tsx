import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { CityVenuesGrid } from '@/components/city/CityListingGrid';
import { CITIES, getCityBySlug } from '@/lib/cities';
import { getVenuesByCity } from '@/lib/seo/data';
import { SITE_NAME } from '@/lib/siteConfig';
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/lib/seo/jsonLd';
import type { Venue } from '@/lib/types';

/**
 * "banquet halls in hyderabad", "rooftop venues in mumbai", "party hall near
 * me" - high-intent local queries a new brand can realistically rank for.
 * Statically generated and revalidated hourly so crawlers get real listings.
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

    const title = `Event Venues in ${city.name} - Banquet Halls, Rooftops & Farmhouses`;
    const description =
        `Book event venues in ${city.name}, ${city.state}. Compare verified banquet halls, ` +
        `rooftops, clubs, resorts and farmhouses by capacity, budget and availability - ` +
        `then request a booking on ${SITE_NAME}.`;

    return {
        title,
        description,
        keywords: [
            `venues in ${city.name}`,
            `banquet halls in ${city.name}`,
            `party halls in ${city.name}`,
            `birthday party venues ${city.name}`,
            `rooftop venues ${city.name}`,
            `event space ${city.name}`,
        ],
        alternates: { canonical: `/venues/in/${city.slug}` },
        openGraph: {
            title: `${title} | ${SITE_NAME}`,
            description,
            url: `/venues/in/${city.slug}`,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${title} | ${SITE_NAME}`,
            description,
        },
    };
}

export default async function VenuesInCityPage({
    params,
}: {
    params: Promise<{ city: string }>;
}) {
    const { city: slug } = await params;
    const city = getCityBySlug(slug);

    if (!city) notFound();

    const venues = await getVenuesByCity(city.name, 24);
    const otherCities = CITIES.filter(c => c.slug !== city.slug).slice(0, 12);

    const faqs = [
        {
            q: `How much does it cost to book a party venue in ${city.name}?`,
            a: `Pricing varies by venue type, capacity and date. Every venue on ${SITE_NAME} shows its starting price up front, and you can filter ${city.name} venues by budget to see only what fits yours.`,
        },
        {
            q: `How do I check if a venue in ${city.name} is available on my date?`,
            a: `Use the "Available on" filter to pick your date and see only venues that are free. You can also open a venue and send a booking request for a specific date - the owner responds directly.`,
        },
        {
            q: `Are the venues on ${SITE_NAME} verified?`,
            a: `Yes. Every venue listed in ${city.name} is submitted by its owner and reviewed before it goes live, including ownership and bank details for payouts.`,
        },
        {
            q: `What kinds of venues can I book in ${city.name}?`,
            a: `Banquet halls, rooftops, clubs, restaurants, resorts, farmhouses, gardens and outdoor spaces - anything from an intimate birthday to a large wedding reception in ${city.name}.`,
        },
    ];

    return (
        <>
            <JsonLd
                data={breadcrumbSchema([
                    { name: 'Home', path: '/' },
                    { name: 'Venues', path: '/venues' },
                    { name: city.name, path: `/venues/in/${city.slug}` },
                ])}
            />
            {venues.length > 0 && (
                <JsonLd
                    data={itemListSchema(
                        `Event venues in ${city.name}`,
                        `/venues/in/${city.slug}`,
                        venues.map(v => ({ name: v.name || 'Venue', path: `/venues/${v._id}` }))
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
                    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-300">
                        <ol className="flex flex-wrap items-center gap-2">
                            <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                            <li aria-hidden="true">/</li>
                            <li><Link href="/venues" className="hover:text-white transition-colors">Venues</Link></li>
                            <li aria-hidden="true">/</li>
                            <li className="text-gray-300">{city.name}</li>
                        </ol>
                    </nav>

                    <header className="mb-10">
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                            Event Venues in <span className="text-violet-400">{city.name}</span>
                        </h1>
                        <p className="text-gray-300 text-lg max-w-3xl leading-relaxed">
                            Book verified event venues across {city.name}, {city.state} - banquet halls,
                            rooftops, clubs, resorts, farmhouses and open-air spaces. Compare capacity,
                            amenities and starting price, check availability for your date, and send a
                            booking request straight to the owner.
                        </p>
                    </header>

                    {venues.length > 0 ? (
                        <>
                            <h2 className="text-xl md:text-2xl font-bold text-white mb-5 relative pl-4">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 md:h-6 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full" />
                                Top rated venues in {city.name}
                            </h2>
                            <CityVenuesGrid venues={venues as unknown as Venue[]} />

                            <div className="mt-10">
                                <Link
                                    href={`/venues?city=${encodeURIComponent(city.name)}`}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Browse all venues in {city.name}
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                            <h2 className="text-xl font-bold text-white mb-2">
                                No venues listed in {city.name} yet
                            </h2>
                            <p className="text-gray-300 mb-6 max-w-xl mx-auto">
                                We are onboarding venues in {city.name} right now. If you own one,
                                listing it is free and takes a few minutes.
                            </p>
                            <div className="flex flex-wrap gap-3 justify-center">
                                <Link
                                    href="/venue-portal/signup"
                                    className="px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    List your venue
                                </Link>
                                <Link
                                    href="/venues"
                                    className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
                                >
                                    All venues
                                </Link>
                            </div>
                        </div>
                    )}

                    <section className="mt-16 rounded-2xl border border-white/10 bg-black/50 p-8">
                        <h2 className="text-2xl font-bold text-white mb-3">
                            Looking for something to attend in {city.name}?
                        </h2>
                        <p className="text-gray-300 mb-6 max-w-2xl">
                            See the parties, concerts, festivals and DJ nights happening in {city.name}
                            over the coming weeks.
                        </p>
                        <Link
                            href={`/events/in/${city.slug}`}
                            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-semibold"
                        >
                            See events in {city.name} →
                        </Link>
                    </section>

                    <section className="mt-16">
                        <h2 className="text-2xl font-bold text-white mb-6">
                            Booking a venue in {city.name}: common questions
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

                    <section className="mt-16">
                        <h2 className="text-lg font-bold text-white mb-4">Venues in other cities</h2>
                        <div className="flex flex-wrap gap-2">
                            {otherCities.map(other => (
                                <Link
                                    key={other.slug}
                                    href={`/venues/in/${other.slug}`}
                                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm hover:text-white hover:border-white/20 transition-all"
                                >
                                    Venues in {other.name}
                                </Link>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
