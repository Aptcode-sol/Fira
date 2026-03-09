'use client';

import { usePathname } from 'next/navigation';
import Footer from '@/components/Footer';
import FloatingActionButton from '@/components/FloatingActionButton';
import RouteGuard from '@/components/RouteGuard';

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isVenuePortal = pathname?.startsWith('/venue-portal');

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

