'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

import { notificationsApi } from '@/lib/api';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    // 8.13: how far the on-screen keyboard has shrunk the visual viewport.
    // 0 = no keyboard (nav stays pinned at the layout-viewport bottom, as today).
    const [keyboardOffset, setKeyboardOffset] = useState(0);
    const { isAuthenticated, isLoading, user, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    // 8.13: The fixed bottom nav is positioned against the LAYOUT viewport, which
    // does not shrink when the mobile keyboard opens — so the nav rides up on top
    // of the keyboard. Track the VISUAL viewport and lift the nav by the gap
    // (layout height - visual height - visual offsetTop) so its bottom edge sits
    // at the true visual-viewport bottom.
    // ponytail: VisualViewport-offset option (smallest working diff — no new
    // component, no layout change). Ceiling: a browser lacking the VisualViewport
    // API keeps today's pinned-to-layout-viewport behavior (keyboardOffset stays 0).
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return; // fallback: today's pinned behavior
        const update = () => {
            const gap = window.innerHeight - vv.height - vv.offsetTop;
            // Ignore sub-pixel/address-bar noise; only react to a real keyboard.
            setKeyboardOffset(gap > 100 ? gap : 0);
        };
        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, []);

    // Enable animation only after component mounts (client-side)
    useEffect(() => {
        setShouldAnimate(true);
    }, []);

    // Fetch unread notification count using a lightweight endpoint
    useEffect(() => {
        const fetchUnreadCount = async () => {
            if (!user?._id) return;
            try {
                const data = await notificationsApi.getUnreadCount(user._id);
                setUnreadCount(data.count);
            } catch (error) {
                console.error('Failed to fetch unread count:', error);
            }
        };

        if (isAuthenticated && user?._id) {
            fetchUnreadCount();

            // Poll every 60 seconds (reduced from 30s to lower load)
            const interval = setInterval(fetchUnreadCount, 60000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, user?._id]);

    // 5.1: Home removed from desktop navLinks — the logo already links home,
    // so a text "Home" item was a redundant affordance. The mobile bottom-nav
    // keeps its own Home tab (that is the mobile home affordance, not redundant).
    const navLinks = [
        { href: '/venues', label: 'Venues' },
        { href: '/events', label: 'Events' },
        { href: '/creators', label: 'Creators', badge: true },
    ];

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/';
        return pathname.startsWith(path);
    };

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close menu and drawer when route changes
    useEffect(() => {
        setIsMenuOpen(false);
        setIsSideDrawerOpen(false);
    }, [pathname]);

    const handleHamburgerClick = () => {
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/venue-portal')) {
            window.dispatchEvent(new CustomEvent('toggle-dashboard-sidebar'));
        } else {
            setIsSideDrawerOpen(true);
        }
    };

    return (
        <header role="banner">
            {/* Floating Navbar - Hidden on mobile, visible on desktop */}
            <motion.nav
                className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] md:w-auto md:max-w-3xl hidden md:block"
                initial={false}
                animate={shouldAnimate ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
                transition={{
                    duration: 0.5,
                    ease: [0.25, 0.1, 0.25, 1],
                    opacity: { duration: 0.3 }
                }}
            >
                <div className={`px-4 md:px-6 py-2.5 rounded-full border shadow-2xl transition-all duration-300 ${isScrolled
                    ? 'bg-black/70 backdrop-blur-sm border-white/10'
                    : 'nav-floating glass-card border-white/10'
                    }`}>
                    <div className="flex items-center justify-between md:justify-start md:gap-8">
                        {/* Logo */}
                        <Link href="/" className="flex items-center relative">
                            <img
                                src="/logo white.png"
                                alt="FIRA"
                                className="w-7 h-7 object-contain"
                            />
                            {/* Home indicator - small dot under logo when on home */}
                            {pathname === '/' && (
                                <motion.div
                                    layoutId="navbar-indicator"
                                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-0.5 bg-white rounded-full"
                                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                                />
                            )}
                        </Link>

                        {/* Desktop Navigation with sliding underline */}
                        <div className="hidden md:flex items-center space-x-6">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`relative text-sm transition-colors ${link.badge ? 'flex items-center gap-1' : ''
                                        } ${isActive(link.href)
                                            ? 'text-white font-semibold'
                                            : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <span className="relative py-1">
                                        {link.label}
                                        {/* Animated underline - visible only for nav links */}
                                        {isActive(link.href) && !isActive('/dashboard') && pathname !== '/' && (
                                            <motion.div
                                                layoutId="navbar-indicator"
                                                // 5.2: one consistent small underscore size (matches the
                                                // logo dot's w-1.5 h-0.5) so the shared indicator no longer
                                                // resizes as it animates between the logo and a nav link.
                                                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-0.5 bg-white rounded-full"
                                                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                                            />
                                        )}
                                    </span>
                                    {link.badge && (
                                        <svg className="w-3 h-3 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </Link>
                            ))}
                        </div>

                        {/* Desktop Auth Buttons */}
                        <div className="hidden md:flex items-center space-x-3">
                            {isLoading ? (
                                <div className="w-20 h-8 bg-white/10 rounded-full animate-pulse" />
                            ) : isAuthenticated ? (
                                <>
                                    {/* Messages */}
                                    <Link
                                        href="/messages"
                                        className="relative text-gray-400 hover:text-white transition-colors p-1"
                                        aria-label="Messages"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    </Link>
                                    {/* Notification Bell */}
                                    <Link
                                        href="/notifications"
                                        className="relative text-gray-400 hover:text-white transition-colors p-1"
                                        aria-label="Notifications"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full"></span>
                                        )}
                                    </Link>
                                    <Link
                                        href="/dashboard"
                                        className={`relative text-sm transition-colors pb-0.5 ${isActive('/dashboard')
                                            ? 'text-white font-semibold after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-0.5 after:bg-white after:rounded-full'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        Dashboard
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link href="/signin" className="text-gray-400 hover:text-white transition-colors text-sm">
                                        Sign In
                                    </Link>
                                    <Link href="/signup" className="bg-white text-black hover:bg-gray-200 transition-colors px-4 py-1.5 rounded-full text-sm font-medium">
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile Bottom Navigation */}
            {/* pb-[env(safe-area-inset-bottom)] keeps the tab labels above the
                iPhone home indicator instead of tucked under it. */}
            <div
                className="mobile-fixed-bar fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black/95 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
                // 8.13: lift the nav by the keyboard gap so it sits at the visual-viewport
                // bottom. translateZ(0) is kept from .mobile-fixed-bar so the bar stays on
                // its own compositor layer (inline transform would otherwise override it).
                style={keyboardOffset > 0 ? { transform: `translateZ(0) translateY(-${keyboardOffset}px)` } : undefined}
            >
                <div className="flex items-center justify-around px-2 py-3">
                    {/* Home */}
                    <Link
                        href="/"
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${isActive('/')
                            ? 'text-white'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span className="text-xs font-medium">Home</span>
                    </Link>

                    {/* Venues */}
                    <Link
                        href="/venues"
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${isActive('/venues')
                            ? 'text-white'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-xs font-medium">Venues</span>
                    </Link>

                    {/* Events */}
                    <Link
                        href="/events"
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${isActive('/events')
                            ? 'text-white'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-medium">Events</span>
                    </Link>

                    {/* Brands */}
                    <Link
                        href="/creators"
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 relative ${isActive('/creators')
                            ? 'text-white'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        {navLinks.find(link => link.href === '/creators')?.badge && (
                            <svg className="absolute top-1 right-1 w-3 h-3 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        )}
                        <span className="text-xs font-medium">Creators</span>
                    </Link>



                    {/* Profile/Dashboard */}
                    {isAuthenticated ? (
                        <Link
                            href="/dashboard"
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${isActive('/dashboard')
                                ? 'text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                                <span className="text-white text-xs font-semibold">
                                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                            </div>
                            <span className="text-xs font-medium">You</span>
                        </Link>
                    ) : (
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-gray-400 hover:text-white transition-all duration-200"
                            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                            <span className="text-xs font-medium">Menu</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Full Screen Menu - Only for non-authenticated users */}
            {isMenuOpen && !isAuthenticated && (
                <div className="fixed inset-0 z-40 md:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60"
                        onClick={() => setIsMenuOpen(false)}
                    />

                    {/* Full Screen Menu from Right */}
                    <div className="absolute right-0 top-0 w-full h-full bg-black flex flex-col animate-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="px-4 py-4 flex items-center justify-between border-b border-white/10">
                            <Link href="/" className="flex items-center" onClick={() => setIsMenuOpen(false)}>
                                <img
                                    src="/logo white.png"
                                    alt="FIRA"
                                    className="w-7 h-7 object-contain"
                                />
                            </Link>
                            <button
                                onClick={() => setIsMenuOpen(false)}
                                className="text-white p-1"
                                aria-label="Close menu"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Navigation Links */}
                        <div className="flex-1 px-4 py-6">
                            <div className="space-y-1">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsMenuOpen(false)}
                                        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-lg transition-colors ${isActive(link.href)
                                            ? 'bg-white/10 text-white font-semibold'
                                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        {link.label}
                                        {link.badge && (
                                            <svg className="w-4 h-4 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Auth Section */}
                        <div className="px-4 py-6 border-t border-white/10 mb-20">
                            <div className="space-y-3">
                                <Link
                                    href="/signin"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="block w-full py-3 text-center text-gray-400 hover:text-white transition-colors"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/signup"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="block w-full py-3 text-center bg-white text-black rounded-full font-medium hover:bg-gray-100 transition-colors"
                                >
                                    Get Started
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Mobile Floating Dynamic Island Navbar - Phones Only */}
            <div className="mobile-fixed-bar fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[70%] min-w-[260px] max-w-[70%] md:hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-full shadow-lg">
                    {/* Left: Hamburger (Visible only when logged in) */}
                    <div className="w-7 flex items-center justify-start">
                        {isAuthenticated ? (
                            <button
                                onClick={handleHamburgerClick}
                                className="text-gray-400 hover:text-white p-1 focus:outline-none"
                                aria-label="Open menu"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                        ) : (
                            <div className="w-5 h-5" /> // spacer to keep fira centered
                        )}
                    </div>

                    {/* Center: Fira Logo/Text with Fascinate font like Hero */}
                    <Link href="/" className="text-white hover:text-violet-400 transition-colors uppercase text-xl font-fascinate tracking-wide">
                        FIRA
                    </Link>

                    {/* Right: Inbox (Visible only when logged in) */}
                    <div className="w-7 flex items-center justify-end">
                        {isAuthenticated ? (
                            <Link href="/inbox" className="relative text-gray-400 hover:text-white transition-colors" aria-label="Inbox">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-violet-500 rounded-full"></span>
                                )}
                            </Link>
                        ) : (
                            <div className="w-5 h-5" /> // spacer to keep title centered
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Left Drawer Navigation */}
            <AnimatePresence>
                {isSideDrawerOpen && (
                    <div className="fixed inset-0 z-[60] md:hidden">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black backdrop-blur-xs"
                            onClick={() => setIsSideDrawerOpen(false)}
                        />

                        {/* Drawer Content */}
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute top-0 bottom-0 left-0 w-64 bg-zinc-950 border-r border-white/10 flex flex-col p-6 shadow-2xl"
                        >
                            {/* Drawer Header - logo mark rather than the word
                                "fira" set in the body font, which did not match
                                the brand anywhere else in the app. */}
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                <Link href="/" onClick={() => setIsSideDrawerOpen(false)} className="flex items-center">
                                    <img
                                        src="/logo white.png"
                                        alt="FIRA"
                                        className="h-8 w-auto object-contain"
                                    />
                                </Link>
                                <button
                                    onClick={() => setIsSideDrawerOpen(false)}
                                    className="text-gray-400 hover:text-white p-1"
                                    aria-label="Close navigation"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Navigation Links */}
                            <nav className="flex-1 space-y-2">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsSideDrawerOpen(false)}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isActive(link.href)
                                            ? 'bg-violet-600/20 text-white border border-violet-500/20 font-semibold'
                                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        <span>{link.label}</span>
                                        {/* Verified tick, matching the Creators
                                            tab everywhere else. Was a plain dot
                                            here, which read as an unread badge. */}
                                        {link.badge && (
                                            <svg className="w-4 h-4 text-violet-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </Link>
                                ))}

                                {/* Additional Links if Authenticated */}
                                {isAuthenticated && (
                                    <>
                                        <div className="h-px bg-white/5 my-4" />
                                        <Link
                                            href="/dashboard"
                                            onClick={() => setIsSideDrawerOpen(false)}
                                            className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/dashboard')
                                                ? 'bg-violet-600/20 text-white border border-violet-500/20 font-semibold'
                                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            Dashboard
                                        </Link>
                                        <Link
                                            href="/messages"
                                            onClick={() => setIsSideDrawerOpen(false)}
                                            className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/messages')
                                                ? 'bg-violet-600/20 text-white border border-violet-500/20 font-semibold'
                                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            Messages
                                        </Link>
                                        <Link
                                            href="/notifications"
                                            onClick={() => setIsSideDrawerOpen(false)}
                                            className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/notifications')
                                                ? 'bg-violet-600/20 text-white border border-violet-500/20 font-semibold'
                                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            Notifications
                                        </Link>
                                    </>
                                )}
                            </nav>

                            {/* Footer / Auth buttons */}
                            <div className="pt-4 border-t border-white/5 space-y-3">
                                {isAuthenticated ? (
                                    // The name block looked tappable but did
                                    // nothing - it now opens the dashboard.
                                    <Link
                                        href="/dashboard"
                                        onClick={() => setIsSideDrawerOpen(false)}
                                        className="flex items-center gap-3 px-2 py-2 -mx-2 rounded-xl hover:bg-white/5 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                                            <span className="text-white text-xs font-semibold">
                                                {user?.name?.charAt(0)?.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                                            <p className="text-[11px] text-gray-300 truncate capitalize">{user?.role?.replace('_', ' ')}</p>
                                        </div>
                                        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                ) : null}

                                {/* Sign out. There was no way to log out from
                                    the mobile drawer at all - the only logout
                                    lived inside the dashboard sidebar. */}
                                {isAuthenticated ? (
                                    <button
                                        onClick={() => {
                                            setIsSideDrawerOpen(false);
                                            logout();
                                            router.push('/signin');
                                        }}
                                        className="w-full flex items-center gap-3 px-2 py-3 -mx-2 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                                    >
                                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        <span className="font-medium text-sm">Sign Out</span>
                                    </button>
                                ) : (
                                    <>
                                        <Link
                                            href="/signin"
                                            onClick={() => setIsSideDrawerOpen(false)}
                                            className="block w-full py-3 text-center text-gray-400 hover:text-white text-sm"
                                        >
                                            Sign In
                                        </Link>
                                        <Link
                                            href="/signup"
                                            onClick={() => setIsSideDrawerOpen(false)}
                                            className="block w-full py-2.5 text-center bg-white text-black font-semibold rounded-full text-sm hover:bg-gray-200 transition-all"
                                        >
                                            Get Started
                                        </Link>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </header>
    );
}
