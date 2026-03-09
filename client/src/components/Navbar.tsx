'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

import { notificationsApi } from '@/lib/api';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { isAuthenticated, isLoading, user } = useAuth();
    const pathname = usePathname();

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

    // Close menu when route changes
    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    return (
        <>
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
                                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-0.5 bg-white rounded-full"
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
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    </Link>
                                    {/* Notification Bell */}
                                    <Link
                                        href="/dashboard/notifications"
                                        className="relative text-gray-400 hover:text-white transition-colors p-1"
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
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black/95 backdrop-blur-xl border-t border-white/10">
                <div className="flex items-center justify-around px-2 py-3">
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

                    {/* Notification Bell - Mobile */}
                    {isAuthenticated && (
                        <Link
                            href="/dashboard/notifications"
                            className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 text-gray-400 hover:text-white"
                        >
                            <div className="relative">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-violet-500 rounded-full"></span>
                                )}
                            </div>
                            <span className="text-xs font-medium">Alerts</span>
                        </Link>
                    )}

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
        </>
    );
}
