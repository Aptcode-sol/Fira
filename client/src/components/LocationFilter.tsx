'use client';

import { useState, useEffect, useRef } from 'react';
import { eventsApi, venuesApi } from '@/lib/api';

interface LocationFilterProps {
    selectedCity: string;
    onCityChange: (city: string) => void;
    className?: string;
    variant?: 'default' | 'select';
}

export default function LocationFilter({ selectedCity, onCityChange, className, variant = 'default' }: LocationFilterProps) {
    const [cities, setCities] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Fetch distinct cities from events + venues
    useEffect(() => {
        const load = async () => {
            try {
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
            } catch {
                // ignore
            }
        };
        load();
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = query.trim()
        ? cities.filter(c => c.toLowerCase().includes(query.toLowerCase()))
        : cities;

    const handleSelect = (city: string) => {
        onCityChange(city === selectedCity ? '' : city);
        setQuery('');
        setOpen(false);
    };

    const handleClear = () => {
        onCityChange('');
        setQuery('');
    };

    return (
        <div className={className || "mb-8 flex items-center gap-3 flex-wrap"}>
            {variant === 'default' && (
                <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    City
                </div>
            )}

            {/* Dropdown */}
            <div ref={ref} className={`relative ${variant === 'select' ? 'w-full' : ''}`}>
                <button
                    onClick={() => setOpen(o => !o)}
                    className={
                        variant === 'select'
                            ? "w-full flex items-center justify-between px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-left text-sm hover:border-violet-500/30 transition-all focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                            : `flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all ${selectedCity
                                ? 'bg-violet-500/20 border-violet-500/50 text-white'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                            }`
                    }
                >
                    <div className="flex items-center gap-2 truncate">
                        {variant === 'select' && (
                            <span className="text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </span>
                        )}
                        <span className={variant === 'select' ? 'text-white' : ''}>
                            {selectedCity || 'All Cities'}
                        </span>
                    </div>
                    <svg
                        className={`w-3.5 h-3.5 transition-transform text-gray-400 ${open ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {open && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                        {/* Search */}
                        <div className="p-2 border-b border-white/10">
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search city..."
                                autoFocus
                                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 placeholder-gray-500 outline-none focus:border-violet-500/50"
                            />
                        </div>

                        {/* Options */}
                        <div className="max-h-52 overflow-y-auto">
                            {/* All cities option */}
                            <button
                                onClick={() => { onCityChange(''); setQuery(''); setOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${!selectedCity
                                    ? 'text-violet-400 bg-violet-500/10'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                All Cities
                            </button>

                            {filtered.length === 0 && (
                                <p className="text-gray-500 text-sm text-center py-4">No cities found</p>
                            )}

                            {filtered.map(city => (
                                <button
                                    key={city}
                                    onClick={() => handleSelect(city)}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedCity === city
                                        ? 'text-violet-400 bg-violet-500/10'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {city}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
}
