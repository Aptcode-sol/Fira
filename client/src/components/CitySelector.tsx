'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CITIES } from '@/lib/cities';

interface CitySelectorProps {
    value: string;
    onChange: (city: string) => void;
    /** Cities that actually have content right now, from useCities(). */
    available?: string[];
    className?: string;
}

/**
 * City scope for the listings. This sits beside the search box rather than
 * inside the Filters panel on purpose: city is the primary lens on the
 * catalogue, not one filter among six. Keeping it visible also means a visitor
 * can always tell which city they are looking at.
 */
export default function CitySelector({ value, onChange, available = [], className = '' }: CitySelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    // Prefer cities we actually have listings for; fall back to the canonical
    // list so the control is never empty on a cold API.
    const cities = useMemo(() => {
        const names = available.length > 0 ? available : CITIES.map(c => c.name);
        return Array.from(new Set(names)).sort();
    }, [available]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) setQuery('');
    }, [isOpen]);

    const filtered = query.trim()
        ? cities.filter(c => c.toLowerCase().includes(query.toLowerCase()))
        : cities;

    const select = (city: string) => {
        onChange(city);
        setIsOpen(false);
    };

    return (
        <div ref={ref} className={`relative shrink-0 ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(open => !open)}
                className={`flex items-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-medium transition-all w-full ${value
                    ? 'bg-violet-500/20 border-violet-500/50 text-white'
                    : 'bg-black/40 border-white/10 text-gray-300 hover:text-white hover:border-white/20'
                    }`}
            >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{value || 'All Cities'}</span>
                <svg
                    className={`w-3.5 h-3.5 ml-auto shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-60 max-w-[calc(100vw-2rem)] bg-[#0d0d0d] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-[70] overflow-hidden">
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
                    <div className="max-h-56 overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => select('')}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${!value
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
                                type="button"
                                onClick={() => select(city)}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === city
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
    );
}
