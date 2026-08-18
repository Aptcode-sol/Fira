'use client';

import React, { useEffect, useRef, useCallback } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
}

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<Element | null>(null);

    // Capture the element that triggered the modal (Requirement 30.3)
    useEffect(() => {
        if (isOpen) {
            triggerRef.current = document.activeElement;
        }
    }, [isOpen]);

    // Focus trap: Tab/Shift+Tab cycle within modal (Requirement 30.2)
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            if (e.key !== 'Tab' || !modalRef.current) return;

            const focusable = modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
            if (focusable.length === 0) return;

            const first = focusable[0] as HTMLElement;
            const last = focusable[focusable.length - 1] as HTMLElement;

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        },
        [onClose]
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';

            // Auto-focus first focusable element inside modal
            requestAnimationFrame(() => {
                if (modalRef.current) {
                    const first = modalRef.current.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null;
                    first?.focus();
                }
            });
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, handleKeyDown]);

    // Return focus to trigger on close (Requirement 30.3)
    useEffect(() => {
        if (!isOpen && triggerRef.current) {
            (triggerRef.current as HTMLElement).focus?.();
            triggerRef.current = null;
        }
    }, [isOpen]);

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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
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
                ref={modalRef}
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
                            <h2 id="modal-title" className="text-xl font-semibold text-white">{title}</h2>
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
