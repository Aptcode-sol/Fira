'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingList } from '@/hooks/useFloatingList';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    icon?: React.ReactNode;
    searchable?: boolean;
    searchPlaceholder?: string;
    label?: string;
    error?: string;
    id?: string;
}

export function Select({
    value,
    onChange,
    options,
    placeholder,
    className = '',
    icon,
    searchable = false,
    searchPlaceholder = 'Search...',
    label,
    error,
    id: externalId,
}: SelectProps) {
    const generatedId = useId();
    const selectId = externalId || generatedId;
    const errorId = `${selectId}-error`;
    const listboxId = `${selectId}-listbox`;

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Portalling + positioning is shared with MultiSelect.
    const { triggerRef, listRef, position, isMounted, listStyle } = useFloatingList(isOpen);

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = searchable
        ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : options;

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
        if (isOpen && searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
        if (!isOpen) {
            setSearchQuery('');
        }
    }, [isOpen, searchable]);

    const list = (
        <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            // Marks this as a floating layer rendered outside its logical parent.
            // Panels with their own click-outside handling look for this so that
            // choosing an option here does not read as a click outside them.
            data-floating="select"
            style={listStyle}
            // z-[120] keeps it above the other body-level layers (the filter dialog
            // sits at z-[80], the mobile chat panel at z-[70]).
            className="z-[120] flex flex-col bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
            {searchable && (
                <div className="p-2 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
                    <div className="relative">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full px-9 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={value === option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center justify-between group ${value === option.value ? 'text-violet-400 bg-violet-400/5' : 'text-gray-300'
                                }`}
                        >
                            <span>{option.label}</span>
                            {value === option.value && (
                                <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    ))
                ) : (
                    <div className="px-4 py-8 text-center text-gray-300 text-sm">
                        No results found
                    </div>
                )}
            </div>
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
                onClick={() => setIsOpen(!isOpen)}
                // One border/ring branch only - see the note in Input.tsx about why
                // emitting both colours makes the error state unreliable.
                className={`w-full flex items-center justify-between px-4 py-3 bg-white/5 border rounded-xl text-left text-sm transition-all focus:outline-none focus:ring-2 group ${error
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-white/10 hover:border-violet-500/30 focus:ring-violet-500/50'
                    }`}
            >
                <div className="flex items-center gap-3 truncate">
                    {icon && <span className="text-gray-400 group-hover:text-violet-400 transition-colors">{icon}</span>}
                    <span className={selectedOption ? 'text-white' : 'text-gray-300'}>
                        {selectedOption ? selectedOption.label : placeholder || 'Select...'}
                    </span>
                </div>
                <svg
                    className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${isOpen ? 'rotate-180 text-violet-400' : ''}`}
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
