import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Book Event Venues - Banquet Halls, Rooftops & Farmhouses',
    description:
        'Find and book verified event venues near you - banquet halls, rooftops, clubs, resorts and farmhouses. Filter by city, capacity, budget and availability date on FIRA.',
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
