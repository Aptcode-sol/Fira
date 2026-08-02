import {
    SITE_URL,
    SITE_NAME,
    SITE_LEGAL_NAME,
    SITE_ALTERNATE_NAMES,
    SITE_DESCRIPTION,
    SITE_LOGO,
    SITE_EMAIL,
    SITE_SOCIAL_PROFILES,
    absoluteUrl,
} from '@/lib/siteConfig';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Renders a JSON-LD block. Schema markup is what lets Google show a knowledge
 * panel, sitelinks and event rich results instead of a bare blue link.
 */
export function JsonLd({ data }: { data: any }) {
    return (
        <script
            type="application/ld+json"
            // JSON.stringify output is not HTML, but `<` inside a string value
            // would still close the script tag early - so escape it.
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data).replace(/</g, '\\u003c'),
            }}
        />
    );
}

/**
 * The brand entity. This is the single most important piece of markup for the
 * "why can't anyone find us by searching FIRA" problem: it states the name, the
 * alternate names people actually type, and the profiles that corroborate it.
 */
export function organizationSchema() {
    return {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        legalName: SITE_LEGAL_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: SITE_URL,
        logo: {
            '@type': 'ImageObject',
            url: SITE_LOGO,
            caption: SITE_NAME,
        },
        image: SITE_LOGO,
        description: SITE_DESCRIPTION,
        email: SITE_EMAIL,
        areaServed: {
            '@type': 'Country',
            name: 'India',
        },
        knowsAbout: [
            'Event discovery',
            'Venue booking',
            'Event ticketing',
            'Party planning',
        ],
        contactPoint: [
            {
                '@type': 'ContactPoint',
                contactType: 'customer support',
                email: SITE_EMAIL,
                areaServed: 'IN',
                availableLanguage: ['en', 'hi'],
            },
        ],
        ...(SITE_SOCIAL_PROFILES.length > 0 ? { sameAs: SITE_SOCIAL_PROFILES } : {}),
    };
}

export function websiteSchema() {
    return {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-IN',
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/events?search={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };
}

export interface Crumb {
    name: string;
    path: string;
}

/** Breadcrumbs replace the raw URL in search results with a readable trail. */
export function breadcrumbSchema(crumbs: Crumb[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            item: absoluteUrl(crumb.path),
        })),
    };
}

/** A listing page's contents, so Google understands it as a real collection. */
export function itemListSchema(name: string, path: string, items: { name: string; path: string }[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name,
        url: absoluteUrl(path),
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            url: absoluteUrl(item.path),
        })),
    };
}
