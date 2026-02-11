'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { Button, Input } from '@/components/ui';
import { FadeIn, SlideUp } from '@/components/animations';

export default function VenuePortalSettingsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'billing'>('profile');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/venue-portal/signin');
            return;
        }

        if (!isLoading && isAuthenticated && user?.role !== 'venue_owner') {
            router.push('/dashboard');
            return;
        }
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

    if (!isAuthenticated || user?.role !== 'venue_owner') {
        return null;
    }

    return (
        <VenueDashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                        <p className="text-gray-400">Manage your account and preferences</p>
                    </div>
                </SlideUp>

                {/* Tabs */}
                <FadeIn delay={0.1}>
                    <div className="flex gap-2 mb-8 border-b border-white/10 pb-4">
                        {[
                            { id: 'profile', label: 'Profile' },
                            { id: 'notifications', label: 'Notifications' },
                            { id: 'billing', label: 'Billing' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-white text-black shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </FadeIn>

                <FadeIn delay={0.2}>
                    {activeTab === 'profile' && (
                        <div className="max-w-2xl">
                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 mb-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Profile Information</h3>
                                <div className="space-y-4">
                                    <Input
                                        label="Full Name"
                                        value={user?.name || ''}
                                        readOnly
                                    />
                                    <Input
                                        label="Email"
                                        value={user?.email || ''}
                                        readOnly
                                    />
                                    <Button variant="violet" className="shadow-lg shadow-violet-500/25">
                                        Update Profile
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Bank Details</h3>
                                <p className="text-gray-400 text-sm mb-4">
                                    Add your bank details to receive payouts from bookings.
                                </p>
                                <div className="space-y-4">
                                    <Input label="Account Holder Name" placeholder="Enter name" />
                                    <Input label="Account Number" placeholder="Enter account number" />
                                    <Input label="IFSC Code" placeholder="Enter IFSC code" />
                                    <Input label="Bank Name" placeholder="Enter bank name" />
                                    <Button variant="violet" className="shadow-lg shadow-violet-500/25">
                                        Save Bank Details
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="max-w-2xl">
                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Notification Preferences</h3>
                                <div className="space-y-4">
                                    {[
                                        { label: 'New Booking Requests', description: 'Get notified when someone books your venue' },
                                        { label: 'Event Requests', description: 'Get notified when organizers want to host events' },
                                        { label: 'Payment Received', description: 'Get notified when you receive a payment' },
                                        { label: 'Marketing Updates', description: 'Receive tips and news about FIRA' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.05] hover:border-white/[0.1] transition-all">
                                            <div>
                                                <div className="font-medium text-white">{item.label}</div>
                                                <div className="text-sm text-gray-500">{item.description}</div>
                                            </div>
                                            <button className="w-12 h-6 rounded-full bg-violet-500 relative transition-colors hover:bg-violet-400">
                                                <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white shadow-md" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="max-w-2xl">
                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 mb-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Billing Overview</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                                        <div className="text-2xl font-bold text-white">₹0</div>
                                        <div className="text-sm text-gray-400">Total Earnings</div>
                                    </div>
                                    <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                                        <div className="text-2xl font-bold text-white">₹0</div>
                                        <div className="text-sm text-gray-400">Pending Payouts</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Transaction History</h3>
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                    </div>
                                    <p className="text-gray-500">No transactions yet</p>
                                </div>
                            </div>
                        </div>
                    )}
                </FadeIn>
            </div>
        </VenueDashboardLayout>
    );
}
