'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Catch-all for any route that does not exist.
 *
 * Rather than a dead end, an unmatched URL sends you somewhere you can act: the
 * dashboard when signed in, the sign-in page when not. The previous 404 screen was
 * a decorated dead end - it offered Home, Browse Events, Venues, Creators, Create
 * and Dashboard, which is six choices for a visitor who did not choose to be here.
 *
 * Client-side, because the session lives in localStorage: the server cannot know
 * which of the two destinations applies, so this cannot be a config redirect or a
 * middleware rewrite.
 *
 * `replace`, not `push`, so Back returns to wherever the bad link was followed from
 * instead of bouncing through this route again.
 */
export default function NotFound() {
    const router = useRouter();
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        // isLoading covers the first paint, before localStorage has been read.
        // Redirecting early would send signed-in users to /signin.
        if (isLoading) return;
        router.replace(isAuthenticated ? '/dashboard' : '/signin');
    }, [isLoading, isAuthenticated, router]);

    // Deliberately minimal: this is visible for a moment at most, and anything
    // richer reads as a destination rather than a hand-off.
    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center" role="status" aria-live="polite">
            <span className="sr-only">Page not found, redirecting</span>
            <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
        </div>
    );
}
