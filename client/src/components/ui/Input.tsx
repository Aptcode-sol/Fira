'use client';

import React, { forwardRef, useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helperText, leftIcon, rightIcon, className = '', id: externalId, ...props }, ref) => {
        const generatedId = useId();
        const inputId = externalId || generatedId;
        const errorId = `${inputId}-error`;
        const helperId = `${inputId}-helper`;

        // Build aria-describedby from present descriptors
        const describedBy = [
            error ? errorId : null,
            helperText && !error ? helperId : null,
        ].filter(Boolean).join(' ') || undefined;

        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-2">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy}
                        /*
                         * Border and ring colours are emitted for exactly one state,
                         * never both.
                         *
                         * This previously always included `border-white/10` and then
                         * appended `border-red-500/50` when errored. Both have the same
                         * CSS specificity, so which one wins is decided by their order in
                         * the generated stylesheet - not by their order in this string.
                         * The result was that some inputs showed a red border and others
                         * did not, for the same error state. Picking one branch removes
                         * the conflict entirely.
                         */
                        className={`
              w-full px-4 py-3 rounded-xl
              bg-white/5 border
              text-white placeholder-gray-500
              focus:outline-none focus:ring-2
              transition-all duration-200
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${error
                                ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500'
                                : 'border-white/10 focus:ring-violet-500/50 focus:border-violet-500/50'}
              ${className}
            `}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 flex items-center justify-center">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && (
                    <p id={errorId} role="alert" className="mt-2 text-sm text-red-400">{error}</p>
                )}
                {helperText && !error && (
                    <p id={helperId} className="mt-2 text-sm text-gray-300">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
