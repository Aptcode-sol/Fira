import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Events - Parties, Concerts & Festivals Near You',
    description:
        'See what is on in your city tonight and this weekend - parties, concerts, festivals and DJ nights. Filter by date, category and ticket price, and book in a couple of taps.',
    alternates: { canonical: '/events' },
    openGraph: {
        title: 'Events Near You - Parties, Concerts & Festivals | FIRA',
        description:
            'Browse parties, concerts, festivals, DJ nights and more happening near you. Filter by city, date, category and ticket price.',
        url: '/events',
        type: 'website',
    },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
