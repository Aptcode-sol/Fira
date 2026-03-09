'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { venuesApi } from '@/lib/api';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { Button } from '@/components/ui';
import { FadeIn, SlideUp } from '@/components/animations';

interface DashboardStats {
    totalVenues: number;
    activeVenues: number;
    pendingVenues: number;
    totalBookings: number;
    pendingBookings: number;
    pendingEventRequests: number;
    totalRevenue: number;
}

interface RecentActivity {
    id: string;
    type: 'booking' | 'event_request' | 'venue';
    title: string;
    description: string;
    time: string;
    status?: string;
}

export default function VenuePortalDashboardPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        totalVenues: 0,
        activeVenues: 0,
        pendingVenues: 0,
        totalBookings: 0,
        pendingBookings: 0,
        pendingEventRequests: 0,
        totalRevenue: 0,
    });
    const [loading, setLoading] = useState(true);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

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

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!isAuthenticated || user?.role !== 'venue_owner') return;

            try {
                setLoading(true);

                // Fetch venues
                const venues = await venuesApi.getMyVenues() as any[];

                // Calculate stats
                const activeVenues = venues.filter(v => v.status === 'approved').length;
                const pendingVenues = venues.filter(v => v.status === 'pending').length;

                setStats({
                    totalVenues: venues.length,
                    activeVenues,
                    pendingVenues,
                    totalBookings: 0,
                    pendingBookings: 0, // Placeholder
                    pendingEventRequests: 0, // Placeholder
                    totalRevenue: 0, // Placeholder
                });

                // Set recent activity from venues
                const activities: RecentActivity[] = venues.slice(0, 5).map(v => ({
                    id: v._id,
                    type: 'venue' as const,
                    title: v.name,
                    description: `Venue ${v.status === 'approved' ? 'is active' : 'pending approval'}`,
                    time: new Date(v.createdAt).toLocaleDateString(),
                    status: v.status,
                }));
                setRecentActivity(activities);

            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated && user?.role === 'venue_owner') {
            fetchDashboardData();
        }
    }, [isAuthenticated, user]);

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
                    <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 break-words max-w-full">
                                Welcome back, {user?.name}! 👋
                            </h1>
                            <p className="text-sm sm:text-base text-gray-400">Here's what's happening with your venues.</p>
                        </div>
                        <Link href="/venue-portal/venues/create">
                            <Button variant="violet" className="shadow-lg shadow-violet-500/25 w-full sm:w-auto">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add New Venue
                            </Button>
                        </Link>
                    </div>
                </SlideUp>

                {/* Stats Grid */}
                <FadeIn delay={0.1}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                        {[
                            {
                                label: 'Total Venues',
                                value: stats.totalVenues,
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                    </svg>
                                ),
                                color: 'violet'
                            },
                            {
                                label: 'Active Venues',
                                value: stats.activeVenues,
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ),
                                color: 'green'
                            },
                            {
                                label: 'Pending Approval',
                                value: stats.pendingVenues,
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ),
                                color: 'yellow'
                            },
                            {
                                label: 'Event Requests',
                                value: stats.pendingEventRequests,
                                icon: (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                ),
                                color: 'blue'
                            },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-4 sm:p-5 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 group cursor-pointer h-full">
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl mb-3 sm:mb-4 flex items-center justify-center group-hover:scale-105 transition-transform ${stat.color === 'violet' ? 'bg-violet-500/20 text-violet-400' :
                                    stat.color === 'green' ? 'bg-green-500/20 text-green-400' :
                                        stat.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-blue-500/20 text-blue-400'
                                    }`}>
                                    {stat.icon}
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-white mb-0.5 sm:mb-1">
                                    {loading ? (
                                        <div className="w-10 sm:w-12 h-6 sm:h-7 bg-white/10 rounded animate-pulse" />
                                    ) : (
                                        stat.value.toLocaleString()
                                    )}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-400">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </FadeIn>

                {/* Revenue Section */}
                <FadeIn delay={0.2}>
                    <div className="bg-gradient-to-br from-violet-500/10 to-pink-500/10 backdrop-blur-sm border border-violet-500/20 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 group hover:border-violet-500/30 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                                    <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Total Revenue</h3>
                                    <p className="text-sm text-gray-400">All-time earnings from bookings</p>
                                </div>
                            </div>
                            <Link href="/venue-portal/analytics" className="text-violet-400 hover:text-violet-300 text-sm font-medium flex items-center gap-1 group/link">
                                View Details
                                <svg className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-4xl md:text-5xl font-bold text-white">
                                ₹{(stats.totalRevenue / 1000).toFixed(stats.totalRevenue >= 1000 ? 1 : 0)}{stats.totalRevenue >= 1000 ? 'K' : ''}
                            </span>
                            <span className="text-green-400 text-sm font-medium flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-full">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                +0% this month
                            </span>
                        </div>
                    </div>
                </FadeIn>

                <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Quick Actions */}
                    <FadeIn delay={0.3}>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-4 sm:p-6 h-full">
                            <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Quick Actions</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    {
                                        label: 'Add New Venue', href: '/venue-portal/venues/create', icon: (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                            </svg>
                                        )
                                    },
                                    {
                                        label: 'View Bookings', href: '/venue-portal/bookings', icon: (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        )
                                    },
                                    {
                                        label: 'Event Requests', href: '/venue-portal/events', icon: (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                            </svg>
                                        )
                                    },
                                    {
                                        label: 'View Analytics', href: '/venue-portal/analytics', icon: (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        )
                                    },
                                ].map((action, i) => (
                                    <Link
                                        key={i}
                                        href={action.href}
                                        className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:bg-violet-500/20 group-hover:scale-105 transition-all">
                                            {action.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-200">{action.label}</div>
                                        </div>
                                        <svg className="w-5 h-5 text-gray-500 group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </FadeIn>

                    {/* Recent Activity */}
                    <FadeIn delay={0.4}>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-4 sm:p-6 h-full flex flex-col">
                            <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Recent Activity</h2>
                            <div className="space-y-4 flex-1">
                                {recentActivity.length > 0 ? (
                                    recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex items-start gap-4 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.05]">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activity.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                                activity.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-violet-500/20 text-violet-400'
                                                }`}>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-medium truncate">{activity.title}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">{activity.description}</div>
                                            </div>
                                            <div className="text-xs text-gray-500 whitespace-nowrap hidden sm:block">{activity.time}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-gray-500">No recent activity</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </div>
        </VenueDashboardLayout>
    );
}
