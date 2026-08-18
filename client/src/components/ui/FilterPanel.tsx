'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface FilterOption {
    value: string;
    label: string;
}

export interface FilterGroup {
    /** Stable key, used for React keys only. */
    key: string;
    /** Heading shown above the control inside the panel. */
    label: string;
    /**
     * `pills` - small option sets rendered as a wrapped row of pills.
     * `list`  - long option sets rendered as a scrollable (optionally searchable) list.
     * `date`  - a single date input.
     */
    type: 'pills' | 'list' | 'date';
    options?: FilterOption[];
    value: string;
    /** Value that counts as "not filtered" (e.g. 'all', 'All', ''). */
    defaultValue: string;
    onChange: (value: string) => void;
    /** `list` only - show a search box above the options. */
    searchable?: boolean;
    /** `date` only - earliest selectable date, as yyyy-mm-dd. */
    minDate?: string;
    /** Label shown on the active chip when the value is a raw string (date/city). */
    formatChip?: (value: string) => string;
}

interface FilterPanelProps {
    groups: FilterGroup[];
    /** Reset every group back to its default. */
    onReset: () => void;
    /** Extra classes for the wrapper. */
    className?: string;
}

function labelFor(group: FilterGroup): string {
    if (group.formatChip) return group.formatChip(group.value);
    const match = group.options?.find(o => o.value === group.value);
    return match?.label ?? group.value;
}

/**
 * A single "Filters" entry point that holds every filter for a listing page,
 * instead of scattering four or five separate dropdowns across the toolbar.
 * Active filters are surfaced as removable chips next to the trigger.
 */
export default function FilterPanel({ groups, onReset, className = '' }: FilterPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [queries, setQueries] = useState<Record<string, string>>({});
    const wrapperRef = useRef<HTMLDivElement>(null);

    const activeGroups = useMemo(
        () => groups.filter(g => g.value !== g.defaultValue),
        [groups]
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    const renderGroup = (group: FilterGroup) => {
        if (group.type === 'date') {
            return (
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none z-10">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <input
                        type="date"
                        value={group.value}
                        min={group.minDate}
                        onChange={(e) => group.onChange(e.target.value)}
                        className="w-full h-[42px] pl-9 pr-3 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50 cursor-pointer [color-scheme:dark]"
                    />
                </div>
            );
        }

        const options = group.options || [];

        if (group.type === 'pills') {
            return (
                <div className="flex flex-wrap gap-2">
                    {options.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => group.onChange(option.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${group.value === option.value
                                ? 'bg-violet-500 border-violet-500 text-white'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            );
        }

        // type === 'list'
        const query = queries[group.key] || '';
        const filtered = query.trim()
            ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
            : options;

        return (
            <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
                {group.searchable && (
                    <div className="p-2 border-b border-white/10">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQueries(prev => ({ ...prev, [group.key]: e.target.value }))}
                            placeholder={`Search ${group.label.toLowerCase()}...`}
                            className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 placeholder-gray-500 outline-none focus:border-violet-500/50"
                        />
                    </div>
                )}
                <div className="max-h-44 overflow-y-auto">
                    {filtered.length === 0 && (
                        <p className="text-gray-300 text-sm text-center py-4">No matches</p>
                    )}
                    {filtered.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => group.onChange(option.value)}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${group.value === option.value
                                ? 'text-violet-400 bg-violet-500/10'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <span>{option.label}</span>
                            {group.value === option.value && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const panelBody = (
        <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="text-white font-semibold text-sm">Filters</h3>
                <div className="flex items-center gap-3">
                    {activeGroups.length > 0 && (
                        <button
                            type="button"
                            onClick={onReset}
                            className="text-xs text-violet-400 hover:text-violet-300"
                        >
                            Clear all
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="text-gray-400 hover:text-white"
                        aria-label="Close filters"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Only this region scrolls; header and footer stay put. flex-1 +
                min-h-0 lets it size to whatever space the capped panel leaves. */}
            <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1 min-h-0">
                {groups.map(group => (
                    <div key={group.key}>
                        <p className="text-xs uppercase tracking-wide text-gray-300 mb-2">{group.label}</p>
                        {renderGroup(group)}
                    </div>
                ))}
            </div>

            <div className="px-5 py-4 border-t border-white/10">
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-colors"
                >
                    Show results
                </button>
            </div>
        </>
    );

    return (
        <div ref={wrapperRef} className={`relative flex items-center gap-2 flex-wrap ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(open => !open)}
                className={`flex items-center justify-center md:justify-start gap-2 h-[42px] px-4 rounded-xl border text-sm font-medium transition-all w-full md:w-auto shrink-0 ${activeGroups.length > 0 || isOpen
                    ? 'bg-violet-500/20 border-violet-500/50 text-white'
                    : 'bg-black/40 border-white/10 text-gray-300 hover:text-white hover:border-white/20'
                    }`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                Filters
                {activeGroups.length > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-violet-500 text-white text-xs font-semibold flex items-center justify-center">
                        {activeGroups.length}
                    </span>
                )}
            </button>

            {/* Active filter chips. Desktop only - at half-width on a phone
                they get crushed, and the count badge on the trigger already
                says how many filters are on. */}
            {activeGroups.map(group => (
                <button
                    key={group.key}
                    type="button"
                    onClick={() => group.onChange(group.defaultValue)}
                    className="hidden md:flex items-center gap-1.5 px-3 h-[30px] rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs hover:text-white hover:border-white/20 transition-all"
                >
                    <span className="text-gray-300">{group.label}:</span>
                    {labelFor(group)}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            ))}

            {isOpen && (
                <>
                    {/* Mobile: centred dialog.
                        Was a bottom sheet, but it sat underneath the fixed
                        bottom nav bar and ran off the screen. Centring it in the
                        viewport keeps the whole panel reachable regardless of
                        how tall the filter list is, and the dvh cap means the
                        body scrolls rather than the panel overflowing. */}
                    <div
                        className="md:hidden fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <div
                            className="w-full max-w-sm max-h-[calc(100dvh-3rem)] flex flex-col bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {panelBody}
                        </div>
                    </div>

                    {/* Desktop: popover.
                        Anchored to the RIGHT edge of the trigger, because this
                        control sits at the right end of the toolbar - opening
                        leftwards is what keeps it on screen. The max-width also
                        clamps it to the viewport on narrow desktop windows. */}
                    <div className="hidden md:flex flex-col absolute top-full right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] max-h-[70vh] z-[70] bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                        {panelBody}
                    </div>
                </>
            )}
        </div>
    );
}
