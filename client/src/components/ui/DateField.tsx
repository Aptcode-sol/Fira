'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { displayToIso, isoToDisplay, maskDateInput } from '@/lib/dateFormat';

interface DateFieldProps {
    /** ISO yyyy-mm-dd, or '' for empty. */
    value: string;
    /** Called with ISO yyyy-mm-dd, or '' once the field is cleared. */
    onChange: (iso: string) => void;
    label?: string;
    error?: string;
    helperText?: string;
    /** ISO bounds, passed through to the picker. */
    min?: string;
    max?: string;
    id?: string;
    className?: string;
    disabled?: boolean;
}

/**
 * A date input that always reads dd/mm/yyyy.
 *
 * A native `<input type="date">` renders its text in the browser's own locale, so on an
 * en-US browser it shows mm/dd/yyyy and no attribute, CSS property or `lang` value
 * changes that. So the text is ours: a plain text input, masked as the user types.
 *
 * The native input is still here, collapsed to the calendar button, purely to borrow the
 * platform's date picker - reimplementing a calendar to get a display format would be a
 * much bigger thing to keep correct and accessible. Tapping anywhere on the field opens
 * it, which is the behaviour the rest of the app's date fields already have.
 *
 * ponytail: typed text is only pushed up once it parses to a real date, so a
 * half-finished "01/0" does not blank the stored value mid-keystroke. Ceiling - the
 * picker's own popup is still browser chrome and will show the browser's locale inside
 * the calendar; only the field text is under our control.
 */
export function DateField({
    value,
    onChange,
    label,
    error,
    helperText,
    min,
    max,
    id: externalId,
    className = '',
    disabled,
}: DateFieldProps) {
    const generatedId = useId();
    const id = externalId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const pickerRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useState(() => isoToDisplay(value));

    // Follow the stored value when it changes from outside (a form prefilled for an
    // edit, or "Clear all"). Skipped while the text already represents that same date,
    // so this cannot fight the user mid-edit.
    useEffect(() => {
        if (displayToIso(text) !== value) setText(isoToDisplay(value));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleText = (raw: string) => {
        const masked = maskDateInput(raw);
        setText(masked);
        const iso = displayToIso(masked);
        // '' covers both "cleared" and "not a valid date yet". Emitting on empty lets a
        // required-field check fire; emitting on a partial date would not.
        if (iso || masked === '') onChange(iso);
    };

    const openPicker = () => {
        if (disabled) return;
        try {
            // Absent in some browsers, and it throws unless called from a user gesture.
            // Either way the text input still accepts a typed date, so failing is fine.
            pickerRef.current?.showPicker?.();
        } catch {
            /* no-op: typing still works */
        }
    };

    const borderClass = error
        ? 'border-red-500 focus-within:ring-red-500/50'
        : 'border-white/10 focus-within:ring-violet-500/50 focus-within:border-violet-500/50';

    return (
        <div className={className}>
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">
                    {label}
                </label>
            )}
            <div
                className={`relative flex items-center w-full rounded-xl bg-white/5 border transition-all focus-within:ring-2 ${borderClass} ${disabled ? 'opacity-50' : ''}`}
            >
                <input
                    id={id}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="dd/mm/yyyy"
                    value={text}
                    disabled={disabled}
                    onChange={(e) => handleText(e.target.value)}
                    onClick={openPicker}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : helperText ? helperId : undefined}
                    className="w-full bg-transparent px-4 py-3 text-white placeholder-gray-500 focus:outline-none disabled:cursor-not-allowed"
                />
                <button
                    type="button"
                    onClick={openPicker}
                    disabled={disabled}
                    aria-label={label ? `Open calendar for ${label}` : 'Open calendar'}
                    className="px-3 py-3 text-gray-400 hover:text-violet-400 transition-colors disabled:cursor-not-allowed"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </button>
                {/* The picker only. Sized to nothing and aria-hidden so it is never
                    reached by keyboard or screen reader - the text input above is the
                    labelled control. Not `display:none`, because showPicker() throws on
                    a hidden input. */}
                <input
                    ref={pickerRef}
                    type="date"
                    tabIndex={-1}
                    aria-hidden="true"
                    value={value || ''}
                    min={min}
                    max={max}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setText(isoToDisplay(e.target.value));
                    }}
                    className="absolute right-3 bottom-0 w-0 h-0 opacity-0 pointer-events-none"
                />
            </div>
            {error ? (
                <p id={errorId} role="alert" className="mt-2 text-sm text-red-400">{error}</p>
            ) : helperText ? (
                <p id={helperId} className="mt-2 text-sm text-gray-500">{helperText}</p>
            ) : null}
        </div>
    );
}
