'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import DashboardSwitcher from '@/components/dashboard/DashboardSwitcher';
import SidebarFooter from '@/components/dashboard/SidebarFooter';
import { SIDEBAR_LABEL, SIDEBAR_SLOT, sidebarRowClass } from '@/components/dashboard/sidebarChrome';
import { VENUE_NAV_ICONS } from '@/components/venue-portal/venueNavIcons';
import { venueNavItems } from '@/components/dashboard/navModel.mjs';

interface VenueDashboardLayoutProps {
    children: React.ReactNode;
}

export default function VenueDashboardLayout({ children }: VenueDashboardLayoutProps) {
    const pathname = usePathname();
    const [isExpanded, setIsExpanded] = useState(() => {
        if (typeof window !== 'undefined') {
            // Desktop-only preference - see DashboardLayout. On mobile this
            // flag opens a full-screen drawer, so restoring it meant signing in
            // landed you on a dashboard with the menu already covering it.
            if (window.innerWidth < 1024) return false;
            const saved = localStorage.getItem('venue_sidebar_expanded');
            return saved === 'true';
        }
        return false;
    });
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 1024;
        }
        return false;
    });

    // Hover-to-peek, kept separate from the pinned `isExpanded` state.
    //
    // Hover used to call setIsExpanded directly, which had two bad effects:
    // it overwrote the user's pinned preference in localStorage, and because
    // the main content margin is driven by isExpanded it shoved the entire
    // page sideways on every pointer pass down the left edge.
    const [isHovered, setIsHovered] = useState(false);

    // What the sidebar should LOOK like. Deliberately not used for the main
    // content margin - on hover the sidebar overlays the page instead.
    const isOpen = isExpanded || (!isMobile && isHovered);

    // Track screen size
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Persist sidebar state
    useEffect(() => {
        localStorage.setItem('venue_sidebar_expanded', String(isExpanded));
    }, [isExpanded]);

    useEffect(() => {
        const handleToggle = () => {
            setIsExpanded(prev => !prev);
        };
        window.addEventListener('toggle-dashboard-sidebar', handleToggle);
        return () => window.removeEventListener('toggle-dashboard-sidebar', handleToggle);
    }, []);

    // Tapping a destination closes the drawer on a phone, matching the user
    // dashboard. Without this the menu stayed over the page you had just opened.
    const handleLinkClick = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsExpanded(false);
        }
    };

    // Row geometry is shared with the user dashboard - see sidebarChrome. This list
    // used to be taller on mobile (py-3.5) with 24px icons against the other
    // sidebar's 20px, so the two portals never quite matched.

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex relative">
            {/* Dark background */}
            <div className="party-bg"></div>

            {/* Main Navbar */}
            <Navbar />

            {/* Mobile Overlay */}
            {isMobile && isExpanded && (
                <div
                    className="fixed inset-0 z-[59] bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
                    onClick={() => setIsExpanded(false)}
                />
            )}

            {/* Party Light Rays */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-0 left-1/2 w-[300px] h-[120vh] origin-top -translate-x-1/2 rotate-[-55deg] bg-gradient-to-b from-red-500/25 via-red-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[250px] h-[110vh] origin-top -translate-x-1/2 rotate-[-35deg] bg-gradient-to-b from-orange-500/20 via-orange-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[200px] h-[100vh] origin-top -translate-x-1/2 rotate-[-18deg] bg-gradient-to-b from-yellow-400/18 via-yellow-400/3 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[180px] h-[95vh] origin-top -translate-x-1/2 rotate-[-5deg] bg-gradient-to-b from-emerald-400/15 via-emerald-400/3 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[200px] h-[100vh] origin-top -translate-x-1/2 rotate-[8deg] bg-gradient-to-b from-blue-500/18 via-blue-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[250px] h-[110vh] origin-top -translate-x-1/2 rotate-[25deg] bg-gradient-to-b from-violet-500/22 via-violet-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[280px] h-[115vh] origin-top -translate-x-1/2 rotate-[42deg] bg-gradient-to-b from-pink-500/20 via-pink-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[300px] h-[120vh] origin-top -translate-x-1/2 rotate-[58deg] bg-gradient-to-b from-fuchsia-500/25 via-fuchsia-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-gradient-to-b from-white/20 via-white/3 to-transparent blur-3xl"></div>
            </div>

            {/* Sidebar - slim icon-only on mobile, expandable on desktop */}
            <aside
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                // inset-y-0 rather than top-0 + h-full - see DashboardLayout for
                // why: `height:100%` on a fixed element drifts on mobile as the
                // browser URL bar hides and reappears during scroll.
                className={`fixed left-0 inset-y-0 bg-black/90 lg:bg-black/60 backdrop-blur-xl border-r border-white/[0.08] z-[60] flex flex-col shadow-[0_0_60px_rgba(168,85,247,0.1)] transition-all duration-300 ease-in-out ${isMobile
                    // w-64 open on mobile too, matching the user dashboard. At w-56 the
                    // same account email truncated here and not there.
                    ? (isExpanded ? 'w-64' : 'w-0 overflow-hidden border-none')
                    : (isOpen ? 'w-64' : 'w-20')
                    }`}
            >
                {/* Header: the Fira logo with "Venues" on the line directly beneath it,
                    so the portal you are in is readable whether the sidebar is open or
                    collapsed to the rail. The two were previously side by side when
                    open and stacked only when collapsed, which meant the label moved
                    as you toggled. One column in both states now.

                    px-4 with no vertical padding: the logo plus the title needs about
                    2.75rem, which does not fit inside a 4rem header once p-4 has taken
                    2rem of it. */}
                <div
                    className={`px-3 border-b border-white/[0.08] flex items-center gap-3 h-16 lg:h-20 ${isOpen ? '' : 'justify-center'
                        }`}
                >
                    {/* items-center in both states: the logo sits centred over the
                        wider "Venues" word rather than flush with its left edge, so the
                        lockup does not shift as the sidebar opens and closes. The block
                        as a whole is what moves (left when open, centred in the rail). */}
                    <Link
                        href="/venue-portal/dashboard"
                        className="flex flex-col items-center min-w-0"
                    >
                        <img
                            src="/logo white.png"
                            alt="FIRA"
                            className="w-8 h-8 object-contain flex-shrink-0"
                        />
                        <span className="text-[10px] leading-tight text-gray-300 font-medium tracking-wider uppercase whitespace-nowrap">
                            Venues
                        </span>
                    </Link>

                    {isOpen && (
                        <>
                            {/* Switcher beside the logo: both are "which product am I
                                in", so they belong together rather than the switcher
                                sitting on top of the nav list as a pseudo-item. */}
                            <DashboardSwitcher current="venue" variant="header" />

                            {/* One control for both breakpoints: clearing the pinned flag
                                collapses to the rail on desktop and closes the drawer on
                                mobile. */}
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="text-gray-400 hover:text-white flex-shrink-0 ml-auto"
                                aria-label="Collapse sidebar"
                            >
                                <svg className="w-6 h-6 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>

                {/* Navigation. Settings has moved to the pinned block below, so it
                    cannot scroll away from the position it holds in the other sidebar. */}
                <nav className={`flex-1 p-2 lg:p-3 space-y-1 overflow-y-auto min-h-0 ${isOpen ? '' : 'flex flex-col items-center'}`}>
                    {/* Collapsed, there is no room beside the logo, so the switcher
                        becomes an icon at the top of the rail. */}
                    {!isOpen && <DashboardSwitcher current="venue" variant="rail" />}
                    {venueNavItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href!}
                                onClick={handleLinkClick}
                                className={sidebarRowClass({ isOpen, isActive })}
                                title={!isOpen ? item.label : undefined}
                            >
                                <span className={SIDEBAR_SLOT}>{VENUE_NAV_ICONS[item.icon]}</span>
                                {isOpen && <span className={SIDEBAR_LABEL}>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Settings, then the signed-in account with Log out opposite it.
                    Same component as the user dashboard - the footers used to be two
                    separate blocks and had already drifted apart. */}
                <SidebarFooter
                    portal="venue"
                    isOpen={isOpen}
                    currentPath={pathname}
                    onNavigate={handleLinkClick}
                />
            </aside>

            {/* Main Content.
                lg:pl-6 matches the user dashboard. The ml-* offset equals the sidebar
                width exactly, so without it the content sat flush against the sidebar
                border - which is what made this portal look cramped next to the other. */}
            <main className={`flex-1 min-h-screen relative z-10 pt-20 lg:pt-24 pb-20 lg:pb-0 lg:pl-6 transition-all duration-300 ${isMobile
                ? 'ml-0'
                : (isExpanded ? 'ml-64' : 'ml-20')
                }`}>
                {children}
            </main>
        </div>
    );
}
