import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Bands, Brands & Event Organizers',
    description:
        'Discover bands, brands and event organizers on FIRA. Follow the ones you like, see their upcoming events and get in touch directly.',
    alternates: { canonical: '/brands' },
    openGraph: {
        title: 'Bands, Brands & Event Organizers | FIRA',
        description:
            'Discover bands, brands and event organizers on FIRA. Follow them and see their upcoming events.',
        url: '/brands',
        type: 'website',
    },
};

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
