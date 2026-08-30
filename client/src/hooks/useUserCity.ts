'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'fira_city';

/**
 * The city-first default for listings.
 *
 * Resolution order:
 *   1. An explicit choice the visitor made (persisted in localStorage).
 *   2. The city on their profile, collected at signup.
 *   3. Nothing - listings stay nationwide.
 *
 * Deliberately no GPS: city is the granularity people actually think in
 * ("parties in Hyderabad", not "within 12 km"), it needs no permission prompt,
 * and it does not depend on venue coordinates - which are not yet reliable.
 *
 * `isResolved` exists so callers do not fetch nationwide on the first paint and
 * then immediately refetch by city once localStorage has been read.
 */
export function useUserCity() {
    const { user, isLoading: authLoading } = useAuth();
    const [city, setCityState] = useState<string>('');
    const [isResolved, setIsResolved] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

        if (stored !== null) {
            // '' is a real choice here: the visitor explicitly picked All Cities.
            setCityState(stored);
            setIsResolved(true);
            return;
        }

        // Used as stored. The server canonicalises the spelling when the profile
        // is saved, and the listing APIs slugify whatever they are given, so there
        // is nothing left for the client to normalise.
        setCityState(user?.city || '');
        setIsResolved(true);
    }, [authLoading, user?.city]);

    const setCity = useCallback((next: string) => {
        setCityState(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, next);
        }
    }, []);

    return { city, setCity, isResolved };
}
