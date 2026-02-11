'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

export default function VenuePortalLandingNavbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const pathname = usePathname();
    const { user, isAuthenticated } = useAuth();

    // Check if user is a venue owner
    const isVenueOwner = isAuthenticated && user?.role === 'venue_owner';

    useEffect(() => {
        setShouldAnimate(true);
    }, []);

    const navLinks = [
        { href: '/venue-portal/landing', label: 'Home' },
    ];

    const isActive = (path: string) => {
        if (path === '/venue-portal/landing') return pathname === '/venue-portal/landing' || pathname === '/venue-portal';
        return pathname.startsWith(path);
    };

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    return (
        <>
            {/* Desktop Floating Navbar */}
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
                    : 'bg-black/50 backdrop-blur-xl border-white/10'
                    }`}>
                    <div className="flex items-center justify-between md:justify-start md:gap-8">
                        {/* Logo */}
                        <Link href="/venue-portal/landing" className="flex flex-col items-center relative gap-0">
                            <img
                                src="/logo white.png"
                                alt="FIRA"
                                className="w-7 h-7 object-contain"
                            />
                            <span className="text-[9px] text-gray-400 font-medium tracking-wider uppercase leading-none -mt-0.5">
                                Venues
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="flex items-center gap-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`relative text-[15px] transition-colors font-medium ${isActive(link.href)
                                        ? 'text-white'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>

                        {/* Auth Buttons - Dynamic based on login state */}
                        <div className="flex items-center gap-3 ml-6">
                            {isVenueOwner ? (
                                <Link
                                    href="/venue-portal/dashboard"
                                    className="px-4 py-1.5 bg-white text-black rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href="/venue-portal/signin"
                                        className="text-sm text-gray-300 hover:text-white transition-colors"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        href="/venue-portal/signup"
                                        className="px-4 py-1.5 bg-white text-black rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
                                    >
                                        List Venue
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile Navbar */}
            <nav className="md:hidden fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between px-4 h-16">
                    <Link href="/venue-portal/landing" className="flex flex-col items-center gap-0">
                        <img
                            src="/logo white.png"
                            alt="FIRA"
                            className="w-6 h-6 object-contain"
                        />
                        <span className="text-[9px] text-gray-400 font-medium tracking-wider uppercase leading-none -mt-0.5">
                            Venues
                        </span>
                    </Link>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 text-gray-400 hover:text-white"
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

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-16 left-0 right-0 bg-black/95 backdrop-blur-xl border-b border-white/5 p-4"
                    >
                        <div className="space-y-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`block px-4 py-3 rounded-xl transition-colors ${isActive(link.href)
                                        ? 'bg-white/10 text-white'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 flex gap-3">
                            {isVenueOwner ? (
                                <Link
                                    href="/venue-portal/dashboard"
                                    className="flex-1 text-center px-4 py-2.5 bg-white text-black rounded-full text-sm font-medium hover:bg-gray-100"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href="/venue-portal/signin"
                                        className="flex-1 text-center px-4 py-2.5 text-white border border-white/20 rounded-full text-sm font-medium hover:bg-white/5"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        href="/venue-portal/signup"
                                        className="flex-1 text-center px-4 py-2.5 bg-white text-black rounded-full text-sm font-medium hover:bg-gray-100"
                                    >
                                        List Venue
                                    </Link>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </nav>
        </>
    );
}
