'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select } from './Select';
import { openPickerOnClick } from '@/lib/dateInput';

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
    /**
     * Fired when the user clicks "Show results". Lets the host commit its draft
     * selection and run a single list query on submit rather than on every
     * option click (8.1). Optional so existing callers are unaffected.
     */
    onApply?: () => void;
    /** Extra classes for the wrapper. */
    className?: string;
}

/**
 * A single "Filters" entry point that holds every filter for a listing page,
 * instead of scattering four or five separate dropdowns across the toolbar.
 * Active filters are surfaced as removable chips next to the trigger.
 */
export default function FilterPanel({ groups, onReset, onApply, className = '' }: FilterPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    // The mobile dialog is portalled out of the wrapper, so the click-outside
    // check needs its own ref - otherwise every click inside it counts as
    // "outside" and closes the panel on the first option tap.
    const mobilePanelRef = useRef<HTMLDivElement>(null);
    // Portals need a DOM target, which does not exist during SSR.
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => setIsMounted(true), []);

    // "Show results" both commits the host's draft (single API call, 8.1) and
    // closes the panel. onApply is optional so callers without draft state keep
    // today's behaviour.
    const applyAndClose = () => {
        onApply?.();
        setIsOpen(false);
    };

    const activeGroups = useMemo(
        () => groups.filter(g => g.value !== g.defaultValue),
        [groups]
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const insideTrigger = wrapperRef.current?.contains(target);
            const insideMobilePanel = mobilePanelRef.current?.contains(target);
            // A dropdown opened from inside this panel renders in a body-level
            // portal (so it cannot be clipped by the panel's own scroll area), which
            // puts it outside both refs above. Without this check, picking an option
            // would count as a click outside and close the whole filter panel.
            const insideFloatingLayer = Boolean(
                (event.target as Element)?.closest?.('[data-floating]')
            );
            if (!insideTrigger && !insideMobilePanel && !insideFloatingLayer) {
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
                    {/* Native date input on purpose: it gives the OS picker on a
                        phone (wheels on iOS, Material on Android), keyboard entry,
                        and locale formatting for free.
                        The popup itself is browser chrome and cannot be styled with
                        CSS - color-scheme:dark makes the browser render its dark
                        variant, and accentColor recolours the selected day from the
                        default blue to our violet. That is the full extent of the
                        control available without shipping a bespoke calendar. */}
                    <input
                        type="date"
                        value={group.value}
                        min={group.minDate}
                        onChange={(e) => group.onChange(e.target.value)}
                        {...openPickerOnClick}
                        style={{ accentColor: '#8b5cf6' }}
                        className="w-full h-[42px] pl-9 pr-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm hover:border-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all cursor-pointer [color-scheme:dark]"
                    />
                </div>
            );
        }

        const options = group.options || [];

        if (group.type === 'pills') {
            return (
                <>
                    {/* Mobile: a dropdown. Wrapped pill rows cost three or four
                        lines of vertical space per group, which pushed the panel
                        past the viewport on a phone; a dropdown collapses each
                        group to one row. This is the app's shared Select, so the
                        open list carries the same dark panel, violet active state
                        and check mark as every other dropdown in the product - a
                        native <select> would have handed the list to the OS and
                        looked nothing like the rest of the UI.
                        ponytail: reuse the existing component, no new styling. */}
                    <Select
                        className="md:hidden"
                        value={group.value}
                        onChange={group.onChange}
                        options={options}
                    />

                    {/* Desktop keeps the pills - the popover has the width for
                        them and one tap beats two on a pointer device. */}
                    <div className="hidden md:flex flex-wrap gap-2">
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
                </>
            );
        }

        // type === 'list' - venue type, event category and similar long option sets.
        //
        // Also a dropdown now, on both breakpoints. It used to be an always-open
        // scrolling box with its own search input, which took ~200px of the panel
        // per group and meant the panel itself scrolled inside a nested scroller.
        // The shared Select collapses it to one row and brings its own search, so
        // the bespoke filtering, the `queries` state and the empty state all go.
        return (
            <Select
                value={group.value}
                onChange={group.onChange}
                options={options}
                searchable={group.searchable}
                searchPlaceholder={`Search ${group.label.toLowerCase()}...`}
            />
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
                min-h-0 lets it size to whatever space the capped panel leaves.

                Two columns on mobile: now that every control is a single-row
                dropdown they pair up cleanly, which halves the panel's height and
                usually removes the need to scroll it at all. The desktop popover is
                only 360px wide, so it stays one column. */}
            <div className="px-5 py-4 grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-1 md:gap-y-5 overflow-y-auto flex-1 min-h-0">
                {groups.map(group => (
                    // A date field needs the full row - a half-width native date
                    // input truncates its own placeholder.
                    <div key={group.key} className={group.type === 'date' ? 'col-span-2 md:col-span-1' : 'min-w-0'}>
                        <p className="text-xs uppercase tracking-wide text-gray-300 mb-2 truncate">{group.label}</p>
                        {renderGroup(group)}
                    </div>
                ))}
            </div>

            <div className="px-5 py-4 border-t border-white/10">
                <button
                    type="button"
                    onClick={applyAndClose}
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

            {/* No external selected-item chips (8.2): the applied-filter count
                is surfaced solely by the badge on the trigger above. Removing
                the chips-with-close-icons keeps a single count affordance. */}

            {isOpen && (
                <>
                    {/* Mobile: centred dialog, portalled to <body>.
                        The portal is what keeps it above the fixed bottom nav.
                        Every listing page wraps its content in
                        `<main className="relative z-20">`, which opens a
                        stacking context - so a z-index set inside it only ranks
                        against its siblings, and the nav (z-50, outside main)
                        always won no matter how high this went. Rendering
                        outside main puts both on the same footing again.
                        The bottom padding + shrunk max-height still reserve the
                        nav's band (~4rem tab bar) plus the iPhone home-indicator
                        inset, so "Show results" never lands under the nav (32.1).
                        ponytail: nav height is the assumed 4rem tab bar; if the
                        mobile nav height changes, bump the 4rem in both places. */}
                    {isMounted && createPortal(
                        <div
                            ref={mobilePanelRef}
                            className="md:hidden fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pb-[calc(4rem+env(safe-area-inset-bottom))]"
                            onClick={() => setIsOpen(false)}
                        >
                            <div
                                className="w-full max-w-sm max-h-[calc(100dvh-3rem-4rem-env(safe-area-inset-bottom))] flex flex-col bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {panelBody}
                            </div>
                        </div>,
                        document.body
                    )}

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
