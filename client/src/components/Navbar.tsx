'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

// Track if navbar has ever animated (persists across component lifecycles)
let hasNavbarAnimated = false;

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [shouldAnimate] = useState(() => {
        // Only animate if this is the first time navbar is being shown
        if (hasNavbarAnimated) return false;
        hasNavbarAnimated = true;
        return true;
    });
    const { isAuthenticated, isLoading, user } = useAuth();
    const pathname = usePathname();

    const navLinks = [
        { href: '/venues', label: 'Venues' },
        { href: '/events', label: 'Events' },
        { href: '/brands', label: 'Brands', badge: true },
        { href: '/create', label: 'Create' },
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
            {/* Floating Navbar */}
            <motion.nav
                className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] md:w-auto md:max-w-3xl"
                initial={shouldAnimate ? { scale: 0, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                    duration: 0.5,
                    ease: [0.25, 0.1, 0.25, 1],
                    opacity: { duration: 0.3 }
                }}
                style={{ transformOrigin: 'center center' }}
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
                                <Link
                                    href="/dashboard"
                                    className={`relative text-sm transition-colors pb-0.5 ${isActive('/dashboard')
                                        ? 'text-white font-semibold after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-0.5 after:bg-white after:rounded-full'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    Dashboard
                                </Link>
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

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="md:hidden text-white p-1"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile Full Screen Menu */}
            {isMenuOpen && (
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
                        <div className="px-4 py-6 border-t border-white/10">
                            {isAuthenticated ? (
                                <Link
                                    href="/dashboard"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                                        <span className="text-white font-semibold">
                                            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="font-medium">{user?.name || 'User'}</div>
                                        <div className="text-sm text-gray-400">View Dashboard</div>
                                    </div>
                                </Link>
                            ) : (
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
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
