'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingList } from '@/hooks/useFloatingList';
import { locationsApi, type CitySuggestion } from '@/lib/api';

/**
 * City lookup for address forms.
 *
 * Replaces the fixed ~100-city <Select>. That list could not cover India, so a
 * venue owner in Vellore or Panipat had no city to pick and could not list at
 * all - and a dropdown gives no way to say "mine is missing".
 *
 * A suggestion carries the state and the canonical slug with it, so picking a
 * city fills State and gives the record the value that filters and city pages
 * match on. That is also why free text is not accepted: a typed city would
 * arrive with no state and no slug, which is a listing that never appears in a
 * city filter. Whatever is not picked is discarded on blur.
 */

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

interface CitySearchProps {
    /** Currently selected city name, or '' when nothing is selected. */
    value: string;
    /** Fires only with a real suggestion, never with typed text. */
    onSelect: (city: CitySuggestion) => void;
    /** Fires when the user empties the field. */
    onClear?: () => void;
    /**
     * Empty the field after a pick instead of showing the chosen city.
     *
     * For the add-to-a-list case (a creator's operating cities), where the
     * selection is the chips beside the field, not the field itself.
     */
    clearOnSelect?: boolean;
    label?: string;
    placeholder?: string;
    error?: string;
    helperText?: string;
    id?: string;
    className?: string;
}

export function CitySearch({
    value,
    onSelect,
    onClear,
    clearOnSelect = false,
    label,
    placeholder = 'Start typing your city',
    error,
    helperText,
    id: externalId,
    className = '',
}: CitySearchProps) {
    const generatedId = useId();
    const inputId = externalId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const listboxId = `${inputId}-listbox`;

    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<CitySuggestion[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    /**
     * The query `results` actually belongs to, or '' when no search has run for
     * what is currently typed.
     *
     * Distinguishes "searched and found nothing" from "not searched yet". Without
     * it, clicking back into a field holding an already-selected city opened the
     * panel on an empty result set and read as "No matching city" - about the city
     * the user had just successfully picked.
     */
    const [searchedFor, setSearchedFor] = useState('');
    /**
     * Set when the lookup could not be reached, so an empty list says "try again"
     * instead of "your city does not exist". Covers both a failed request and the
     * server telling us it fell back to cities that already have listings.
     */
    const [lookupFailed, setLookupFailed] = useState(false);

    const { triggerRef, listRef, position, isMounted, listStyle } = useFloatingList(isOpen);

    /** Latest query a request was issued for, so slower earlier responses lose. */
    const latestQuery = useRef('');

    // Follow the form when it changes the city from outside (edit mode loading a
    // saved venue, or "Clear all").
    useEffect(() => setQuery(value), [value]);

    useEffect(() => {
        const trimmed = query.trim();

        // Nothing to look up. Also covers the moment after a selection, where the
        // query equals the chosen city and searching again would reopen the list.
        if (trimmed.length < MIN_QUERY_LENGTH || trimmed === value) {
            setResults([]);
            setSearchedFor('');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(async () => {
            latestQuery.current = trimmed;
            try {
                const data = await locationsApi.searchCities(trimmed);
                if (latestQuery.current !== trimmed) return; // a newer query won
                setResults(data.results || []);
                setLookupFailed(data.source === 'listings');
            } catch {
                if (latestQuery.current !== trimmed) return;
                setResults([]);
                setLookupFailed(true);
            } finally {
                if (latestQuery.current === trimmed) {
                    setIsLoading(false);
                    setSearchedFor(trimmed);
                }
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [query, value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (listRef.current?.contains(target)) return;
            setIsOpen(false);
            // Anything typed but not picked is not a city we can use, so put the
            // last real selection back rather than leaving a half-entered value
            // that looks accepted.
            setQuery(value);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [triggerRef, listRef, value]);

    const choose = (city: CitySuggestion) => {
        onSelect(city);
        setQuery(clearOnSelect ? '' : city.city);
        setResults([]);
        setSearchedFor('');
        setIsOpen(false);
        setActiveIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            setQuery(value);
            return;
        }
        if (!results.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
            setActiveIndex(i => (i + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => (i <= 0 ? results.length - 1 : i - 1));
        } else if (e.key === 'Enter') {
            // Only commits a highlighted suggestion. Without the guard, Enter in a
            // stepper form would submit the step with an unresolved city.
            if (activeIndex >= 0) {
                e.preventDefault();
                choose(results[activeIndex]);
            }
        }
    };

    // Never opens on an empty panel. "No matching city" requires a finished search
    // for exactly what is typed now, so re-focusing a filled field shows nothing.
    const showList = isOpen && (isLoading || results.length > 0 || searchedFor === query.trim());

    const list = (
        <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            data-floating="select"
            style={listStyle}
            className="z-[120] flex flex-col bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {results.map((city, index) => (
                    <button
                        key={`${city.slug}-${city.state}`}
                        id={`${listboxId}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(city)}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${index === activeIndex ? 'bg-white/5 text-white' : 'text-gray-300'
                            }`}
                    >
                        <span>{city.city}</span>
                        {/* The state disambiguates the repeated names - there is an
                            Aurangabad in Maharashtra and one in Bihar. */}
                        <span className="text-gray-300 ml-2 text-xs">{city.state}</span>
                    </button>
                ))}

                {!results.length && (
                    <div className="px-4 py-6 text-center text-gray-300 text-sm">
                        {isLoading
                            ? 'Searching...'
                            : lookupFailed
                                ? 'City lookup is unavailable right now. Please try again in a moment.'
                                : 'No matching city. Try the nearest larger town.'}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`relative ${className}`}>
            {label && (
                <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-2">
                    {label}
                </label>
            )}
            {/* triggerRef wraps the input alone, not the whole field.
                useFloatingList positions the list from this element's rect, so
                including the label would anchor the list to the top of the label
                instead of the input - and when the label wraps to two lines (the
                creator form's "Cities / Locations (Add multiple...)"), the list
                opened two lines clear of the box it belongs to. */}
            <div ref={triggerRef}>
            <input
                id={inputId}
                type="text"
                role="combobox"
                aria-expanded={showList}
                aria-controls={showList ? listboxId : undefined}
                aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : helperText ? helperId : undefined}
                /**
                 * Not "off". Chrome ignores autocomplete="off" on a field it has
                 * decided is an address, and drew its own saved-address dropdown
                 * over these suggestions - browser UI paints above the page, so no
                 * z-index could win that fight. Any token outside the HTML spec's
                 * list turns the autofill heuristics off instead.
                 */
                autoComplete="fira-city-lookup"
                // A name with no "city" or "address" in it, since the heuristics
                // read the name too. The value is submitted through onSelect, not
                // by form serialisation, so nothing depends on it.
                name={`lookup-${inputId}`}
                // Password managers run their own heuristics and overlay their own
                // dropdown; these opt this field out of 1Password and LastPass.
                data-1p-ignore
                data-lpignore="true"
                spellCheck={false}
                autoCapitalize="words"
                autoCorrect="off"
                value={query}
                placeholder={placeholder}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                    setActiveIndex(-1);
                    // Emptying the field clears the selection, so the form's own
                    // "City is required" check fires instead of silently keeping
                    // the previous city.
                    if (!e.target.value.trim() && value) onClear?.();
                }}
                onKeyDown={handleKeyDown}
                // One border/ring branch only - matches Input.tsx.
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 transition-all ${error
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-white/10 hover:border-violet-500/30 focus:ring-violet-500/50'
                    }`}
            />
            </div>

            {showList && isMounted && position && createPortal(list, document.body)}

            {error ? (
                <p id={errorId} role="alert" className="mt-2 text-sm text-red-400">{error}</p>
            ) : helperText ? (
                <p id={helperId} className="mt-2 text-xs text-gray-300">{helperText}</p>
            ) : null}
        </div>
    );
}
