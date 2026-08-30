import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { byActivity, fetchListedCities } from '@/lib/seo/listedCities';
import {
    SITE_NAME,
    SITE_URL,
    SITE_DESCRIPTION,
    SITE_ALTERNATE_NAMES,
    SITE_EMAIL,
} from '@/lib/siteConfig';
import { JsonLd, organizationSchema, breadcrumbSchema } from '@/lib/seo/jsonLd';

/**
 * The brand entity page.
 *
 * Search engines cannot associate the word "FIRA" with this site unless some
 * page states, in plain prose, what FIRA is - and repeats the alternate names
 * ("Lets FIRA", "letsfira") people actually type. That is what this page is
 * for. It is also the page an "AboutPage" schema type belongs on, and the
 * natural target for any press or directory backlink.
 */
export const metadata: Metadata = {
    title: `About ${SITE_NAME} - What is FIRA?`,
    description:
        `${SITE_NAME} (also written Lets FIRA or letsfira) is an Indian event discovery and ` +
        `venue booking platform. Here is what we do, who we are for, and how to reach us.`,
    alternates: { canonical: '/about' },
    openGraph: {
        title: `About ${SITE_NAME} - What is FIRA?`,
        description: SITE_DESCRIPTION,
        url: '/about',
        type: 'website',
    },
};

/** Revalidate with the same window as the city pages, so the copy agrees with them. */
export const revalidate = 3600;

/**
 * @param cityNames Cities we currently list in, named in the coverage answer.
 *   Stating cities we do not cover is a claim a visitor can check and find false.
 */
const buildFaqs = (cityNames: string[]) => [
    {
        q: 'What is FIRA?',
        a: `FIRA is an event discovery and venue booking platform in India. You can find parties, concerts and festivals near you and buy tickets, or book a verified venue and host your own event. The brand is also written as "Lets FIRA" or "letsfira", after our website letsfira.com.`,
    },
    {
        q: 'Is FIRA free to use?',
        a: 'Creating an account and browsing events and venues is completely free. You only pay when you buy a ticket or book a venue, and pricing is shown up front before you commit.',
    },
    {
        q: 'Which cities does FIRA cover?',
        a: cityNames.length
            ? `We list events and venues in ${cityNames.slice(0, 8).join(', ')} and more, with new cities added as venues come on board.`
            : `We list events and venues across India, with new cities added as venues come on board.`,
    },
    {
        q: 'How do I list my venue on FIRA?',
        a: 'Sign up through the venue portal, submit your venue details along with ownership and payout information, and our team reviews it before it goes live. Listing is free.',
    },
    {
        q: 'How do I contact FIRA?',
        a: `Email us at ${SITE_EMAIL} and we will get back to you.`,
    },
];

export default async function AboutPage() {
    const listedCities = byActivity(await fetchListedCities());
    const faqs = buildFaqs(listedCities.map(c => c.city));

    return (
        <>
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'AboutPage',
                            '@id': `${SITE_URL}/about#page`,
                            url: `${SITE_URL}/about`,
                            name: `About ${SITE_NAME}`,
                            description: SITE_DESCRIPTION,
                            about: { '@id': `${SITE_URL}/#organization` },
                            isPartOf: { '@id': `${SITE_URL}/#website` },
                        },
                        organizationSchema(),
                    ],
                }}
            />
            <JsonLd
                data={breadcrumbSchema([
                    { name: 'Home', path: '/' },
                    { name: 'About', path: '/about' },
                ])}
            />
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
                <div className="max-w-3xl mx-auto">
                    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-300">
                        <ol className="flex items-center gap-2">
                            <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                            <li aria-hidden="true">/</li>
                            <li className="text-gray-300">About</li>
                        </ol>
                    </nav>

                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
                        About <span className="text-violet-400">FIRA</span>
                    </h1>

                    <div className="space-y-5 text-gray-300 text-lg leading-relaxed">
                        <p>
                            <strong className="text-white">FIRA</strong> - also written as{' '}
                            {SITE_ALTERNATE_NAMES.slice(0, 3).map((name, i) => (
                                <span key={name}>
                                    {i > 0 && ', '}
                                    <strong className="text-white">{name}</strong>
                                </span>
                            ))}{' '}
                            - is an event discovery and venue booking platform in India, at{' '}
                            <strong className="text-white">letsfira.com</strong>.
                        </p>
                        <p>
                            On one side, FIRA is where you find something to do: parties, concerts,
                            DJ nights, festivals and community events happening in your city, with
                            tickets you can buy in a couple of taps.
                        </p>
                        <p>
                            On the other, it is where you host. Browse verified venues - banquet halls,
                            rooftops, clubs, resorts, farmhouses and open-air spaces - compare capacity
                            and pricing, check availability for your date, and send a booking request
                            straight to the owner. Once your event is live you can sell tickets, scan
                            them at the door, and get paid out.
                        </p>
                    </div>

                    <section className="mt-14">
                        <h2 className="text-2xl font-bold text-white mb-4">What you can do on FIRA</h2>
                        <ul className="space-y-3 text-gray-300">
                            {[
                                'Discover events happening in your city, filtered by date, category and ticket price',
                                'Buy tickets online and get a QR code by email instantly',
                                'Book verified venues for birthdays, weddings, corporate events and private parties',
                                'List your own venue and take bookings from organisers across India',
                                'Publish an event, sell tickets, scan entries and receive payouts',
                            ].map(item => (
                                <li key={item} className="flex gap-3">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {listedCities.length > 0 && (
                        <section className="mt-14">
                            <h2 className="text-2xl font-bold text-white mb-4">Where FIRA operates</h2>
                            <p className="text-gray-300 mb-5">
                                FIRA lists events and venues across India. Pick a city to
                                see what is on:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {listedCities.map(city => (
                                    <Link
                                        key={city.slug}
                                        href={`/events/in/${city.slug}`}
                                        className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm hover:text-white hover:border-white/20 transition-all"
                                    >
                                        {city.city}
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="mt-14">
                        <h2 className="text-2xl font-bold text-white mb-6">Frequently asked questions</h2>
                        <div className="space-y-4">
                            {faqs.map(faq => (
                                <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                                    <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                                    <p className="text-gray-300 leading-relaxed">{faq.a}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="mt-14 rounded-2xl border border-white/10 bg-black/50 p-8 text-center">
                        <h2 className="text-2xl font-bold text-white mb-3">Get started</h2>
                        <p className="text-gray-300 mb-6">
                            Free to join. Find something to go to, or host your own.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            <Link
                                href="/signup"
                                className="px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                            >
                                Create a free account
                            </Link>
                            <Link
                                href="/events"
                                className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
                            >
                                Browse events
                            </Link>
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
