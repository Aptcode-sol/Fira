import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Event Venues - Book Banquet Halls, Rooftops & Farmhouses',
    // Written to stand alone as a search snippet: what you get, how you
    // narrow it down, and what happens next.
    description:
        'Browse verified event venues across India. Compare banquet halls, rooftops, clubs, resorts and farmhouses by capacity, budget and availability, then send a booking request straight to the owner.',
    alternates: { canonical: '/venues' },
    openGraph: {
        title: 'Book Event Venues - Banquet Halls, Rooftops & Farmhouses | FIRA',
        description:
            'Find and book verified event venues near you. Filter by city, capacity, budget and availability date.',
        url: '/venues',
        type: 'website',
    },
};

export default function VenuesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
