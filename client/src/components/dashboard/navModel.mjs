/**
 * Sidebar navigation model for both dashboard shells.
 *
 * Plain ESM, no React and no Next imports, for two reasons: the composition rules
 * (what order items appear in, what sits in the pinned footer) are the part that
 * kept drifting between the two sidebars, and keeping them here means
 * `navModel.check.mjs` can import this exact module and assert on it with bare
 * `node`. A `.ts` model would have forced the check to re-declare the lists, and a
 * check that duplicates its subject passes while the subject rots.
 *
 * Icons are named here and resolved to SVG inside each layout - the model stays
 * render-free.
 *
 * ponytail: `.mjs` rather than `.ts` purely so `node` can run the check with no
 * build step. tsconfig has allowJs, so the .tsx sidebars still typecheck against
 * it. Ceiling: no compile-time types on these lists; the check is what guards them.
 * Upgrade path is Node's --experimental-strip-types once the repo is on Node 22+,
 * at which point this can become navModel.ts unchanged.
 */

/**
 * @typedef {object} NavItem
 * @property {string} [href] Destination. Absent on action items.
 * @property {string} icon Icon name resolved by the layout's getIcon.
 * @property {string} label Visible text, also the collapsed-rail tooltip.
 * @property {'sign-out'} [action] Present instead of href on the sign-out control.
 */

/**
 * The user dashboard's scrolling nav zone.
 *
 * "My Events" sits directly after "My Tickets" instead of in its own "Events
 * Management" section. That section held exactly one link, gated behind a
 * constant that was hardcoded true - a header, a divider and a role check
 * wrapping a single destination. Tickets and events are the same question ("what
 * am I going to / running?"), so they belong next to each other.
 *
 * Notifications is deliberately absent: it is reached from the navbar bell and is
 * a standalone page, so listing it here duplicated the entry point.
 *
 * @type {NavItem[]}
 */
export const userNavItems = [
    { href: '/dashboard', icon: 'home', label: 'Overview' },
    // Directly under Overview, and a plain nav item rather than a pinned "Brand
    // Profile" section at the very bottom with its own header and divider. The
    // creator identity is the account's own standing, so it sits beside the
    // account summary, not below the transactional lists. It appears only here -
    // the venue portal has no creator surface.
    { href: '/dashboard/brand', icon: 'sparkles', label: 'My Brand' },
    { href: '/dashboard/bookings', icon: 'building', label: 'My Bookings' },
    { href: '/dashboard/tickets', icon: 'ticket', label: 'My Tickets' },
    { href: '/dashboard/events', icon: 'calendar', label: 'My Events' },
    // The route keeps its /payments path, but the page behind it now shows only
    // what each organised event earned, so the label says that.
    { href: '/dashboard/payments', icon: 'credit-card', label: 'Earnings' },
    { href: '/dashboard/policies', icon: 'document', label: 'Policies' },
];

/**
 * The venue portal's scrolling nav zone.
 *
 * Venue destinations exist only here. The user sidebar used to carry a "Venue
 * Management" section pointing at /dashboard/venues and /dashboard/requests -
 * second copies of screens this portal already owns.
 *
 * @type {NavItem[]}
 */
export const venueNavItems = [
    { href: '/venue-portal/dashboard', icon: 'home', label: 'Dashboard' },
    { href: '/venue-portal/venues', icon: 'building', label: 'My Venues' },
    { href: '/venue-portal/bookings', icon: 'calendar', label: 'Bookings' },
    { href: '/venue-portal/events', icon: 'ticket', label: 'Event Requests' },
    { href: '/venue-portal/analytics', icon: 'chart', label: 'Analytics' },
    { href: '/venue-portal/earnings', icon: 'rupee', label: 'Earnings' },
];

/**
 * The pinned footer, built from one definition for both shells.
 *
 * Settings then sign-out, in that order, in both portals - so the two footers
 * cannot drift the way the nav lists did. The settings destination is the only
 * thing that varies; the ordering and the wording are not per-portal choices.
 *
 * The two portals used to say "Logout" and "Sign Out" for the same action. It is
 * one control rendered by one component now, so it gets one name.
 *
 * @param {'user' | 'venue'} portal
 * @returns {NavItem[]}
 */
export function sidebarFooterItems(portal) {
    return [
        {
            href: portal === 'venue' ? '/venue-portal/settings' : '/dashboard/settings',
            icon: 'cog',
            label: 'Settings',
        },
        {
            action: 'sign-out',
            icon: 'sign-out',
            label: 'Log out',
        },
    ];
}
