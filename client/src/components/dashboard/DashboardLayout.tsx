'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import DashboardSwitcher from '@/components/dashboard/DashboardSwitcher';
import SidebarFooter from '@/components/dashboard/SidebarFooter';
import { userNavItems } from '@/components/dashboard/navModel.mjs';
import { SIDEBAR_LABEL, SIDEBAR_SLOT, sidebarRowClass } from '@/components/dashboard/sidebarChrome';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const { user } = useAuth();
    const [isExpanded, setIsExpanded] = useState(() => {
        if (typeof window !== 'undefined') {
            // Only restore the pinned state on desktop. Pinning is a desktop
            // affordance; on a phone the same flag renders a full-screen drawer,
            // so signing in on mobile landed you on the dashboard with the menu
            // already covering the page.
            if (window.innerWidth < 1024) return false;
            const saved = localStorage.getItem('dashboard_sidebar_expanded');
            return saved === 'true';
        }
        return false;
    });
    // Hover-to-peek on desktop. `isExpanded` stays the *pinned* state (toggled
    // by the button, persisted to localStorage); hovering only opens the
    // sidebar temporarily and never overwrites that preference.
    const [isHovered, setIsHovered] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const query = window.matchMedia('(min-width: 1024px)');
        const sync = () => setIsDesktop(query.matches);
        sync();
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    // What the sidebar should *look* like right now. Note the main content
    // margin deliberately does NOT use this - on hover the sidebar overlays the
    // page instead of shoving it sideways, which would be jarring on every
    // pointer pass.
    const isOpen = isExpanded || (isDesktop && isHovered);

    const handleLinkClick = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setIsExpanded(false);
        }
    };

    // Derive sidebar visibility from user context — no API calls needed.
    // This is the only remaining conditional section: a brand profile is a real
    // separate destination, not a duplicate of something already in the list.
    const hasBrand = !!(user?.verificationBadge && ['brand', 'band', 'organizer'].includes(user.verificationBadge));

    // Persist sidebar state
    useEffect(() => {
        localStorage.setItem('dashboard_sidebar_expanded', String(isExpanded));
    }, [isExpanded]);

    useEffect(() => {
        const handleToggle = () => {
            setIsExpanded(prev => !prev);
        };
        window.addEventListener('toggle-dashboard-sidebar', handleToggle);
        return () => window.removeEventListener('toggle-dashboard-sidebar', handleToggle);
    }, []);

    const getIcon = (name: string) => {
        const icons: Record<string, React.ReactNode> = {
            'home': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
            'calendar': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            'building': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            'ticket': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
            ),
            'credit-card': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
            ),
            'sparkles': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
            ),
            'document': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        };
        return icons[name] || null;
    };

    // Row geometry comes from sidebarChrome so this list, the venue portal's list
    // and the footer are the same size. Labels render only when open rather than
    // fading at opacity 0 - an invisible label still reserved its width, which is
    // what made the collapsed rail feel wider than the icons in it.

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex relative">
            {/* Dark background */}
            <div className="party-bg"></div>

            {/* Party Light Rays */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                {/* Red beam - far left */}
                <div className="absolute top-0 left-1/2 w-[300px] h-[120vh] origin-top -translate-x-1/2 rotate-[-55deg] bg-gradient-to-b from-red-500/25 via-red-500/5 to-transparent blur-2xl"></div>
                {/* Orange beam */}
                <div className="absolute top-0 left-1/2 w-[250px] h-[110vh] origin-top -translate-x-1/2 rotate-[-35deg] bg-gradient-to-b from-orange-500/20 via-orange-500/5 to-transparent blur-2xl"></div>
                {/* Yellow beam */}
                <div className="absolute top-0 left-1/2 w-[200px] h-[100vh] origin-top -translate-x-1/2 rotate-[-18deg] bg-gradient-to-b from-yellow-400/18 via-yellow-400/3 to-transparent blur-2xl"></div>
                {/* Green beam */}
                <div className="absolute top-0 left-1/2 w-[180px] h-[95vh] origin-top -translate-x-1/2 rotate-[-5deg] bg-gradient-to-b from-emerald-400/15 via-emerald-400/3 to-transparent blur-2xl"></div>
                {/* Blue beam */}
                <div className="absolute top-0 left-1/2 w-[200px] h-[100vh] origin-top -translate-x-1/2 rotate-[8deg] bg-gradient-to-b from-blue-500/18 via-blue-500/5 to-transparent blur-2xl"></div>
                {/* Violet beam */}
                <div className="absolute top-0 left-1/2 w-[250px] h-[110vh] origin-top -translate-x-1/2 rotate-[25deg] bg-gradient-to-b from-violet-500/22 via-violet-500/5 to-transparent blur-2xl"></div>
                {/* Pink beam */}
                <div className="absolute top-0 left-1/2 w-[280px] h-[115vh] origin-top -translate-x-1/2 rotate-[42deg] bg-gradient-to-b from-pink-500/20 via-pink-500/5 to-transparent blur-2xl"></div>
                {/* Magenta beam */}
                <div className="absolute top-0 left-1/2 w-[300px] h-[120vh] origin-top -translate-x-1/2 rotate-[58deg] bg-gradient-to-b from-fuchsia-500/25 via-fuchsia-500/5 to-transparent blur-2xl"></div>
                {/* Central white glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-gradient-to-b from-white/20 via-white/3 to-transparent blur-3xl"></div>
            </div>

            {/* Main Navbar - Hidden on mobile, shown on desktop */}
            <Navbar />

            {/* Mobile Overlay */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-[59] bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
                    onClick={() => setIsExpanded(false)}
                />
            )}

            {/* Collapsible Sidebar */}
            <aside
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                // inset-y-0 (top AND bottom pinned) rather than top-0 + h-full.
                // `height:100%` on a fixed element resolves against the viewport,
                // which mobile browsers resize as the URL bar hides on scroll -
                // that made the pinned bottom section drift up and settle back.
                // Anchoring both edges makes it stretch instead of being sized once.
                className={`fixed left-0 inset-y-0 bg-[#0a0a0a] lg:bg-black/60 backdrop-blur-xl border-r border-white/[0.08] z-[60] lg:z-50 flex flex-col shadow-[0_0_60px_rgba(168,85,247,0.1)] transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-0 lg:w-20 overflow-hidden border-none'
                    }`}
            >
                {/* Header: logo hard left, one collapse control hard right.
                    It used to centre the logo and absolutely position a hamburger at
                    the left edge plus a separate close button at the right, so the
                    header read as two competing controls around a floating logo, and
                    the logo did not line up with the nav items underneath it. One
                    justify-between row fixes both. */}
                <div
                    className={`px-3 border-b border-white/[0.08] flex items-center gap-3 h-16 lg:h-20 ${isOpen ? '' : 'justify-center'
                        }`}
                >
                    <Link href="/" className="flex items-center flex-shrink-0" aria-label="Fira home">
                        <img
                            src="/logo white.png"
                            alt="FIRA"
                            className="w-8 h-8 lg:w-10 lg:h-10 object-contain"
                        />
                    </Link>

                    {isOpen && (
                        <>
                            {/* Switcher beside the logo: both answer "which product am
                                I in", so they belong together rather than the switcher
                                sitting on top of the nav list as a pseudo-item. */}
                            <DashboardSwitcher current="user" variant="header" />

                            {/* One control for both breakpoints: clearing the pinned flag
                                collapses to the icon rail on desktop and closes the drawer
                                on mobile, because the width classes already differ per
                                breakpoint. */}
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

                {/* Navigation - two zones. The main links scroll if they outgrow the
                    sidebar, while Brand Profile, Settings and Logout stay pinned to the
                    bottom so they sit in the same place on every screen. */}
                <nav className="flex-1 flex flex-col p-3 min-h-0">
                    {/* Collapsed, there is no room beside the logo, so the switcher
                        becomes an icon at the top of the rail. */}
                    {!isOpen && (
                        <div className="flex justify-center pb-1">
                            <DashboardSwitcher current="user" variant="rail" />
                        </div>
                    )}

                    {/* Scrolling zone.
                        No grouped sections left. "Events Management" wrapped a single
                        link behind a header and a divider, and "Venue Management"
                        pointed at second copies of screens the venue portal owns - so
                        this list is now identical for every signed-in account. */}
                    <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                        {userNavItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href!}
                                    onClick={handleLinkClick}
                                    className={sidebarRowClass({ isOpen, isActive })}
                                    title={!isOpen ? item.label : undefined}
                                >
                                    <span className={SIDEBAR_SLOT}>{getIcon(item.icon)}</span>
                                    {isOpen && <span className={SIDEBAR_LABEL}>{item.label}</span>}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Brand Profile, pinned above the shared footer. Gated as a whole
                        so accounts without a brand do not get a stray divider. */}
                    {hasBrand && (
                        <div className="shrink-0 space-y-1 pt-3 mt-2 border-t border-white/[0.06]">
                            <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'pb-2 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
                                <div className="px-3 text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">
                                    Brand Profile
                                </div>
                            </div>
                            <Link
                                href="/dashboard/brand"
                                onClick={handleLinkClick}
                                className={sidebarRowClass({
                                    isOpen,
                                    isActive: pathname.startsWith('/dashboard/brand'),
                                    tone: 'brand',
                                })}
                                title={!isOpen ? 'My Brand' : undefined}
                            >
                                <span className={SIDEBAR_SLOT}>{getIcon('sparkles')}</span>
                                {isOpen && <span className={SIDEBAR_LABEL}>My Brand</span>}
                            </Link>
                        </div>
                    )}
                </nav>

                {/* Settings, then the signed-in account with Log out opposite it.
                    Shared with the venue portal so both shells end identically. */}
                <SidebarFooter
                    portal="user"
                    isOpen={isOpen}
                    currentPath={pathname}
                    onNavigate={handleLinkClick}
                />

                {/* Legal Links - Desktop */}
                <div className={`px-3 py-2 border-t border-white/[0.08] transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                        <span>•</span>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <span>•</span>
                        <Link href="/help" className="hover:text-white transition-colors">Help</Link>
                    </div>
                </div>
            </aside>

            {/* Main Content.
                lg:pl-6 adds a gap between the sidebar's right edge and the content.
                The ml-* offset equals the sidebar width exactly, so without this the
                content sat flush against the sidebar on desktop. Mobile (ml-0, no lg
                padding) is unchanged. */}
            <main className={`flex-1 min-h-screen relative z-10 pt-20 pb-20 lg:pb-0 lg:pt-24 lg:pl-6 transition-all duration-300 ml-0 lg:ml-20 ${isExpanded ? 'lg:ml-64' : 'lg:ml-20'
                }`}>
                {children}
            </main>
        </div>
    );
}
