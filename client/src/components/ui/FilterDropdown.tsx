'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Option {
    value: string;
    label: string;
}

interface FilterDropdownProps {
    label: string;
    value: string;
    options: Option[];
    onChange: (value: string) => void;
}

export default function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        // Shrinkable by construction: min-w-0 plus flex-1, and a truncating label
        // inside the trigger. Without these the control demanded its full intrinsic
        // width, so a row of two filters was wider than a phone - it happened to fit
        // on iOS and wrapped to two lines on Android, whose default font is wider.
        // A layout that depends on font metrics is a layout that breaks per device.
        <div className="flex items-center gap-2 min-w-0">
            <label className="text-sm text-gray-300 flex-shrink-0">{label}</label>
            <div className="relative min-w-0 flex-1" ref={dropdownRef}>
                {/* Trigger Button */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center bg-white/[0.05] border border-white/[0.1] text-white rounded-xl px-3 py-2.5 pr-9 text-sm font-medium hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                >
                    <span className="truncate">{selectedOption?.label || 'Select...'}</span>
                    <svg
                        className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute right-0 mt-2 min-w-[160px] z-50 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/[0.1] rounded-xl shadow-xl shadow-black/50 overflow-hidden">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${option.value === value
                                    ? 'bg-violet-500/20 text-violet-300'
                                    : 'text-gray-300 hover:bg-white/[0.08] hover:text-white'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
