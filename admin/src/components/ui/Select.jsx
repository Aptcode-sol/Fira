import React, { forwardRef } from 'react';

/**
 * Dark-themed select, matching <Input>'s geometry.
 *
 * The audit trail's filters were bare `<select>` elements with dark Tailwind classes.
 * That styles the closed control but not the option list: the popup is drawn by the
 * OS, so it came up white-on-white-highlight against a dark page, and on Windows the
 * selected value could render dark text on the dark control - unreadable until
 * clicked. Two fixes are needed and neither works alone:
 *
 *   - `[color-scheme:dark]` tells the browser to draw its native popup with the dark
 *     palette. This is the part Tailwind colour classes cannot do.
 *   - explicit `bg-zinc-900 text-white` on each <option>, because Chromium on Windows
 *     still takes option colours from the element, not the color-scheme.
 *
 * `appearance-none` plus a drawn chevron replaces the platform arrow, which was the
 * other mismatch - a light system triangle on a dark control. `pr-10` reserves room
 * for it so a long label never runs under the arrow.
 */
export const Select = forwardRef(({ label, error, options = [], className = '', ...props }, ref) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    ref={ref}
                    className={`
                        w-full appearance-none px-4 py-3 pr-10 rounded-xl
                        bg-white/5 border border-white/10
                        text-white cursor-pointer
                        focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50
                        transition-all duration-200
                        [color-scheme:dark]
                        ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
                        ${className}
                    `}
                    {...props}
                >
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
                            {opt.label}
                        </option>
                    ))}
                </select>
                <svg
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
    );
});

Select.displayName = 'Select';
