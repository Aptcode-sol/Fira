'use client';

import { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react';

interface OTPInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    error?: boolean;
}

export default function OTPInput({
    length = 4,
    value,
    onChange,
    disabled = false,
    error = false
}: OTPInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [localValue, setLocalValue] = useState<string[]>(
        value.split('').concat(Array(length - value.length).fill(''))
    );

    const handleChange = (index: number, digit: string) => {
        if (disabled) return;

        // Only allow digits
        if (digit && !/^\d$/.test(digit)) return;

        const newValue = [...localValue];
        newValue[index] = digit;
        setLocalValue(newValue);
        onChange(newValue.join(''));

        // Auto-focus next input
        if (digit && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !localValue[index] && index > 0) {
            // Focus previous input on backspace if current is empty
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text/plain').slice(0, length);

        if (!/^\d+$/.test(pastedData)) return;

        const newValue = pastedData.split('').concat(Array(length - pastedData.length).fill(''));
        setLocalValue(newValue);
        onChange(pastedData);

        // Focus the last filled input or the next empty one
        const nextIndex = Math.min(pastedData.length, length - 1);
        inputRefs.current[nextIndex]?.focus();
    };

    return (
        <div className="flex gap-3 justify-center">
            {Array.from({ length }).map((_, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`Digit ${index + 1} of ${length}`}
                    value={localValue[index] || ''}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    className={`
                        w-14 h-16 text-center text-2xl font-bold
                        bg-white/[0.05] backdrop-blur-sm
                        border-2 rounded-xl
                        transition-all duration-200
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${error
                            ? 'border-red-500/50 text-red-400 focus:border-red-500 focus:ring-red-500/50'
                            : localValue[index]
                                ? 'border-violet-500/50 text-white focus:border-violet-500 focus:ring-violet-500/50'
                                : 'border-white/[0.1] text-white focus:border-violet-500/50 focus:ring-violet-500/50'
                        }
                        hover:border-white/[0.2]
                    `}
                    autoComplete="off"
                />
            ))}
        </div>
    );
}
