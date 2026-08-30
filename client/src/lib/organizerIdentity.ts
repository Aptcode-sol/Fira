import type { Event, User } from './types';

/** Badges that mean the account is an admin-approved creator. */
const CREATOR_BADGES = ['brand', 'band', 'organizer'];

export interface OrganizerIdentity {
    /** Display name: the brand's when there is one, otherwise the account's. */
    name: string;
    /** Avatar / logo URL, or null to fall back to an initial. */
    photo: string | null;
    /** Whether to draw the verified tick. */
    verified: boolean;
    /** Where the name links to, or null when there is nothing to link to. */
    href: string | null;
    /** True when the identity shown is a brand rather than a personal account. */
    isBrand: boolean;
}

/**
 * Who an event should be presented as.
 *
 * An event run under a brand belongs to the brand: that is the name on the poster and
 * the profile the audience follows. The card and the detail page each read the
 * organizer User directly and so showed the personal account name and avatar - two
 * copies of the same decision, which is how they came to disagree on whether to draw
 * the verified tick at all.
 *
 * `organizerBrand` only arrives for APPROVED brand profiles, so a pending applicant
 * cannot present their events under an unreviewed name.
 */
export function organizerIdentity(event: Pick<Event, 'organizer' | 'organizerBrand'>): OrganizerIdentity | null {
    const brand = event.organizerBrand;
    const organizer = typeof event.organizer === 'object' && event.organizer !== null
        ? (event.organizer as User)
        : null;

    if (brand) {
        return {
            name: brand.name,
            photo: brand.profilePhoto || null,
            // A brand profile only reaches this point once an admin approved it, so
            // the tick is earned by definition.
            verified: true,
            href: `/creators/${brand._id}`,
            isBrand: true,
        };
    }

    if (!organizer) return null;

    return {
        name: organizer.name,
        photo: organizer.avatar || null,
        // The badge, not `isVerified`. `isVerified` is also set on venue-owner KYC, so
        // reading it here drew a creator tick for accounts that had never been
        // reviewed as creators.
        verified: Boolean(organizer.verificationBadge && CREATOR_BADGES.includes(organizer.verificationBadge)),
        href: null,
        isBrand: false,
    };
}
