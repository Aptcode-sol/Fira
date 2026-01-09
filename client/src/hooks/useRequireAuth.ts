'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to require authentication. Redirects to signin with return URL if not authenticated.
 * @returns { isLoading, isAuthenticated, user }
 */
export function useRequireAuth() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading, isAuthenticated } = useAuth();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            // Encode the current path and redirect to signin with return URL
            const returnUrl = encodeURIComponent(pathname);
            router.push(`/signin?redirect=${returnUrl}`);
        }
    }, [isLoading, isAuthenticated, pathname, router]);

    return { isLoading, isAuthenticated, user };
}

/**
 * Get the signin URL with redirect parameter
 * @param returnPath - The path to return to after login
 */
export function getSignInUrl(returnPath?: string): string {
    if (returnPath) {
        return `/signin?redirect=${encodeURIComponent(returnPath)}`;
    }
    return '/signin';
}
