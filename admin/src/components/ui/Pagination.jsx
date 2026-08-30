/**
 * The admin dashboard's pager.
 *
 * This markup was copy-pasted into Users, Venues, Events and Brands, and the audit
 * trail had a cut-down version with only Previous/Next - so the one page you most want
 * to jump around in was the one you could only walk through. One component instead.
 */

import { pageWindow } from '../../lib/pageWindow';

export function Pagination({ currentPage, totalPages, onChange, className = '' }) {
    if (totalPages <= 1) return null;

    const go = page => {
        const next = Math.min(Math.max(1, page), totalPages);
        if (next !== currentPage) onChange(next);
    };

    return (
        <nav
            aria-label="Pagination"
            className={`p-4 border-t border-white/[0.05] flex justify-center ${className}`}
        >
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => go(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="px-3 py-1 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                {pageWindow(currentPage, totalPages).map(page => (
                    <button
                        key={page}
                        type="button"
                        onClick={() => go(page)}
                        // aria-current is how a screen reader announces which page you are
                        // on; the violet fill only says it to people who can see it.
                        aria-current={currentPage === page ? 'page' : undefined}
                        aria-label={`Page ${page}`}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${currentPage === page
                            ? 'bg-violet-500 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        {page}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => go(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        </nav>
    );
}
