import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteConfig';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                // Private / logged-in surfaces have nothing for a crawler and
                // would only burn crawl budget.
                disallow: [
                    '/dashboard/',
                    '/venue-portal/',
                    '/inbox',
                    '/messages',
                    '/create/',
                    '/signin',
                    '/signup',
                    '/forgot-password',
                ],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
