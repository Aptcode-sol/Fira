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
                //
                // Note the venue-portal entries are listed individually rather
                // than blocking '/venue-portal/' wholesale. That blanket rule
                // also hid the PUBLIC marketing pages (/venue-portal and
                // /venue-portal/landing) - the "List your venue" pitch aimed at
                // venue owners - so they could never be indexed or appear as a
                // sitelink, while still being listed in sitemap.xml. That
                // contradiction is exactly the kind of thing Search Console
                // reports as "indexed though blocked by robots.txt".
                disallow: [
                    '/dashboard/',
                    '/venue-portal/dashboard',
                    '/venue-portal/venues',
                    '/venue-portal/bookings',
                    '/venue-portal/events',
                    '/venue-portal/analytics',
                    '/venue-portal/settings',
                    '/messages',
                    '/notifications',
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
