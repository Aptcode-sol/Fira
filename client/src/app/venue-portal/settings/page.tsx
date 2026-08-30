'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import SettingsContent from '@/components/dashboard/SettingsContent';

/**
 * Settings, in the venue portal shell.
 *
 * This page used to be its own implementation and none of it worked: the profile
 * inputs were readOnly, "Save Bank Details" had no handler, the notification
 * toggles were static markup, and Billing showed a hardcoded ₹0. It now renders
 * the same SettingsContent as /dashboard/settings, so a venue owner gets the
 * controls that actually save.
 */
export default function VenuePortalSettingsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        if (isLoading) return;
        if (!isAuthenticated) {
            router.push('/signin');
            return;
        }
        // Non-owners have the identical screen at /dashboard/settings; sending them
        // there keeps one portal per audience.
        if (!isVenueOwner(user)) router.push('/dashboard');
    }, [isLoading, isAuthenticated, user, router]);

    if (isLoading) {
        return (
            <VenueDashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </VenueDashboardLayout>
        );
    }

    if (!isAuthenticated || !isVenueOwner(user)) return null;

    return (
        <VenueDashboardLayout>
            <SettingsContent />
        </VenueDashboardLayout>
    );
}
