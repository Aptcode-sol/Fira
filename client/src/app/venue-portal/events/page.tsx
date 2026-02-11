'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { FadeIn, SlideUp } from '@/components/animations';

export default function VenuePortalEventsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

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
            <div className="p-4 sm:p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Event Requests</h1>
                        <p className="text-sm sm:text-base text-gray-400">Review and approve event requests for your venues</p>
                    </div>
                </SlideUp>

                {/* Filter Dropdown */}
                <FadeIn delay={0.1}>
                    <div className="mb-6">
                        <div className="relative w-full sm:w-56">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                className="w-full appearance-none bg-white/[0.04] border border-white/[0.1] text-white text-sm font-medium rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer hover:bg-white/[0.06]"
                                style={{ colorScheme: 'dark' }}
                            >
                                <option value="all" className="bg-[#1a1a1a]">All Requests</option>
                                <option value="pending" className="bg-[#1a1a1a]">Pending</option>
                                <option value="approved" className="bg-[#1a1a1a]">Approved</option>
                                <option value="rejected" className="bg-[#1a1a1a]">Rejected</option>
                            </select>
                            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </FadeIn>

                {/* Empty State */}
                <FadeIn delay={0.2}>
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                            <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No event requests</h3>
                        <p className="text-gray-400">
                            Event organizers who want to host events at your venues will appear here.
                        </p>
                    </div>
                </FadeIn>
            </div>
        </VenueDashboardLayout>
    );
}
