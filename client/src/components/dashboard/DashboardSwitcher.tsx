'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';

interface DashboardSwitcherProps {
    /** Which dashboard the sidebar is currently rendering. */
    current: 'user' | 'venue';
    /** Collapsed sidebars hide the label and render an icon-only trigger. */
    isOpen?: boolean;
}

const DASHBOARDS = {
    user: { label: 'My Dashboard', href: '/dashboard' },
    venue: { label: 'Fira Venue', href: '/venue-portal/dashboard' },
} as const;

/**
 * Sidebar dropdown to move between the normal user dashboard and the owner
 * ("Fira Venue") dashboard. Rendered only for venue owners (Flow 7): a normal
 * user with no owner role sees nothing here (preservation 3.10).
 */
export default function DashboardSwitcher({ current, isOpen = true }: DashboardSwitcherProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click.
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    // Source of truth is roles[]; legacy role honored. Non-owners get no switcher.
    if (!isVenueOwner(user)) return null;

    const active = DASHBOARDS[current];
    const other = current === 'user' ? DASHBOARDS.venue : DASHBOARDS.user;

    return (
        <div ref={ref} className="relative px-1 pb-2">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={`Switch dashboard, currently ${active.label}`}
                aria-haspopup="menu"
                aria-expanded={open}
                title={!isOpen ? `Switch dashboard (${active.label})` : undefined}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-200 hover:bg-white/[0.08] transition-all duration-300 ${isOpen ? '' : 'justify-center'}`}
            >
                <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                </span>
                {isOpen && (
                    <>
                        <span className="flex-1 min-w-0 text-left font-medium truncate">{active.label}</span>
                        <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </>
                )}
            </button>

            {open && (
                <div className={`absolute z-[70] mt-1 rounded-xl bg-[#141414] border border-white/[0.1] shadow-xl overflow-hidden ${isOpen ? 'left-1 right-1' : 'left-1 w-48'}`}>
                    <button
                        type="button"
                        onClick={() => { setOpen(false); router.push(other.href); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-gray-200 hover:bg-white/[0.06] transition-colors"
                    >
                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </span>
                        <span className="font-medium truncate">{other.label}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
