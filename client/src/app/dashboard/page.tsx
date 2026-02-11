'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { dashboardApi, DashboardOverview, usersApi } from '@/lib/api';
import { FadeIn, SlideUp } from '@/components/animations';
import { X, Users } from 'lucide-react';

interface FollowingBrand {
    _id: string;
    name: string;
    type: string;
    bio: string;
    profilePhoto: string | null;
    stats: { followers: number; events: number };
    user?: { _id: string; name: string };
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const [dashboardData, setDashboardData] = useState<DashboardOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [followingBrands, setFollowingBrands] = useState<FollowingBrand[]>([]);
    const [followingCount, setFollowingCount] = useState(0);
    const [showFollowingModal, setShowFollowingModal] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin?redirect=/dashboard');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user?._id) return;
            try {
                setLoading(true);
                setError(null);
                const data = await dashboardApi.getOverview(user._id);
                setDashboardData(data);
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
                setError('Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };
        if (isAuthenticated && user?._id) {
            fetchDashboardData();
        }
    }, [isAuthenticated, user?._id]);

    // Fetch following brands
    useEffect(() => {
        const fetchFollowingBrands = async () => {
            if (!user?._id) return;
            try {
                const data = await usersApi.getFollowingBrands(user._id);
                setFollowingBrands(data.brands);
                setFollowingCount(data.count);
            } catch (err) {
                console.error('Failed to fetch following brands:', err);
            }
        };
        if (isAuthenticated && user?._id) {
            fetchFollowingBrands();
        }
    }, [isAuthenticated, user?._id]);

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const stats = dashboardData?.stats;

    const quickStats = [
        {
            label: 'Events Organizing',
            value: stats?.upcomingEventsOrganizing ?? 0,
            subValue: stats?.eventsOrganizing ? `${stats.eventsOrganizing} total` : null,
            icon: 'calendar',
            color: 'violet',
            href: '/dashboard/events'
        },
        {
            label: 'Events Attending',
            value: stats?.eventsAttending ?? 0,
            subValue: stats?.activeTickets ? `${stats.activeTickets} tickets` : null,
            icon: 'ticket',
            color: 'green',
            href: '/dashboard/tickets'
        },
        {
            label: 'Venues',
            value: stats?.venuesOwned ?? 0,
            subValue: null,
            icon: 'building',
            color: 'blue',
            href: '/dashboard/venues'
        },
        {
            label: 'Total Attendees',
            value: stats?.totalAttendees ?? 0,
            subValue: stats?.totalRevenue ? `₹${(stats.totalRevenue / 1000).toFixed(1)}K revenue` : null,
            icon: 'users',
            color: 'pink',
            href: '/dashboard/analytics'
        },
    ];

    const getIcon = (name: string) => {
        const icons: Record<string, React.ReactNode> = {
            'calendar': (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            'ticket': (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
            ),
            'building': (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                </svg>
            ),
            'users': (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
        };
        return icons[name] || null;
    };

    const colorClasses: Record<string, string> = {
        violet: 'bg-violet-500/20 text-violet-400',
        green: 'bg-green-500/20 text-green-400',
        blue: 'bg-blue-500/20 text-blue-400',
        pink: 'bg-pink-500/20 text-pink-400',
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    };

    const getActivityIcon = (category: string) => {
        switch (category) {
            case 'events':
                return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
            case 'bookings':
                return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /></svg>;
            default:
                return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>;
        }
    };

    const getActivityColor = (category: string) => {
        switch (category) {
            case 'events': return 'bg-violet-500/20 text-violet-400';
            case 'bookings': return 'bg-blue-500/20 text-blue-400';
            case 'payments': return 'bg-emerald-500/20 text-emerald-400';
            default: return 'bg-green-500/20 text-green-400';
        }
    };

    const formatEventDate = (dateString: string) => {
        const date = new Date(dateString);
        return {
            month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
            day: date.getDate()
        };
    };

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Welcome back, {user?.name?.split(' ')[0]}! 👋
                            </h1>
                            <p className="text-gray-400">Here&apos;s what&apos;s happening with your account.</p>
                        </div>
                        <button
                            onClick={() => setShowFollowingModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl transition-all duration-200 group"
                        >
                            <Users className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
                            <span className="text-white font-medium">Following</span>
                            <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full text-sm font-semibold">
                                {followingCount}
                            </span>
                        </button>
                    </div>
                </SlideUp>

                {/* Error State */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                        {error}
                    </div>
                )}

                {/* Quick Stats */}
                <FadeIn delay={0.1}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {quickStats.map((stat) => (
                            <Link key={stat.label} href={stat.href}>
                                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 group cursor-pointer h-full">
                                    <div className={`w-12 h-12 rounded-xl ${colorClasses[stat.color]} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                                        {getIcon(stat.icon)}
                                    </div>
                                    <div className="text-2xl font-bold text-white mb-1">
                                        {loading ? (
                                            <div className="w-12 h-7 bg-white/10 rounded animate-pulse" />
                                        ) : (
                                            stat.value.toLocaleString()
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-400">{stat.label}</div>
                                    {/* Always render this row to maintain consistent height */}
                                    <div className="text-xs text-gray-500 mt-1 min-h-[1rem]">
                                        {!loading && stat.subValue ? stat.subValue : '\u00A0'}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </FadeIn>

                {/* Quick Actions */}
                <FadeIn delay={0.2}>
                    <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 mb-8">
                        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                        <div className="flex flex-wrap gap-3">
                            <Link href="/create/event">
                                <Button variant="secondary">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create Event
                                </Button>
                            </Link>
                            <Link href="/venues">
                                <Button variant="secondary">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    Browse Venues
                                </Button>
                            </Link>
                            <Link href="/events">
                                <Button variant="secondary">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Find Events
                                </Button>
                            </Link>
                            {/* Creator Status Button - Dynamic based on user state */}
                            {(() => {
                                const isCreator = user?.verificationBadge && ['brand', 'band', 'organizer'].includes(user.verificationBadge);
                                const applicationStatus = user?.creatorApplicationStatus; // pending, rejected, or undefined

                                if (isCreator) {
                                    return (
                                        <Link href="/dashboard/creator">
                                            <Button variant="secondary" className="bg-violet-500/20 border-violet-500/30 text-violet-400 hover:bg-violet-500/30">
                                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                Verified Creator
                                            </Button>
                                        </Link>
                                    );
                                } else if (applicationStatus === 'pending') {
                                    return (
                                        <Button variant="secondary" className="bg-yellow-500/20 border-yellow-500/30 text-yellow-400 cursor-default" disabled>
                                            <svg className="w-4 h-4 mr-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Application Pending
                                        </Button>
                                    );
                                } else if (applicationStatus === 'rejected') {
                                    return (
                                        <Link href="/create/creator">
                                            <Button variant="secondary" className="bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30">
                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                Application Rejected - Reapply
                                            </Button>
                                        </Link>
                                    );
                                } else {
                                    return (
                                        <Link href="/create/creator">
                                            <Button variant="secondary">
                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                                </svg>
                                                Apply as Creator
                                            </Button>
                                        </Link>
                                    );
                                }
                            })()}
                        </div>
                    </div>
                </FadeIn>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Your Organized Events */}
                    <FadeIn delay={0.1}>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 h-full flex flex-col">
                            <h2 className="text-lg font-semibold text-white mb-4">Your Organized Events</h2>
                            <div className="space-y-4 flex-1">
                                {loading ? (
                                    [...Array(3)].map((_, i) => (
                                        <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                            <div className="w-14 h-14 rounded-xl bg-white/10 animate-pulse" />
                                            <div className="flex-1">
                                                <div className="w-3/4 h-4 bg-white/10 rounded animate-pulse mb-2" />
                                                <div className="w-1/2 h-3 bg-white/10 rounded animate-pulse" />
                                            </div>
                                        </div>
                                    ))
                                ) : dashboardData?.organizedEvents && dashboardData.organizedEvents.length > 0 ? (
                                    dashboardData.organizedEvents.map((event) => {
                                        const { month, day } = formatEventDate(event.date);
                                        const attendeePercent = Math.round((event.currentAttendees / event.maxAttendees) * 100);
                                        return (
                                            <Link key={event._id} href={`/events/${event._id}`}>
                                                <div className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors cursor-pointer">
                                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/30 to-pink-500/30 flex items-center justify-center flex-shrink-0">
                                                        <div className="text-center">
                                                            <div className="text-xs text-gray-400">{month}</div>
                                                            <div className="text-lg font-bold text-white">{day}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">{event.name}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {event.startTime} • {event.venue?.name || 'TBA'}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-violet-500 rounded-full transition-all"
                                                                    style={{ width: `${Math.min(attendeePercent, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-gray-500">
                                                                {event.currentAttendees}/{event.maxAttendees}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {event.isFeatured && (
                                                        <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">Featured</span>
                                                    )}
                                                </div>
                                            </Link>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-6">
                                        <p className="text-sm text-gray-500 mb-3">No events organized yet</p>
                                        <Link href="/create/event">
                                            <Button variant="secondary" size="sm">Create Your First Event</Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                            {dashboardData?.organizedEvents && dashboardData.organizedEvents.length > 0 && (
                                <Link href="/dashboard/events" className="block mt-4 text-sm text-violet-400 hover:text-violet-300">
                                    View all events →
                                </Link>
                            )}
                        </div>
                    </FadeIn>

                    {/* Recent Activity */}
                    <FadeIn delay={0.2}>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 h-full flex flex-col">
                            <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                            <div className="space-y-4 flex-1">
                                {loading ? (
                                    [...Array(3)].map((_, i) => (
                                        <div key={i} className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
                                            <div className="flex-1">
                                                <div className="w-3/4 h-4 bg-white/10 rounded animate-pulse mb-2" />
                                                <div className="w-1/4 h-3 bg-white/10 rounded animate-pulse" />
                                            </div>
                                        </div>
                                    ))
                                ) : dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 ? (
                                    dashboardData.recentActivity.map((activity) => (
                                        <div key={activity._id} className="flex items-start gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.category)}`}>
                                                {getActivityIcon(activity.category)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white">{activity.title}</p>
                                                {activity.message && (
                                                    <p className="text-xs text-gray-500 truncate">{activity.message}</p>
                                                )}
                                                <p className="text-xs text-gray-500 mt-1">{formatTime(activity.createdAt)}</p>
                                            </div>
                                            {!activity.isRead && (
                                                <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                                )}
                            </div>
                            <Link href="/dashboard/notifications" className="block mt-4 text-sm text-violet-400 hover:text-violet-300">
                                View all activity →
                            </Link>
                        </div>
                    </FadeIn>
                </div>

                {/* Your Venues Section */}
                {dashboardData?.venues && dashboardData.venues.length > 0 && (
                    <FadeIn>
                        <div className="mt-6 bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-white">Your Venues</h2>
                                <Link href="/dashboard/venues" className="text-sm text-violet-400 hover:text-violet-300">
                                    View all →
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {dashboardData.venues.slice(0, 3).map((venue) => (
                                    <Link key={venue._id} href={`/venues/${venue._id}`}>
                                        <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden hover:bg-white/[0.04] transition-colors cursor-pointer">
                                            <div className="h-32 bg-gradient-to-br from-violet-500/20 to-pink-500/20 relative">
                                                {venue.images?.[0] && (
                                                    <img
                                                        src={venue.images[0]}
                                                        alt={venue.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                                <span className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs ${venue.status === 'approved'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                    {venue.status}
                                                </span>
                                            </div>
                                            <div className="p-4">
                                                <h3 className="font-medium text-white truncate">{venue.name}</h3>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {venue.address?.city}, {venue.address?.state}
                                                </p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-sm text-gray-400">
                                                        ₹{venue.pricing?.basePrice?.toLocaleString()}
                                                    </span>
                                                    {venue.rating?.average > 0 && (
                                                        <span className="text-sm text-yellow-400">
                                                            ⭐ {venue.rating.average.toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </FadeIn>
                )}

                {/* Creator Profile Card */}
                {dashboardData?.brandProfile && (
                    <FadeIn>
                        <div className="mt-6 bg-gradient-to-r from-violet-500/10 to-pink-500/10 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500/30 to-pink-500/30 overflow-hidden">
                                    {dashboardData.brandProfile.profilePhoto ? (
                                        <img
                                            src={dashboardData.brandProfile.profilePhoto}
                                            alt={dashboardData.brandProfile.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl text-white">
                                            {dashboardData.brandProfile.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold text-white">{dashboardData.brandProfile.name}</h3>
                                        <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-xs capitalize">
                                            {dashboardData.brandProfile.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                                        <span>{dashboardData.brandProfile.followers.toLocaleString()} followers</span>
                                        <span>{dashboardData.brandProfile.events} events</span>
                                    </div>
                                </div>
                                <Link href={`/creators/${dashboardData.brandProfile._id}`}>
                                    <Button variant="secondary" size="sm">View Profile</Button>
                                </Link>
                            </div>
                        </div>
                    </FadeIn>
                )}
            </div>

            {/* Following Brands Modal */}
            {showFollowingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowFollowingModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h2 className="text-xl font-bold text-white">Following Creators</h2>
                            <button
                                onClick={() => setShowFollowingModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto max-h-[60vh] p-4">
                            {followingBrands.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400 mb-4">You&apos;re not following any creators yet</p>
                                    <Link href="/creators" onClick={() => setShowFollowingModal(false)}>
                                        <Button variant="secondary" size="sm">Discover Creators</Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {followingBrands.map((brand) => (
                                        <Link
                                            key={brand._id}
                                            href={`/creators/${brand._id}`}
                                            onClick={() => setShowFollowingModal(false)}
                                        >
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] transition-colors cursor-pointer">
                                                {/* Profile Photo */}
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/30 to-pink-500/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {brand.profilePhoto ? (
                                                        <img
                                                            src={brand.profilePhoto}
                                                            alt={brand.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-lg font-bold text-white">
                                                            {brand.name.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-white truncate">{brand.name}</h3>
                                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                                        <span className="capitalize">{brand.type}</span>
                                                        <span>•</span>
                                                        <span>{brand.stats.followers} followers</span>
                                                    </div>
                                                </div>

                                                {/* Arrow */}
                                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {followingBrands.length > 0 && (
                            <div className="p-4 border-t border-white/10">
                                <Link href="/creators" onClick={() => setShowFollowingModal(false)}>
                                    <Button variant="secondary" className="w-full">
                                        Discover More Creators
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
