'use client';

import { useState, useRef, useEffect } from 'react';

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
}

export function Select({ 
    value, 
    onChange, 
    options, 
    placeholder, 
    className = '', 
    icon,
    searchable = false,
    searchPlaceholder = 'Search...'
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = searchable 
        ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : options;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
        if (!isOpen) {
            setSearchQuery('');
        }
    }, [isOpen, searchable]);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left text-sm hover:border-violet-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/50 group"
            >
                <div className="flex items-center gap-3 truncate">
                    {icon && <span className="text-gray-400 group-hover:text-violet-400 transition-colors">{icon}</span>}
                    <span className={selectedOption ? 'text-white' : 'text-gray-500'}>
                        {selectedOption ? selectedOption.label : placeholder || 'Select...'}
                    </span>
                </div>
                <svg
                    className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-violet-400' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-[#121212] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {searchable && (
                        <div className="p-2 border-b border-white/5 bg-white/[0.02]">
                            <div className="relative">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full px-9 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                                />
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                    )}
                    <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
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
                            <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
