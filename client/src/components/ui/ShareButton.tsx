'use client';

import { useToast } from './Toast';

interface ShareButtonProps {
    /** What is being shared - becomes the share sheet's title. */
    title: string;
    /** Optional one-line description for the share sheet. */
    text?: string;
    /**
     * Absolute or app-relative URL to share. Defaults to the current page, which
     * is what every current caller wants.
     */
    url?: string;
    /** Visible text. Pass '' for an icon-only button. */
    label?: string;
    className?: string;
}

/**
 * Share control for the public detail pages (event, venue, creator).
 *
 * Two paths, in this order:
 *   1. `navigator.share` - the OS share sheet. On a phone this is the only route to
 *      WhatsApp / Instagram, which is how these links actually travel.
 *   2. Clipboard copy + a toast. Desktop browsers mostly have no share sheet.
 *
 * Both are behind a real click because `navigator.share` throws without a user
 * gesture, and an `AbortError` from the user dismissing the sheet is not a failure -
 * it is swallowed rather than reported, so cancelling does not raise an error toast.
 */
export default function ShareButton({
    title,
    text,
    url,
    label = 'Share',
    className = '',
}: ShareButtonProps) {
    const { showToast } = useToast();

    const share = async () => {
        // Resolved against the current origin so a caller can pass '/events/123'.
        const href = url ? new URL(url, window.location.origin).toString() : window.location.href;

        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({ title, text, url: href });
                return;
            } catch (err) {
                // Dismissing the sheet lands here too. Only fall through to copy for
                // real failures; treat a cancel as done.
                if (err instanceof Error && err.name === 'AbortError') return;
            }
        }

        try {
            await navigator.clipboard.writeText(href);
            showToast('Link copied to clipboard', 'success');
        } catch {
            // Clipboard needs a secure context and permission. Nothing useful is left
            // to try, so say so instead of failing silently.
            showToast('Could not share this link. Copy it from the address bar.', 'error');
        }
    };

    return (
        <button
            type="button"
            onClick={share}
            aria-label={label ? undefined : `Share ${title}`}
            className={`inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors ${className}`}
        >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684zm0-12a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z"
                />
            </svg>
            {label && <span className="text-sm font-medium">{label}</span>}
        </button>
    );
}
