import { useState, useRef, useEffect } from 'react';

/**
 * Custom styled dropdown replacing native <select> so the popup matches the dark
 * theme. Native selects render their option list with the OS widget, which ignores
 * CSS — on Windows/Mac it appears as a light panel against the dark admin page.
 *
 * Keyboard: Enter/Space open, ArrowDown/Up navigate, Enter selects, Escape closes.
 * Click outside closes. Inherits the same geometry as the admin Select component.
 */
export default function Dropdown({ value, onChange, options = [], label, className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const containerRef = useRef(null);

    const selected = options.find((o) => o.value === value);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const select = (opt) => {
        // Simulate native select onChange shape
        onChange({ target: { value: opt.value } });
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { setIsOpen(false); return; }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen) { setIsOpen(true); setFocusedIndex(options.findIndex((o) => o.value === value)); return; }
            if (focusedIndex >= 0) select(options[focusedIndex]);
            return;
        }
        if (!isOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex((i) => Math.max(i - 1, 0));
        }
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            {label && <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>}
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setFocusedIndex(options.findIndex((o) => o.value === value)); }}
                onKeyDown={handleKeyDown}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={selected?.label ? 'text-white' : 'text-gray-500'}>
                    {selected?.label || 'Select...'}
                </span>
                <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div
                    role="listbox"
                    className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl bg-[#121212] border border-white/10 shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150"
                >
                    {options.map((opt, index) => (
                        <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={opt.value === value}
                            onMouseEnter={() => setFocusedIndex(index)}
                            onClick={() => select(opt)}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                opt.value === value
                                    ? 'bg-violet-500/20 text-violet-300'
                                    : index === focusedIndex
                                    ? 'bg-white/5 text-white'
                                    : 'text-gray-300 hover:bg-white/5'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
