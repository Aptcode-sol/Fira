'use client';

import React, { useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
}: ModalProps) {
    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizes = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-4xl',
    };

    return (
        // p-4 guarantees the panel never touches the viewport edges.
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content
                Capped to the viewport and laid out as a column: the header stays
                pinned while only the body scrolls. Without the cap a tall form
                (the venue booking one) overflowed past the top and bottom of the
                screen with no way to reach either end.
                dvh rather than vh so mobile browser chrome does not push the
                bottom of the panel out of reach. */}
            <div
                className={`
          relative w-full ${sizes[size]}
          max-h-[calc(100dvh-2rem)] flex flex-col
          bg-[#0a0a0a] border border-white/10 rounded-2xl
          shadow-2xl shadow-black/50
          animate-fade-in
        `}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between gap-4 p-6 border-b border-white/5 shrink-0">
                        {title && (
                            <h2 className="text-xl font-semibold text-white">{title}</h2>
                        )}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="shrink-0 ml-auto text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {/* Body - the only scrollable region */}
                <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    {children}
                </div>
            </div>
        </div>
    );
}
