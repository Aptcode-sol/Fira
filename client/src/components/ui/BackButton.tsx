'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
    /**
     * Where to go when there is no history to go back to - a shared or bookmarked
     * link opened in a fresh tab. Without it, Back would do nothing on exactly the
     * visits most likely to arrive from outside the app.
     */
    fallbackHref: string;
    /** Visible text. Defaults to a plain "Back". */
    label?: string;
    className?: string;
}

/**
 * Back control for the public detail pages (event, venue, creator).
 *
 * These pages are reached from a card in a horizontally scrolled row, and the only
 * way out was the browser's own back gesture - which is invisible on desktop and
 * unreliable on a phone once a modal has pushed state. One shared component so the
 * three pages cannot drift in position, wording, or fallback behaviour.
 *
 * ponytail: `router.back()` rather than a hardcoded parent route, so it returns to
 * the list *and* the scroll position the visitor came from. The fallback only
 * applies when there is no history to return to.
 */
export default function BackButton({ fallbackHref, label = 'Back', className = '' }: BackButtonProps) {
    const router = useRouter();

    const goBack = () => {
        // history.length is 1 only when this document is the first entry in the tab,
        // which is the case for a fresh open of a shared link.
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push(fallbackHref);
        }
    };

    return (
        <button
            type="button"
            onClick={goBack}
            aria-label={label}
            className={`inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors ${className}`}
        >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}
