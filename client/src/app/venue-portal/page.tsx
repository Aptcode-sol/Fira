'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function VenuePortalHomePage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();

    useEffect(() => {
        if (isLoading) return;

        if (isAuthenticated && user?.role === 'venue_owner') {
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
