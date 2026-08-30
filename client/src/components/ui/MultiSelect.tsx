'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingList } from '@/hooks/useFloatingList';

interface MultiSelectOption {
    value: string;
    label: string;
}

interface MultiSelectProps {
    /** Currently selected values. */
    value: string[];
    onChange: (value: string[]) => void;
    options: MultiSelectOption[];
    /** Shown in the trigger when nothing is selected. */
    placeholder?: string;
    label?: string;
    error?: string;
    className?: string;
    id?: string;
    /** Show a search box above the options. Worth it past ~10 options. */
    searchable?: boolean;
    searchPlaceholder?: string;
}

/**
 * Multi-select dropdown, sibling to <Select>.
 *
 * Exists for sets like venue amenities, where a wrapped row of toggle pills costs
 * four or five lines of vertical space on a phone and pushes the rest of the form
 * off screen. Collapses to one row that summarises the selection, and stays open
 * while you tick items so choosing several is one interaction rather than several.
 *
 * The list is portalled to <body> (see useFloatingList) so a scrolling form or
 * modal cannot clip it.
 */
export function MultiSelect({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    label,
    error,
    className = '',
    id: externalId,
    searchable = false,
    searchPlaceholder = 'Search...',
}: MultiSelectProps) {
    const generatedId = useId();
    const selectId = externalId || generatedId;
    const errorId = `${selectId}-error`;
    const listboxId = `${selectId}-listbox`;

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const { triggerRef, listRef, position, isMounted, listStyle } = useFloatingList(isOpen);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (listRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [triggerRef, listRef]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    useEffect(() => {
        if (!isOpen) setQuery('');
    }, [isOpen]);

    const toggle = (optionValue: string) => {
        // Stays open on purpose: picking five amenities should not mean opening the
        // list five times.
        onChange(
            value.includes(optionValue)
                ? value.filter(v => v !== optionValue)
                : [...value, optionValue]
        );
    };

    const filtered = query.trim()
        ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
        : options;

    // Name one or two selections; past that a count reads better than a truncated
    // list of labels.
    const summary = (() => {
        if (value.length === 0) return placeholder;
        const labels = value
            .map(v => options.find(o => o.value === v)?.label)
            .filter(Boolean) as string[];
        if (labels.length <= 2) return labels.join(', ');
        return `${labels.length} selected`;
    })();

    const list = (
        <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable
            // Marks this as a floating layer rendered outside its logical parent, so
            // panels with their own click-outside handling can ignore it.
            data-floating="multiselect"
            style={listStyle}
            className="z-[120] flex flex-col bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
            {searchable && (
                <div className="p-2 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1">
                {filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-300 text-sm">No results found</div>
                ) : (
                    filtered.map(option => {
                        const checked = value.includes(option.value);
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={checked}
                                onClick={() => toggle(option.value)}
                                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3 ${checked ? 'text-white' : 'text-gray-300'
                                    }`}
                            >
                                {/* A box rather than a tick-only row: it shows the
                                    unchecked state too, so it reads as multi-choice. */}
                                <span
                                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${checked
                                        ? 'bg-violet-500 border-violet-500'
                                        : 'border-white/25'
                                        }`}
                                >
                                    {checked && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </span>
                                <span className="truncate">{option.label}</span>
                            </button>
                        );
                    })
                )}
            </div>

            {value.length > 0 && (
                <div className="flex-shrink-0 border-t border-white/10 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{value.length} selected</span>
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className="text-xs text-violet-400 hover:text-violet-300"
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className={`relative ${className}`} ref={triggerRef}>
            {label && (
                <label htmlFor={selectId} className="block text-sm font-medium text-gray-300 mb-2">
                    {label}
                </label>
            )}
            <button
                type="button"
                id={selectId}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listboxId : undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onClick={() => setIsOpen(open => !open)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-3 bg-white/5 border rounded-xl text-left text-sm transition-all focus:outline-none focus:ring-2 ${error
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-white/10 hover:border-violet-500/30 focus:ring-violet-500/50'
                    }`}
            >
                <span className={`truncate ${value.length > 0 ? 'text-white' : 'text-gray-400'}`}>
                    {summary}
                </span>
                <svg
                    className={`w-4 h-4 flex-shrink-0 text-gray-300 transition-transform duration-200 ${isOpen ? 'rotate-180 text-violet-400' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && isMounted && position && createPortal(list, document.body)}

            {error && (
                <p id={errorId} role="alert" className="mt-2 text-sm text-red-400">{error}</p>
            )}
        </div>
    );
}
