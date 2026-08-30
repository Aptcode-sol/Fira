'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SettingsContent from '@/components/dashboard/SettingsContent';

/**
 * Settings, in the user dashboard shell.
 *
 * The screen itself is shared with /venue-portal/settings - see SettingsContent.
 * This route only supplies the layout.
 */
export default function SettingsPage() {
    return (
        <DashboardLayout>
            <SettingsContent />
        </DashboardLayout>
    );
}
