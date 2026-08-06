import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Creators - Bands, DJs, Artists & Event Organisers',
    description:
        'Discover the bands, DJs, artists and organisers behind the events. Follow them to hear about new shows first, see what they have coming up, and get in touch about your own event.',
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
