import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_SHORT_DESCRIPTION, SITE_TAGLINE } from '@/lib/siteConfig';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: `${SITE_NAME} - ${SITE_TAGLINE}`,
        short_name: SITE_NAME,
        description: SITE_SHORT_DESCRIPTION,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        lang: 'en-IN',
        categories: ['events', 'entertainment', 'lifestyle'],
        icons: [
            {
                src: '/logo white.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
        ],
    };
}
