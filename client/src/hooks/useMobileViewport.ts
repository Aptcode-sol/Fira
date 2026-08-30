'use client';

import { useEffect, useState } from 'react';

export interface MobileViewportState {
    /** Viewport is at a phone width. Independent of VisualViewport support. */
    isMobile: boolean;
    /** Height actually visible to the user, keyboard excluded. Undefined if unsupported. */
    height?: number;
    /** How far the visual viewport is pushed down the layout viewport. */
    offsetTop?: number;
}

/**
 * Phone-width flag plus visual-viewport metrics.
 *
 * `isMobile` comes from matchMedia so it is always reliable; `height`/`offsetTop`
 * come from `window.visualViewport` and are undefined where that API is missing,
 * letting callers fall back to CSS rather than branching on user agents.
 *
 * Why the metrics matter: a `position: fixed` element is laid out against the
 * LAYOUT viewport, which does not shrink when the on-screen keyboard opens - so a
 * composer pinned to the bottom of a fixed panel ends up underneath the keyboard.
 * `interactive-widget=resizes-content` handles this on Chrome Android; iOS Safari
 * ignores it and only reports the keyboard through visualViewport.
 *
 * ponytail: Navbar has its own inline copy of this listener for lifting the bottom
 * bar off the keyboard. It works, so it is left alone; if it is ever touched again
 * it should adopt this hook rather than keep a second copy.
 */
export function useMobileViewport(maxWidth = 767): MobileViewportState {
    const [state, setState] = useState<MobileViewportState>({ isMobile: false });

    useEffect(() => {
        const query = window.matchMedia(`(max-width: ${maxWidth}px)`);
        const vv = window.visualViewport;

        const update = () => {
            const isMobile = query.matches;
            setState({
                isMobile,
                // Only meaningful on mobile; skip the numbers on desktop so a
                // resize there cannot leave a stale inline height behind.
                height: isMobile ? vv?.height : undefined,
                offsetTop: isMobile ? vv?.offsetTop : undefined,
            });
        };

        update();
        query.addEventListener('change', update);
        // resize fires when the keyboard opens/closes; scroll fires when iOS pans
        // the visual viewport inside the layout viewport.
        vv?.addEventListener('resize', update);
        vv?.addEventListener('scroll', update);

        return () => {
            query.removeEventListener('change', update);
            vv?.removeEventListener('resize', update);
            vv?.removeEventListener('scroll', update);
        };
    }, [maxWidth]);

    return state;
}
