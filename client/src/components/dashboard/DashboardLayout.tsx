'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { brandsApi } from '@/lib/api';

const navItems = [
    { href: '/dashboard', icon: 'home', label: 'Overview' },
    { href: '/dashboard/events', icon: 'calendar', label: 'My Events' },
    { href: '/dashboard/bookings', icon: 'building', label: 'My Bookings' },
    { href: '/dashboard/tickets', icon: 'ticket', label: 'My Tickets' },
    { href: '/dashboard/payments', icon: 'credit-card', label: 'Payments' },
    { href: '/dashboard/notifications', icon: 'bell', label: 'Notifications' },
];

const venueOwnerItems = [
    { href: '/dashboard/venues', icon: 'building-office', label: 'My Venues' },
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
            const saved = localStorage.getItem('dashboard_sidebar_expanded');
            return saved === 'true';
        }
        return false;
    });
    const [hasBrand, setHasBrand] = useState(false);
    const [hasVenues, setHasVenues] = useState(false);
    const [hasEvents, setHasEvents] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Trigger opening animation
    useEffect(() => {
        if (isMobileSidebarOpen && !isClosing) {
            // Small delay to ensure the element is mounted before animating
            const timer = setTimeout(() => setIsAnimating(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsAnimating(false);
        }
    }, [isMobileSidebarOpen, isClosing]);

    const closeMobileSidebar = () => {
        setIsClosing(true);
        setIsAnimating(false);
        setTimeout(() => {
            setIsMobileSidebarOpen(false);
            setIsClosing(false);
        }, 300); // Match animation duration
    };

    // Persist sidebar state
    useEffect(() => {
        localStorage.setItem('dashboard_sidebar_expanded', String(isExpanded));
    }, [isExpanded]);

    // Check if user has a brand profile or venues
    useEffect(() => {
        const checkUserAssets = async () => {
            if (!user?._id) return;

            // Check for brand
            try {
                const brand = await brandsApi.getMyProfile(user._id);
                setHasBrand(!!brand);
            } catch {
                setHasBrand(false);
            }

            // Check for venues
            try {
                const { venuesApi } = await import('@/lib/api');
                const response = await venuesApi.getUserVenues(user._id) as { venues: any[] };
                const venues = response?.venues || [];
                setHasVenues(venues.length > 0);
            } catch {
                setHasVenues(false);
            }

            // Check for organized events
            try {
                const { eventsApi } = await import('@/lib/api');
                const response = await eventsApi.getUserEvents(user._id) as { events?: any[]; data?: any[] };
                const events = Array.isArray(response) ? response : ((response as { events?: any[]; data?: any[] })?.events || (response as { events?: any[]; data?: any[] })?.data || []);
                setHasEvents(events.length > 0);
            } catch {
                setHasEvents(false);
            }
        };
        checkUserAssets();
    }, [user?._id]);

    const isVenueOwner = user?.role === 'venue_owner' || user?.role === 'admin' || hasVenues;

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

            {/* Mobile Menu Button - Floating */}
            {!isMobileSidebarOpen && (
                <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="fixed top-4 left-4 z-50 lg:hidden w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/30 transition-all duration-300 hover:scale-110"
                >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            )}

            {/* Mobile Sidebar Drawer */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    {/* Backdrop */}
                    <div
                        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
                        onClick={closeMobileSidebar}
                    />

                    {/* Sidebar Drawer - Slide from left */}
                    <aside className={`absolute left-0 top-0 bottom-0 w-3/4 max-w-sm bg-black/95 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-2xl transform transition-transform duration-300 ease-out ${isAnimating ? 'translate-x-0' : '-translate-x-full'}`}>
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <Link href="/" className="flex items-center">
                                <img
                                    src="/logo white.png"
                                    alt="FIRA"
                                    className="w-10 h-10 object-contain"
                                />
                            </Link>
                            <button
                                onClick={closeMobileSidebar}
                                className="text-gray-400 hover:text-white p-2 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* User Info */}
                        <div className="p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-medium shadow-lg shadow-violet-500/25">
                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate">{user?.name || 'User'}</div>
                                    <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={closeMobileSidebar}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive
                                            ? 'bg-white text-black shadow-lg'
                                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        <span className="w-5 h-5">{getIcon(item.icon)}</span>
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                );
                            })}

                            {isVenueOwner && (
                                <>
                                    <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Venue Management
                                    </div>
                                    {venueOwnerItems.map((item) => {
                                        const isActive = pathname.startsWith(item.href);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={closeMobileSidebar}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive
                                                    ? 'bg-gradient-to-r from-violet-500/20 to-pink-500/20 text-violet-300 border border-violet-500/30'
                                                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                <span className="w-5 h-5">{getIcon(item.icon)}</span>
                                                <span className="font-medium">{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </>
                            )}

                            {hasBrand && (
                                <>
                                    <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Brand Profile
                                    </div>
                                    <Link
                                        href="/dashboard/brand"
                                        onClick={closeMobileSidebar}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname.startsWith('/dashboard/brand')
                                            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30'
                                            : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        <span className="w-5 h-5">{getIcon('sparkles')}</span>
                                        <span className="font-medium">My Brand</span>
                                    </Link>
                                </>
                            )}
                        </nav>

                        {/* Logout */}
                        <div className="p-3 border-t border-white/10 bg-black/20">
                            <button
                                onClick={() => {
                                    localStorage.removeItem('fira_token');
                                    localStorage.removeItem('fira_user');
                                    window.location.href = '/signin';
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span className="font-medium">Logout</span>
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* Collapsible Sidebar */}
            <aside
                onMouseEnter={() => setIsExpanded(true)}
                onMouseLeave={() => setIsExpanded(false)}
                className={`fixed left-0 top-0 h-full bg-black/60 backdrop-blur-xl border-r border-white/[0.08] z-30 hidden lg:flex flex-col shadow-[0_0_60px_rgba(168,85,247,0.1)] transition-all duration-300 ease-in-out ${isExpanded ? 'w-64' : 'w-20'
                    }`}
            >
                {/* Logo */}
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-center h-20">
                    <Link href="/" className="flex items-center justify-center">
                        <img
                            src="/logo white.png"
                            alt="FIRA"
                            className="w-10 h-10 object-contain flex-shrink-0"
                        />
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden ${isActive
                                    ? 'bg-white text-black shadow-lg shadow-white/10'
                                    : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                    }`}
                                title={!isExpanded ? item.label : undefined}
                            >
                                <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                    {getIcon(item.icon)}
                                </span>
                                <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                                    }`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* Venue Owner Section */}
                    {isVenueOwner && (
                        <>
                            <div className={`transition-all duration-200 overflow-hidden ${isExpanded ? 'pt-4 pb-2 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
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
                                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden ${isActive
                                            ? 'bg-gradient-to-r from-violet-500/20 to-pink-500/20 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-500/10'
                                            : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                            }`}
                                        title={!isExpanded ? item.label : undefined}
                                    >
                                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                            {getIcon(item.icon)}
                                        </span>
                                        <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                                            }`}>
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </>
                    )}

                    {/* Brand Section */}
                    {hasBrand && (
                        <>
                            <div className={`transition-all duration-200 overflow-hidden ${isExpanded ? 'pt-4 pb-2 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
                                <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Brand Profile
                                </div>
                            </div>
                            <Link
                                href="/dashboard/brand"
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden ${pathname.startsWith('/dashboard/brand')
                                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                                    : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                    }`}
                                title={!isExpanded ? 'My Brand' : undefined}
                            >
                                <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                    {getIcon('sparkles')}
                                </span>
                                <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                                    }`}>
                                    My Brand
                                </span>
                            </Link>
                        </>
                    )}

                    {/* Events Management Section */}
                    {hasEvents && (
                        <>
                            <div className={`transition-all duration-200 overflow-hidden ${isExpanded ? 'pt-4 pb-2 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
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
                                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 overflow-hidden ${isActive
                                            ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border border-orange-500/30 shadow-lg shadow-orange-500/10'
                                            : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                            }`}
                                        title={!isExpanded ? item.label : undefined}
                                    >
                                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                            {getIcon(item.icon)}
                                        </span>
                                        <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'
                                            }`}>
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </>
                    )}
                </nav>

                <div className="p-3 border-t border-white/[0.08] bg-black/20">
                    <div className="flex items-center gap-3 px-3 py-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-medium shadow-lg shadow-violet-500/25 flex-shrink-0">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className={`flex-1 min-w-0 transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                            }`}>
                            <div className="text-sm font-medium text-white truncate">{user?.name || 'User'}</div>
                            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                        </div>
                    </div>
                    {/* Logout Button */}
                    <button
                        onClick={() => {
                            localStorage.removeItem('fira_token');
                            localStorage.removeItem('fira_user');
                            window.location.href = '/signin';
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 mt-1 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-300"
                        title={!isExpanded ? 'Logout' : undefined}
                    >
                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </span>
                        <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                            }`}>
                            Logout
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 min-h-screen relative z-10 pt-4 pb-20 lg:pb-0 lg:pt-20 transition-all duration-300 ${isExpanded ? 'lg:ml-64' : 'lg:ml-20'
                }`}>
                {children}
            </main>
        </div>
    );
}
