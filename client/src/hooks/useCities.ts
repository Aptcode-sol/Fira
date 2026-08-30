'use client';

import { useEffect, useState } from 'react';
import { locationsApi, type ListedCity } from '@/lib/api';

/**
 * Cities that currently have events or venues. Populates the "City" option in
 * the unified filter panel.
 *
 * This used to fetch the first 100 events and the first 100 venues and collect
 * their distinct city strings. Two problems with that: it moved a megabyte of
 * listing payload to compute a list of names, and the 100-record cap meant that
 * past the first page of listings, whole cities silently vanished from the
 * filter - the bug only appears once there is real traffic. The server does the
 * distinct query now, over every listing, and caches it.
 */
export function useCities() {
    const [cities, setCities] = useState<string[]>([]);

    useEffect(() => {
        locationsApi.listed()
            .then(data => setCities((data.cities || []).map(c => c.city)))
            .catch(() => {
                // Non-fatal: the City filter just stays empty.
            });
    }, []);

    return cities;
}

/**
 * The same list with slugs, states and counts. For callers that need to link to
 * /events/in/<slug> or show how much is in each city.
 */
export function useListedCities() {
    const [cities, setCities] = useState<ListedCity[]>([]);

    useEffect(() => {
        locationsApi.listed()
            .then(data => setCities(data.cities || []))
            .catch(() => { });
    }, []);

    return cities;
}
