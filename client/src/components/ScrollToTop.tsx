'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollToTop() {
    const pathname = usePathname();

    useEffect(() => {
        // Scroll to top on route change and initial load
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [pathname]);

    useEffect(() => {
        // Also scroll to top on page load/reload
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
    }, []);

    return null;
}
