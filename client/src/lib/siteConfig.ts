/**
 * Canonical site + brand identity. Everything SEO-facing (metadata, sitemap,
 * robots, JSON-LD, OG images) reads from here so the brand is described
 * *identically* everywhere - which is exactly what search engines need in order
 * to treat "FIRA" as a single entity rather than a coincidental word.
 *
 * Set these in the deployment environment (no trailing slash on the URL):
 *   NEXT_PUBLIC_SITE_URL=https://letsfira.com
 *   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=...
 *   NEXT_PUBLIC_INSTAGRAM_URL / _X_URL / _LINKEDIN_URL / _FACEBOOK_URL / _YOUTUBE_URL
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://letsfira.com').replace(/\/$/, '');

/**
 * Base URL of the API server, including the `/api` prefix and no trailing
 * slash - callers append paths directly, e.g. `${API_BASE_URL}/events`.
 *
 * Set either name in the deployment environment; NEXT_PUBLIC_API_URL wins:
 *   NEXT_PUBLIC_API_URL=https://api.letsfira.com/api
 *   NEXT_PUBLIC_BACKEND_URL=https://api.letsfira.com
 *
 * ponytail: both names are accepted, and the `/api` suffix is appended when
 * absent, because the two halves of this were configured independently - the
 * Amplify environment defined NEXT_PUBLIC_BACKEND_URL while the code read
 * NEXT_PUBLIC_API_URL. NEXT_PUBLIC_* values are inlined at build time, so that
 * mismatch silently shipped the localhost fallback: every visitor's browser was
 * told to call *its own machine* on port 5000, which presents as the whole site
 * being unable to reach the backend rather than as a config error.
 *
 * The final fallback is production-correct, matching SITE_URL above, so a build
 * that receives neither variable still points at a real backend. Naming the
 * host here exposes nothing - the value is public by construction and already
 * ships in the client bundle.
 */
function resolveApiBaseUrl(): string {
    // Referenced as full literals so Next.js can inline them at build time;
    // a computed lookup like process.env[name] would not be substituted.
    const configured =
        process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    if (!configured) {
        return process.env.NODE_ENV === 'development'
            ? 'http://localhost:5000/api'
            : 'https://api.letsfira.com/api';
    }

    const trimmed = configured.replace(/\/+$/, '');
    return /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const SITE_NAME = 'FIRA';

export const SITE_LEGAL_NAME = 'FIRA';

/**
 * Fallback site names, and NOT a keyword list.
 *
 * `alternateName` is what Google picks from when it does not select your preferred
 * `name` - per Google's site names documentation, it exists so the system "can
 * consider other options if your preferred choice isn't selected". So every string
 * here is a name we would accept seeing above our search results.
 *
 * This used to include 'letsfira', 'Lets FIRA' and "Let's FIRA" as query synonyms,
 * and Google did exactly what the field says it does: it showed "letsfira". Offering
 * the domain spelling as a candidate name is what caused the brand to be displayed as
 * the domain. Only FIRA-forward alternates remain, so whichever one is chosen still
 * reads as the brand.
 *
 * The synonyms are still discoverable - they belong in body copy, which is what
 * actually matches a query. /about states in prose that FIRA is "also written Lets
 * FIRA or letsfira".
 */
export const SITE_ALTERNATE_NAMES = [
    'FIRA Events',
    'FIRA India',
];

export const SITE_TAGLINE = 'Book Venues & Discover Events in India';

export const SITE_DESCRIPTION =
    'FIRA is an event discovery and venue booking platform in India. Find parties, concerts and festivals near you, book verified venues for your own event, and sell tickets - all in one place.';

/** Short description for OG cards and the PWA manifest, where space is tight. */
export const SITE_SHORT_DESCRIPTION =
    'Find parties near you and book verified venues for your own event.';

export const SITE_EMAIL = 'no-reply@letsfira.com';

/** Where users are told to reach a human. Distinct from the no-reply sender. */
export const SUPPORT_EMAIL = 'Support.fira@letsfira.com';

export const SITE_LOCALE = 'en_IN';

export const SITE_COUNTRY = 'IN';

/**
 * The logo Google may show beside the brand (knowledge panel, rich results).
 *
 * The BLACK mark, not the white one this used to point at. Google composites this
 * onto a white surface, so a white logo on transparency was invisible there - the
 * same defect that made the favicon render as an empty disc. The site UI keeps using
 * the white mark on its dark chrome; only the crawler-facing copy differs.
 *
 * `logo-black.png`, not `logo%20black.png`. The original filename contains a space,
 * which is legal once encoded but is a standing hazard in a URL handed to crawlers,
 * CDNs and social scrapers - any one of them that mishandles the escape fetches
 * nothing, and a logo that 404s is treated as no logo at all.
 */
export const SITE_LOGO = `${SITE_URL}/logo-black.png`;

/**
 * Profiles the brand controls. `sameAs` is how Google confirms that the
 * letsfira.com entity is the same "FIRA" that has an Instagram, an X account
 * and so on - the strongest available signal short of press coverage.
 * Only non-empty URLs are emitted, so unset vars are simply skipped.
 */
export const SITE_SOCIAL_PROFILES: string[] = [
    process.env.NEXT_PUBLIC_INSTAGRAM_URL,
    process.env.NEXT_PUBLIC_X_URL,
    process.env.NEXT_PUBLIC_LINKEDIN_URL,
    process.env.NEXT_PUBLIC_FACEBOOK_URL,
    process.env.NEXT_PUBLIC_YOUTUBE_URL,
].filter((url): url is string => Boolean(url && url.startsWith('http')));

/** Absolute URL helper - never hand a relative URL to a crawler or scraper. */
export function absoluteUrl(path = '/'): string {
    return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
