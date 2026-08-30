'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';

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
    // Marketing, support and legal pages. These were missing, which meant a
    // signed-out visitor (or a crawler) hitting /about or /terms was bounced
    // to /signin.
    '/about',
    '/help',
    '/terms',
    '/organiser-agreement',
    '/host-agreement',
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

function isPublicRoute(pathname: string): boolean {
    if (publicRoutes.includes(pathname)) return true;
    return publicPrefixes.some(prefix => pathname.startsWith(prefix));
}

function isVenueOwnerRoute(pathname: string): boolean {
    return venueOwnerPrefixes.some(prefix => pathname.startsWith(prefix));
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

        // Not authenticated - the venue-owner auth space is retired, so every
        // protected route (owner-workspace included) sends the visitor to the
        // Unified_Sign_In.
        if (!isAuthenticated) {
            // Carry the intended path so signing in returns them to it. Without this
            // the destination was lost and sign-in fell through to its default, which
            // is now home - so a visitor who clicked a protected link would sign in
            // successfully and land somewhere they had not asked for.
            router.replace(`/signin?redirect=${encodeURIComponent(pathname)}`);
            setAuthorized(false);
            return;
        }

        // `isVenueOwner` (roles[] with legacy scalar honored) is the single
        // client authority for owner access. An owner may reach both the owner
        // workspace and the user dashboard; a non-owner on an owner-workspace
        // route is bounced to /dashboard.
        const owner = isVenueOwner(user);

        if (!owner && isVenueOwnerRoute(pathname)) {
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
