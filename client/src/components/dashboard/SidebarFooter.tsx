'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { sidebarFooterItems } from '@/components/dashboard/navModel.mjs';
import { SIDEBAR_ICON, SIDEBAR_LABEL, SIDEBAR_SLOT, sidebarRowClass } from '@/components/dashboard/sidebarChrome';

interface SidebarFooterProps {
    /** Which shell is rendering this, deciding the Settings destination. */
    portal: 'user' | 'venue';
    /** Full-width sidebar (labels visible) vs the collapsed icon rail. */
    isOpen: boolean;
    /**
     * The active pathname, passed in rather than read from usePathname here: the
     * surrounding layout already holds it, and one source avoids the footer
     * highlighting a different route than the nav list above it.
     */
    currentPath: string;
    /** Called after a destination is picked, so a phone drawer can close. */
    onNavigate?: () => void;
}

/** Icons for the footer entries, keyed by the names the nav model uses. */
const ACTION_ICONS: Record<string, React.ReactNode> = {
    'cog': (
        <svg className={SIDEBAR_ICON} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    'sign-out': (
        <svg className={SIDEBAR_ICON} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
    ),
};

/**
 * The pinned bottom block of both sidebars.
 *
 * Two rows: Settings on top, then who you are signed in as with Log out at the
 * opposite end of that row. Sign-out is an icon beside the name because it is the
 * action on that identity, not a peer of the destinations above it - and putting it
 * there costs a row less than the full-width button it replaced.
 *
 * One component rather than two copies. The footers were the part that had already
 * drifted: the user dashboard showed a full-width Logout and never said which
 * account you were in, while the venue portal showed an avatar block and a
 * separate Sign Out row. Rendering both from here means a change lands in both.
 *
 * Collapsed, the same three elements stack centred - a 5rem rail cannot hold the
 * row. Labels become tooltips and accessible names, never dropped.
 */
export default function SidebarFooter({ portal, isOpen, currentPath, onNavigate }: SidebarFooterProps) {
    const { user } = useAuth();
    // Order comes from the shared model, so Settings stays ahead of sign-out in
    // both shells.
    const [settings, signOutItem] = sidebarFooterItems(portal);

    const signOut = () => {
        localStorage.removeItem('fira_token');
        localStorage.removeItem('fira_user');
        window.location.href = '/signin';
    };

    const settingsRow = (
        <Link
            href={settings.href!}
            onClick={onNavigate}
            className={sidebarRowClass({ isOpen, isActive: currentPath === settings.href })}
            title={!isOpen ? settings.label : undefined}
        >
            <span className={SIDEBAR_SLOT}>{ACTION_ICONS[settings.icon]}</span>
            {isOpen && <span className={SIDEBAR_LABEL}>{settings.label}</span>}
        </Link>
    );

    const signOutButton = (
        <button
            type="button"
            onClick={signOut}
            className={`${SIDEBAR_SLOT} rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors`}
            title={signOutItem.label}
            aria-label={signOutItem.label}
        >
            {ACTION_ICONS[signOutItem.icon]}
        </button>
    );

    // Fills the same 32px slot a nav icon occupies, so the name below Settings
    // starts at exactly the same x as the labels above it.
    const avatar = (
        <span className={`${SIDEBAR_SLOT} rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white text-sm font-medium shadow-lg shadow-violet-500/25 overflow-hidden`}>
            {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
                user?.name?.charAt(0).toUpperCase() || 'U'
            )}
        </span>
    );

    return (
        <div
            className={`shrink-0 p-2 lg:p-3 border-t border-white/[0.08] bg-black/20 flex flex-col gap-1 ${isOpen ? '' : 'items-center'
                }`}
        >
            {settingsRow}

            {isOpen ? (
                // Same row geometry as Settings above, so the two read as one block:
                // identity hard left, Log out hard right - opposite the name.
                <div className={sidebarRowClass({ isOpen })}>
                    {avatar}
                    <span className="flex-1 min-w-0">
                        <span className={`${SIDEBAR_LABEL} block text-white truncate`}>
                            {user?.name || 'My Account'}
                        </span>
                        {user?.email && (
                            <span className="block text-xs text-gray-300 truncate">{user.email}</span>
                        )}
                    </span>
                    {signOutButton}
                </div>
            ) : (
                <>
                    {avatar}
                    {signOutButton}
                </>
            )}
        </div>
    );
}
