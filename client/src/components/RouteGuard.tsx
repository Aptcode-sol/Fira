'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// Public routes accessible to everyone (no auth required)
const publicRoutes = [
    '/',
    '/signin',
    '/signup',
    '/forgot-password',
    '/events',
    '/venues',
    '/creators',
    '/brands',
    '/venue-portal',
    '/venue-portal/landing',
    '/venue-portal/signin',
    '/venue-portal/signup',
    // Marketing, support and legal pages. These were missing, which meant a
    // signed-out visitor (or a crawler) hitting /about or /terms was bounced
    // to /signin.
    '/about',
    '/help',
    '/terms',
    '/privacy',
    '/refund-policy',
    '/community-guidelines',
];

// Routes that start with these prefixes are public (detail pages etc.)
const publicPrefixes = [
    '/events/',
    '/venues/',
    '/creators/',
    '/brands/',
];

// Venue owner only routes
const venueOwnerPrefixes = [
    '/venue-portal/dashboard',
    '/venue-portal/venues',
    '/venue-portal/bookings',
    '/venue-portal/events',
    '/venue-portal/analytics',
    '/venue-portal/settings',
];

// Regular user only routes
const userOnlyPrefixes = [
    '/dashboard',
    '/create',
    // '/messages', // CHAT DISABLED
];

function isPublicRoute(pathname: string): boolean {
    if (publicRoutes.includes(pathname)) return true;
    return publicPrefixes.some(prefix => pathname.startsWith(prefix));
}

function isVenueOwnerRoute(pathname: string): boolean {
    return venueOwnerPrefixes.some(prefix => pathname.startsWith(prefix));
}

function isUserOnlyRoute(pathname: string): boolean {
    return userOnlyPrefixes.some(prefix => pathname.startsWith(prefix));
}

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const [authorized, setAuthorized] = useState(false);

    const isPublic = isPublicRoute(pathname);

    useEffect(() => {
        if (isLoading) return;

        // Public routes - always allow
        if (isPublic) {
            setAuthorized(true);
            return;
        }

        // Not authenticated - redirect to appropriate signin
        if (!isAuthenticated) {
            if (isVenueOwnerRoute(pathname)) {
                router.replace('/venue-portal/signin');
            } else {
                router.replace('/signin');
            }
            setAuthorized(false);
            return;
        }

        const role = user?.role;

        // Venue owner trying to access user-only routes
        if (role === 'venue_owner' && isUserOnlyRoute(pathname)) {
            router.replace('/venue-portal/dashboard');
            setAuthorized(false);
            return;
        }

        // Regular user trying to access venue-owner routes
        if (role === 'user' && isVenueOwnerRoute(pathname)) {
            router.replace('/dashboard');
            setAuthorized(false);
            return;
        }

        // All checks passed
        setAuthorized(true);
    }, [pathname, isPublic, isAuthenticated, isLoading, user, router]);

    // A public route needs no auth check, so render it immediately - BEFORE the
    // isLoading gate below.
    //
    // This matters far beyond a spinner flash: `isLoading` is derived from an
    // `isMounted` flag set in a useEffect, so it is ALWAYS true on the server.
    // Gating public pages on it meant every URL server-rendered as nothing but
    // a spinner, and the real content only appeared after React hydrated in the
    // browser. Crawlers that do not execute JavaScript saw an empty page on
    // every single route.
    if (isPublic) {
        return <>{children}</>;
    }

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    // Show nothing while redirecting
    if (!authorized) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return <>{children}</>;
}
