'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Moves keyboard focus to #main-content within 100ms of a client-side route change.
 * Requirement 30.1: focus moves to main content landmark on route transition.
 */
export function useFocusOnRouteChange() {
    const pathname = usePathname();
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Skip the initial mount — only focus on subsequent navigations
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = setTimeout(() => {
            const main = document.getElementById('main-content');
            if (main) {
                main.focus({ preventScroll: false });
            }
        }, 50); // well within the 100ms requirement

        return () => clearTimeout(timer);
    }, [pathname]);
}
