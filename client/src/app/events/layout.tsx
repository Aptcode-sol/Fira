import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Events Near You - Parties, Concerts & Festivals',
    description:
        'Browse parties, concerts, festivals, DJ nights and more happening near you. Filter by city, date, category and ticket price, then book your tickets on FIRA.',
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
