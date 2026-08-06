import type { Metadata } from 'next';

/**
 * The venue-owner pitch page. Given its own metadata so it does not inherit the
 * parent's and compete with it for the same query - and so a sitelink pointing
 * here reads as the offer rather than as a generic portal description.
 */
export const metadata: Metadata = {
    title: 'List Your Venue - Reach Event Organisers Across India',
    description:
        'Turn your banquet hall, rooftop, farmhouse or club into bookable inventory. Publish it on FIRA in minutes, control your dates and pricing, approve or decline every enquiry, and receive payouts after each event.',
    alternates: { canonical: '/venue-portal/landing' },
    openGraph: {
        title: 'List Your Venue on FIRA - Reach Event Organisers Across India',
        description:
            'Publish your venue in minutes, control dates and pricing, approve every enquiry, and get paid after each event.',
        url: '/venue-portal/landing',
        type: 'website',
    },
};

export default function VenuePortalLandingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
