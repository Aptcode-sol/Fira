'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';

const navItems = [
    { href: '/dashboard', icon: 'home', label: 'Overview' },
    // "My Events" lives in the Events Management section below (see
    // eventOrganizerItems) - having it here too rendered it twice.
    { href: '/dashboard/bookings', icon: 'building', label: 'My Bookings' },
    { href: '/dashboard/tickets', icon: 'ticket', label: 'My Tickets' },
    { href: '/dashboard/payments', icon: 'credit-card', label: 'Payments' },
    { href: '/dashboard/notifications', icon: 'bell', label: 'Notifications' },
    { href: '/dashboard/policies', icon: 'document', label: 'Policies' },
    { href: '/dashboard/settings', icon: 'cog', label: 'Settings' },
];

const venueOwnerItems = [
    { href: '/dashboard/venues', icon: 'building-office', label: 'My Venues' },
    { href: '/dashboard/requests', icon: 'inbox', label: 'Requests' },
];

const eventOrganizerItems = [
    { href: '/dashboard/events', icon: 'calendar', label: 'My Events' },
];

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

    // Derive sidebar visibility from user context — no API calls needed
    const hasBrand = !!(user?.verificationBadge && ['brand', 'band', 'organizer'].includes(user.verificationBadge));
    const hasVenues = user?.role === 'venue_owner' || user?.role === 'admin';
    // Events Management is now the ONLY place "My Events" appears, so it has to
    // be visible to everyone. This was gated on hasBrand before, but any user
    // can create an event via /create/event - keeping the gate would have left
    // regular users with no way to reach /dashboard/events at all.
    const hasEvents = true;

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

    const isVenueOwner = user?.role === 'venue_owner' || user?.role === 'admin';

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
            'bell': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
            ),
            'building-office': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 21h20M2 21V3h8v18m0-18h12v18m-12 0V8m0 0h12" />
                </svg>
            ),
            'sparkles': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
            ),
            'cog': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
            'document': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            'inbox': (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H8a2 2 0 01-2-2m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-4a2 2 0 00-2 2v1a2 2 0 01-2 2H8a2 2 0 01-2-2v-1a2 2 0 00-2-2H4" />
                </svg>
            ),
        };
        return icons[name] || null;
    };

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
                className={`fixed left-0 inset-y-0 bg-[#0a0a0a] lg:bg-black/60 backdrop-blur-xl border-r border-white/[0.08] z-[60] lg:z-50 flex flex-col shadow-[0_0_60px_rgba(168,85,247,0.1)] transition-all duration-300 ease-in-out ${
                    isOpen ? 'w-64' : 'w-0 lg:w-20 overflow-hidden border-none'
                }`}
            >
                {/* Logo and Mobile Toggle */}
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-center h-16 lg:h-20 relative">
                    {/* Desktop Toggle Button */}
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="absolute left-4 hidden lg:flex text-gray-400 hover:text-white z-10"
                        title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    
                    {/* Logo - Hidden on mobile if not expanded */}
                    <Link href="/" className={`flex items-center justify-center transition-opacity duration-300 ${(!isOpen && 'hidden lg:flex') || 'flex'} w-full`}>
                        <img
                            src="/logo white.png"
                            alt="FIRA"
                            className="w-8 h-8 lg:w-10 lg:h-10 object-contain flex-shrink-0"
                        />
                    </Link>

                    {/* Close Button for Mobile - visible when expanded */}
                    {isExpanded && (
                        <button 
                            onClick={(e) => { e.preventDefault(); setIsExpanded(false); }}
                            className="absolute right-3 lg:hidden text-gray-400 hover:text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Navigation - two zones.
                    The main links scroll if they outgrow the sidebar, while
                    Brand Profile, Events Management and Logout stay pinned to
                    the bottom so they sit in the same place on every screen. */}
                <nav className="flex-1 flex flex-col p-3 min-h-0">
                    {/* Scrolling zone */}
                    <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={handleLinkClick}
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden ${isActive
                                    ? 'bg-white text-black shadow-lg shadow-white/10'
                                    : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                    }`}
                                title={!isOpen ? item.label : undefined}
                            >
                                <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                    {getIcon(item.icon)}
                                </span>
                                <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                                    }`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* Venue Owner Section */}
                    {isVenueOwner && (
                        <>
                            <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'pt-4 pb-2 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
                                <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Venue Management
                                </div>
                            </div>
                            {venueOwnerItems.map((item) => {
                                const isActive = pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={handleLinkClick}
                                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden ${isActive
                                            ? 'bg-gradient-to-r from-violet-500/20 to-pink-500/20 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-500/10'
                                            : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                            }`}
                                        title={!isOpen ? item.label : undefined}
                                    >
                                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                            {getIcon(item.icon)}
                                        </span>
                                        <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                                            }`}>
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </>
                    )}

                    </div>

                    {/* Pinned zone - always at the bottom of the sidebar */}
                    <div className="shrink-0 space-y-1 pt-3 mt-2 border-t border-white/[0.06]">

                    {/* Brand Section */}
                    {hasBrand && (
                        <>
                            <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'pt-4 pb-2 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
                                <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Brand Profile
                                </div>
                            </div>
                            <Link
                                href="/dashboard/brand"
                                onClick={handleLinkClick}
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden ${pathname.startsWith('/dashboard/brand')
                                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                                    : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                    }`}
                                title={!isOpen ? 'My Brand' : undefined}
                            >
                                <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                    {getIcon('sparkles')}
                                </span>
                                <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                                    }`}>
                                    My Brand
                                </span>
                            </Link>
                        </>
                    )}

                    {/* Events Management Section */}
                    {hasEvents && (
                        <>
                            <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'pt-4 pb-2 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
                                <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Events Management
                                </div>
                            </div>
                            {eventOrganizerItems.map((item) => {
                                const isActive = pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={handleLinkClick}
                                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden ${isActive
                                            ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border border-orange-500/30 shadow-lg shadow-orange-500/10'
                                            : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                            }`}
                                        title={!isOpen ? item.label : undefined}
                                    >
                                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                            {getIcon(item.icon)}
                                        </span>
                                        <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                                            }`}>
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </>
                    )}

                    {/* Logout Button */}
                    <button
                        onClick={() => {
                            localStorage.removeItem('fira_token');
                            localStorage.removeItem('fira_user');
                            window.location.href = '/signin';
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden text-red-400 hover:bg-red-500/10 hover:text-red-300`}
                        title={!isOpen ? 'Logout' : undefined}
                    >
                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </span>
                        <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                            }`}>
                            Logout
                        </span>
                    </button>
                    </div>
                </nav>

                {/* Legal Links - Desktop */}
                <div className={`mt-auto px-3 py-2 border-t border-white/[0.08] transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                        <span>•</span>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <span>•</span>
                        <Link href="/help" className="hover:text-white transition-colors">Help</Link>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 min-h-screen relative z-10 pt-16 pb-20 lg:pb-0 lg:pt-20 transition-all duration-300 ml-0 lg:ml-16 ${isExpanded ? 'lg:ml-64' : 'lg:ml-20'
                }`}>
                {children}
            </main>
        </div>
    );
}
