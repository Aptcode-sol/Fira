'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { FadeIn, SlideUp } from '@/components/animations';

export default function VenuePortalAnalyticsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();

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
                        <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
                        <p className="text-gray-400">Track your venue performance</p>
                    </div>
                </SlideUp>

                {/* Stats Grid */}
                <FadeIn delay={0.1}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: 'Total Views', value: '0', change: '+0%', color: 'violet' },
                            { label: 'Bookings', value: '0', change: '+0%', color: 'green' },
                            { label: 'Revenue', value: '₹0', change: '+0%', color: 'blue' },
                            { label: 'Avg Rating', value: '0.0', change: '—', color: 'yellow' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 group cursor-pointer">
                                <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">{stat.label}</span>
                                    <span className={`text-xs ${stat.change.includes('+') ? 'text-green-400' : 'text-gray-500'}`}>{stat.change}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </FadeIn>

                {/* Charts Section */}
                <FadeIn delay={0.2}>
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Bookings Over Time</h3>
                            <div className="h-48 flex items-center justify-center border border-dashed border-white/10 rounded-xl p-4 text-center">
                                <p className="text-gray-500 text-sm sm:text-base">Chart will appear when you have data</p>
                            </div>
                        </div>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Revenue Breakdown</h3>
                            <div className="h-48 flex items-center justify-center border border-dashed border-white/10 rounded-xl p-4 text-center">
                                <p className="text-gray-500 text-sm sm:text-base">Chart will appear when you have data</p>
                            </div>
                        </div>
                    </div>
                </FadeIn>

                {/* Top Performing Venues */}
                <FadeIn delay={0.3}>
                    <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Top Performing Venues</h3>
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <p className="text-gray-500">No venue data available yet</p>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </VenueDashboardLayout>
    );
}
