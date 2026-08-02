'use client';

import { useEffect, useState } from 'react';
import { eventsApi, venuesApi } from '@/lib/api';

/**
 * Distinct list of cities that currently have events or venues.
 * Used to populate the "City" option inside the unified filter panel.
 */
export function useCities() {
    const [cities, setCities] = useState<string[]>([]);

    useEffect(() => {
        const load = async () => {
            const [evRes, venRes] = await Promise.allSettled([
                eventsApi.getAll({ limit: '100' }) as Promise<{ events: { venue?: { address?: { city?: string } } }[] }>,
                venuesApi.getAll({ limit: '100', status: 'approved' }) as Promise<{ venues: { address?: { city?: string } }[] } | { address?: { city?: string } }[]>,
            ]);

            const citySet = new Set<string>();

            if (evRes.status === 'fulfilled') {
                for (const ev of evRes.value.events || []) {
                    const c = ev.venue?.address?.city?.trim();
                    if (c) citySet.add(c);
                }
            }
            if (venRes.status === 'fulfilled') {
                const venues = Array.isArray(venRes.value)
                    ? venRes.value
                    : (venRes.value as { venues?: { address?: { city?: string } }[] }).venues || [];
                for (const v of venues) {
                    const c = v.address?.city?.trim();
                    if (c) citySet.add(c);
                }
            }

            setCities(Array.from(citySet).sort());
        };

        load().catch(() => {
            // Non-fatal: the City filter just stays empty.
        });
    }, []);

    return cities;
}
