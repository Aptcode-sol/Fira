'use client';

import { usePathname } from 'next/navigation';
import Footer from '@/components/Footer';
import FloatingActionButton from '@/components/FloatingActionButton';
import RouteGuard from '@/components/RouteGuard';
import { useSSENotifications } from '@/hooks/useSSENotifications';
import { useFocusOnRouteChange } from '@/hooks/useFocusOnRouteChange';

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isVenuePortal = pathname?.startsWith('/venue-portal');

    // Establish SSE connection for real-time notifications when authenticated
    useSSENotifications();

    // Move focus to main content on route change (Requirement 30.1)
    useFocusOnRouteChange();

    return (
        <>
            <RouteGuard>
                {children}
            </RouteGuard>
            {!isVenuePortal && <FloatingActionButton />}
            {!isVenuePortal && <Footer />}
        </>
    );
}

