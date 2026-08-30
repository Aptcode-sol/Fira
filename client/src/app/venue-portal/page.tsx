'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';

export default function VenuePortalHomePage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();

    useEffect(() => {
        if (isLoading) return;

        // `isVenueOwner` (roles[] source of truth, legacy scalar honored) is the
        // single authority for owner status. Checking `role === 'venue_owner'`
        // here missed accounts that hold the role only in roles[] (e.g. a user
        // who upgraded via the become-a-venue-owner flow).
        if (isAuthenticated && isVenueOwner(user)) {
            // Redirect authenticated venue owners to dashboard
            router.replace('/venue-portal/dashboard');
        } else {
            // Redirect non-authenticated or non-venue-owners to landing
            router.replace('/venue-portal/landing');
        }
    }, [isLoading, isAuthenticated, user, router]);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" />
        </div>
    );
}
