'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import { SIDEBAR_SLOT } from '@/components/dashboard/sidebarChrome';

interface DashboardSwitcherProps {
    /** Which dashboard the sidebar is currently rendering. */
    current: 'user' | 'venue';
    /**
     * `header` sits beside the Fira logo in an open sidebar. `rail` is the
     * icon-only square for the collapsed rail, where there is no room beside the
     * logo for a label.
     */
    variant: 'header' | 'rail';
}

/**
 * Where each dashboard lives, and the short name used when pointing at it.
 *
 * The long names ("My Dashboard", "Fira Venue") described where you already were,
 * which is the one thing the sidebar around it already makes obvious.
 */
const DASHBOARDS = {
    user: { short: 'Dashboard', href: '/dashboard' },
    venue: { short: 'Venues', href: '/venue-portal/dashboard' },
} as const;

/**
 * Move between the user dashboard and the venue owner portal.
 *
 * A plain link, not a dropdown. There are exactly two dashboards, so the old
 * menu asked for two taps and a click-outside listener to offer a single choice -
 * and it labelled itself with the dashboard you were already in, so the useful
 * information (where you can go) was hidden until you opened it. Now the control
 * names its destination and one tap goes there.
 *
 * Owners only (Flow 7). A user with no owner role sees nothing here.
 */
export default function DashboardSwitcher({ current, variant }: DashboardSwitcherProps) {
    const { user } = useAuth();

    // Source of truth is roles[]; legacy role honored via the shared helper.
    if (!isVenueOwner(user)) return null;

    const target = current === 'user' ? DASHBOARDS.venue : DASHBOARDS.user;
    const hint = `Switch to ${target.short}`;

    if (variant === 'rail') {
        return (
            <Link
                href={target.href}
                title={hint}
                aria-label={hint}
                className={`${SIDEBAR_SLOT} rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:bg-white/[0.08] hover:text-white transition-colors`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
            </Link>
        );
    }

    return (
        <Link
            href={target.href}
            title={hint}
            aria-label={hint}
            className="min-w-0 inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] hover:border-white/25 transition-colors group"
        >
            {/* The swap glyph is what says "switch"; it replaces a "TAP TO SWITCH"
                caption that took a second line to explain how to use a link. In brand
                violet so the chip reads as a deliberate control and not a stray tag. */}
            <svg
                className="w-3.5 h-3.5 flex-shrink-0 text-violet-300"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
            <span className="min-w-0 text-xs font-semibold text-white truncate">
                {target.short}
            </span>
            <svg
                className="w-3.5 h-3.5 flex-shrink-0 text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </Link>
    );
}
