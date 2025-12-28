'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const { isAuthenticated, isLoading, user } = useAuth();
    const pathname = usePathname();

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
            {/* Floating Navbar - Wider on mobile */}
            <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] md:w-auto md:max-w-3xl transition-all duration-300">
                <div className={`px-4 md:px-6 py-2.5 rounded-full border shadow-2xl transition-all duration-300 ${isScrolled
                    ? 'bg-black/70 backdrop-blur-sm border-white/10'
                    : 'nav-floating glass-card border-white/10'
                    }`}>
                    <div className="flex items-center justify-between md:justify-start md:gap-8">
                        {/* Logo */}
                        <Link href="/" className="flex items-center">
                            <img
                                src="/logo white.png"
                                alt="FIRA"
                                className="w-7 h-7 object-contain"
                            />
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center space-x-6">
                            <Link
                                href="/venues"
                                className={`relative text-sm transition-colors pb-0.5 ${isActive('/venues')
                                    ? 'text-white font-semibold after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-0.5 after:bg-white after:rounded-full'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Venues
                            </Link>
                            <Link
                                href="/events"
                                className={`relative text-sm transition-colors pb-0.5 ${isActive('/events')
                                    ? 'text-white font-semibold after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-0.5 after:bg-white after:rounded-full'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Events
                            </Link>
                            <Link
                                href="/create"
                                className={`relative text-sm transition-colors pb-0.5 ${isActive('/create')
                                    ? 'text-white font-semibold after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-0.5 after:bg-white after:rounded-full'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Create
                            </Link>
                            <Link
                                href="/brands"
                                className={`text-sm transition-colors flex items-center gap-1 ${isActive('/brands')
                                    ? 'text-white font-semibold'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                <span className={`relative pb-0.5 ${isActive('/brands')
                                    ? 'after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/5 after:h-0.5 after:bg-white after:rounded-full'
                                    : ''}`}>
                                    Brands
                                </span>
                                <svg className="w-3 h-3 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </Link>
                        </div>

                        {/* Desktop Auth Buttons */}
                        <div className="hidden md:flex items-center space-x-3">
                            {isLoading ? (
                                <div className="w-20 h-8 bg-white/10 rounded-full animate-pulse" />
                            ) : isAuthenticated ? (
                                <>
                                    {/* Notification Icon */}
                                    <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                                    </button>
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
            </nav>

            {/* Mobile Full Screen Menu - Opens from RIGHT */}
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
                            <Link href="/" onClick={() => setIsMenuOpen(false)}>
                                <img src="/logo white.png" alt="FIRA" className="w-8 h-8 object-contain" />
                            </Link>
                            <button
                                onClick={() => setIsMenuOpen(false)}
                                className="text-white p-2"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Navigation Links */}
                        <div className="flex-1 px-6 py-8 space-y-2">
                            <Link
                                href="/venues"
                                onClick={() => setIsMenuOpen(false)}
                                className={`block text-2xl font-semibold py-3 transition-colors ${isActive('/venues') ? 'text-white' : 'text-gray-400'}`}
                            >
                                Venues
                            </Link>
                            <Link
                                href="/events"
                                onClick={() => setIsMenuOpen(false)}
                                className={`block text-2xl font-semibold py-3 transition-colors ${isActive('/events') ? 'text-white' : 'text-gray-400'}`}
                            >
                                Events
                            </Link>
                            <Link
                                href="/create"
                                onClick={() => setIsMenuOpen(false)}
                                className={`block text-2xl font-semibold py-3 transition-colors ${isActive('/create') ? 'text-white' : 'text-gray-400'}`}
                            >
                                Create
                            </Link>
                            <Link
                                href="/brands"
                                onClick={() => setIsMenuOpen(false)}
                                className={`block text-2xl font-semibold py-3 transition-colors ${isActive('/brands') ? 'text-white' : 'text-gray-400'}`}
                            >
                                Brands
                            </Link>
                        </div>

                        {/* Auth Section */}
                        <div className="px-6 py-6 border-t border-white/10">
                            {isAuthenticated ? (
                                <Link
                                    href="/dashboard"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="block w-full bg-white text-black py-4 rounded-xl text-center font-semibold text-lg"
                                >
                                    Go to Dashboard
                                </Link>
                            ) : (
                                <div className="space-y-3">
                                    <Link
                                        href="/signup"
                                        onClick={() => setIsMenuOpen(false)}
                                        className="block w-full bg-white text-black py-4 rounded-xl text-center font-semibold text-lg"
                                    >
                                        Get Started
                                    </Link>
                                    <Link
                                        href="/signin"
                                        onClick={() => setIsMenuOpen(false)}
                                        className="block w-full text-gray-400 py-3 text-center font-medium"
                                    >
                                        Already have an account? Sign In
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
