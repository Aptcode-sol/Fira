'use client';

import { usePathname } from 'next/navigation';
import Footer from '@/components/Footer';
import FloatingActionButton from '@/components/FloatingActionButton';
import CreateVenueLauncher from '@/components/modals/CreateVenueLauncher';
import CreateEventLauncher from '@/components/modals/CreateEventLauncher';
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
            {/* Mounted on every route, including the venue portal, so "Add venue"
                and "Create event" buttons anywhere open these in place - and
                dismissing them leaves the user on the page they started from. */}
            <CreateVenueLauncher />
            <CreateEventLauncher />
            {!isVenuePortal && <Footer />}
        </>
    );
}

