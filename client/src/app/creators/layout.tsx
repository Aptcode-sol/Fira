import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Creators - Bands, DJs & Performers',
    description:
        'Browse creators on FIRA - bands, DJs, performers and event organizers. See who is playing near you and book them for your next event.',
    alternates: { canonical: '/creators' },
    openGraph: {
        title: 'Creators - Bands, DJs & Performers | FIRA',
        description:
            'Browse creators on FIRA - bands, DJs, performers and event organizers near you.',
        url: '/creators',
        type: 'website',
    },
};

export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
