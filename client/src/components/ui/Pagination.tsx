'use client';

/**
 * The pagination footer first written inline in the enquiry list (/messages),
 * lifted out so every dashboard list shows the same control in the same place.
 *
 * Always rendered, even at zero or one page: it tells you the list has ended
 * rather than leaving you wondering whether more is hidden below the fold, and
 * on mobile it doubles as the spacer that keeps the last row clear of the
 * bottom nav.
 */
export interface PaginationProps {
    /** 1-based. */
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
    /** Disables both arrows, e.g. while a fetch is in flight. */
    disabled?: boolean;
    /** Shown next to the counter, e.g. "24 bookings". */
    label?: string;
    className?: string;
}

export function Pagination({ page, totalPages, onChange, disabled, label, className = '' }: PaginationProps) {
    // A zero-result list still reads "1 of 1" rather than "1 of 0".
    const pages = Math.max(totalPages, 1);
    const current = Math.min(Math.max(page, 1), pages);

    return (
        <div
            className={`flex-shrink-0 flex items-center justify-center gap-4 px-4 py-3 border-t border-white/10 bg-black/20 ${className}`}
        >
            <button
                type="button"
                onClick={() => onChange(current - 1)}
                disabled={current <= 1 || disabled}
                aria-label="Previous page"
                className="p-1 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <span className="text-xs text-gray-300" aria-live="polite">
                {current} of {pages}
                {label ? <span className="text-gray-500"> · {label}</span> : null}
            </span>
            <button
                type="button"
                onClick={() => onChange(current + 1)}
                disabled={current >= pages || disabled}
                aria-label="Next page"
                className="p-1 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
}

export default Pagination;
