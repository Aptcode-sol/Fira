import type { Metadata } from 'next';

/**
 * /brands/<id> and /creators/<id> render the same creator profile. /creators is the one
 * the product links to everywhere, so it is the canonical URL and this route points at
 * it.
 *
 * Without this the page inherited `alternates.canonical: '/brands'` from the parent
 * segment - claiming each profile was a duplicate of the brands LISTING page. That is
 * both wrong and self-defeating: it de-indexed the profile while consolidating nothing.
 *
 * `robots: index: false` as well as the cross-canonical, because a canonical is a hint
 * Google may decline while noindex is a directive. `follow` stays on so the links out
 * of the page still carry.
 *
 * ponytail: canonical-and-noindex rather than deleting this route. It is still reachable
 * from "View Public Profile" in the creator dashboard, and a 404 on a link a user just
 * clicked is worse than a duplicate. Ceiling: ~950 lines of duplicated page code remain.
 * Upgrade path is a permanent redirect to /creators/:id in next.config.ts and deleting
 * both /brands pages, once that one link is repointed.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    return {
        alternates: { canonical: `/creators/${id}` },
        robots: { index: false, follow: true },
    };
}

export default function BrandDetailLayout({ children }: { children: React.ReactNode }) {
    return children;
}
