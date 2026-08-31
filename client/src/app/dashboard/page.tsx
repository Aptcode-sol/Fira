'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { dashboardApi, DashboardOverview, usersApi } from '@/lib/api';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { FadeIn, SlideUp } from '@/components/animations';
import { Pagination } from '@/components/ui';
import { usePaged } from '@/hooks/usePaged';
import { X, Users, Calendar } from 'lucide-react';
import CreatorStatusButton from '@/components/dashboard/CreatorStatusButton';
import { CREATOR_SAVED } from '@/components/modals/CreateCreatorModal';

interface FollowingBrand {
    _id: string;
    name: string;
    type: string;
    bio: string;
    profilePhoto: string | null;
    stats: { followers: number; events: number };
    user?: { _id: string; name: string };
}

/** Chip colours for a creator profile that is not (yet) approved. */
const CREATOR_STATUS_CHIP: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    rejected: 'bg-red-500/20 text-red-400',
    blocked: 'bg-red-500/20 text-red-400',
};

export default function DashboardPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const [dashboardData, setDashboardData] = useState<DashboardOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [followingBrands, setFollowingBrands] = useState<FollowingBrand[]>([]);
    const [followingCount, setFollowingCount] = useState(0);
    const [showFollowingModal, setShowFollowingModal] = useState(false);

    // Lock body scroll while the hand-rolled following-creators overlay is open (mirrors <Modal>).
    useBodyScrollLock(showFollowingModal);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin?redirect=/dashboard');
        }
    }, [isLoading, isAuthenticated, router]);

    const fetchDashboardData = useCallback(async () => {
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
    }, [user?._id]);

    useEffect(() => {
        if (isAuthenticated && user?._id) {
            fetchDashboardData();
        }
    }, [isAuthenticated, user?._id, fetchDashboardData]);

    // Refetch when a creator application is submitted or edited from the shared
    // modal. Without this the CreatorStatusButton keeps reading the stale profile
    // and still shows "Apply as Creator" right after the user applied, instead of
    // flipping to "Applied".
    useEffect(() => {
        const refresh = () => fetchDashboardData();
        window.addEventListener(CREATOR_SAVED, refresh);
        return () => window.removeEventListener(CREATOR_SAVED, refresh);
    }, [fetchDashboardData]);

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

    // Both panels page in fours. Declared above the early returns because hooks
    // cannot sit behind a conditional, and the footers render at "1 of 1" even
    // with nothing in the list so an empty panel still reads as finished.
    const organizedPage = usePaged(dashboardData?.organizedEvents ?? [], 4);
    const activityPage = usePaged(dashboardData?.recentActivity ?? [], 4);

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

    // Attending first, Organizing second - the two swapped places, and the grid
    // stays at two columns on every breakpoint so they sit at opposite ends of
    // the row instead of bunching up on the left at `lg`.
    const quickStats = [
        {
            label: 'Events Attending',
            value: stats?.eventsAttending ?? 0,
            subValue: stats?.activeTickets ? `${stats.activeTickets} tickets` : null,
            icon: 'ticket',
            color: 'green',
            href: '/dashboard/tickets'
        },
        {
            label: 'Events Organizing',
            value: stats?.upcomingEventsOrganizing ?? 0,
            subValue: stats?.eventsOrganizing ? `${stats.eventsOrganizing} total` : null,
            icon: 'calendar',
            color: 'violet',
            href: '/dashboard/events'
        }
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

    // Creator status + the follow shortcut, defined once and rendered in two
    // places: on the title row from `sm` up, and (on mobile only) between the
    // brand card and the stat tiles - so a phone reads title, brand, then these,
    // matching where the account's own identity should sit.
    const overviewActions = (
        <>
            <CreatorStatusButton
                status={dashboardData?.brandProfile?.status}
                className="w-full sm:w-auto"
            />
            <button
                onClick={() => setShowFollowingModal(true)}
                className="w-full sm:w-auto flex items-center justify-between sm:justify-center gap-3 px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl transition-all duration-200 group"
            >
                <span className="flex items-center gap-2 min-w-0">
                    <Users className="w-5 h-5 flex-shrink-0 text-violet-400 group-hover:scale-110 transition-transform" />
                    <span className="text-white font-medium truncate">Creators You Follow</span>
                </span>
                <span className="flex-shrink-0 px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full text-sm font-semibold">
                    {followingCount}
                </span>
            </button>
        </>
    );

    return (
        <DashboardLayout>
            <div className="p-4 sm:p-6 lg:p-8 overflow-x-hidden">
                {/* Error State */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                        {error}
                    </div>
                )}

                {/* Page heading + follow shortcut.
                    The "Welcome back" heading and its "here's what's happening"
                    subtitle are gone: they repeated what the rest of the page
                    already shows and pushed the numbers below the fold on a
                    phone. */}
                <SlideUp>
                    <div className="flex sm:items-center sm:justify-between gap-3 mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">Overview</h1>
                        {/* From `sm` up the actions sit on the title row's right. On a
                            phone they move below the brand card instead (rendered again
                            there), so the card is the first thing under the heading. */}
                        <div className="hidden sm:flex sm:items-center gap-3">
                            {overviewActions}
                        </div>
                    </div>
                </SlideUp>

                {/* Brand card and the two stat tiles share one row on desktop - the card
                    on the left half, Attending/Organizing on the right - instead of the
                    card spanning the full width and pushing the numbers down a screen.
                    Below `lg` they stack in DOM order: the card first, directly under the
                    heading, because the creator identity is what the page is about. */}
                <div className={`mb-8 flex flex-col gap-4 ${dashboardData?.brandProfile ? 'lg:grid lg:grid-cols-2 lg:gap-6 lg:items-stretch' : ''}`}>
                    {/* Brand Profile Card. Avatar only - no cover strip. This card sits
                        beside the stat tiles as a compact identity summary; the banner
                        belongs on My Brand and the public profile, where the creator is
                        the subject of the page rather than one tile in a row.

                        One layout at every width, not a narrow/wide pair. The identity
                        block sits on top, the numbers and the CTA on a separated footer
                        row, so nothing has to be duplicated behind a breakpoint and the
                        card fills the height it is stretched to instead of leaving a
                        void under top-aligned content. */}
                    {dashboardData?.brandProfile && (
                        <SlideUp>
                            <div className="h-full flex flex-col justify-between gap-6 p-5 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                                {/* Identity */}
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-16 h-16 sm:w-[68px] sm:h-[68px] flex-shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500">
                                        {dashboardData.brandProfile.profilePhoto ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={dashboardData.brandProfile.profilePhoto}
                                                alt={dashboardData.brandProfile.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">
                                                {dashboardData.brandProfile.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="text-lg sm:text-xl font-semibold text-white truncate">
                                                {dashboardData.brandProfile.name}
                                            </h3>
                                            {/* Same violet tick the creator profile and
                                                creator cards use. */}
                                            {dashboardData.brandProfile.status === 'approved' && (
                                                <svg className="w-[18px] h-[18px] flex-shrink-0 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                                            <span className="capitalize">{dashboardData.brandProfile.type}</span>
                                            {dashboardData.brandProfile.status !== 'approved' && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-gray-600 flex-shrink-0" />
                                                    <span className={`capitalize truncate ${dashboardData.brandProfile.status === 'pending' ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {dashboardData.brandProfile.status === 'pending' ? 'Pending review' : dashboardData.brandProfile.status}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Numbers + CTA */}
                                <div className="flex items-center justify-between gap-4 pt-5 border-t border-white/[0.06]">
                                    <div className="flex gap-8">
                                        <div>
                                            <div className="text-xl font-semibold text-white tabular-nums leading-tight">
                                                {dashboardData.brandProfile.followers.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">Followers</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-semibold text-white tabular-nums leading-tight">
                                                {dashboardData.brandProfile.events.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">Events</div>
                                        </div>
                                    </div>
                                    <Link href={`/creators/${dashboardData.brandProfile._id}`} className="flex-shrink-0">
                                        <Button variant="secondary" size="sm">View Profile</Button>
                                    </Link>
                                </div>
                            </div>
                        </SlideUp>
                    )}

                    {/* Mobile-only actions. sm:hidden keeps them off the grid at every
                        larger width (where they live on the title row), so this does not
                        occupy a second column on desktop. Sits after the brand card and
                        before the stats, which is the order the phone should read. */}
                    <div className="flex flex-col gap-3 sm:hidden">
                        {overviewActions}
                    </div>

                    <FadeIn delay={0.1}>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 h-full">
                            {quickStats.map((stat) => (
                                // h-full on the anchor too: without it the tile's own
                                // h-full measures against an auto-height link and the
                                // tiles stop short of the brand card beside them.
                                <Link key={stat.label} href={stat.href} className="h-full">
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
                                        <div className="text-sm text-gray-300">{stat.label}</div>
                                        {/* Always render this row to maintain consistent height */}
                                        <div className="text-xs text-gray-300 mt-1 min-h-[1rem]">
                                            {!loading && stat.subValue ? stat.subValue : '\u00A0'}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </FadeIn>
                </div>

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
                        </div>
                    </div>
                </FadeIn>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Your Organized Events */}
                    <FadeIn delay={0.1}>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl h-full flex flex-col overflow-hidden">
                            <h2 className="text-lg font-semibold text-white px-6 pt-6 mb-4">Your Events</h2>
                            <div className="space-y-4 flex-1 px-6 pb-6">
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
                                ) : organizedPage.total > 0 ? (
                                    organizedPage.pageRows.map((event) => {
                                        const { month, day } = formatEventDate(event.date);
                                        const attendeePercent = Math.round((event.currentAttendees / event.maxAttendees) * 100);
                                        return (
                                            <Link key={event._id} href={`/events/${event._id}`}>
                                                <div className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors cursor-pointer">
                                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/30 to-pink-500/30 flex items-center justify-center flex-shrink-0">
                                                        <div className="text-center">
                                                            <div className="text-xs text-gray-300">{month}</div>
                                                            <div className="text-lg font-bold text-white">{day}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">{event.name}</p>
                                                        <p className="text-xs text-gray-300">
                                                            {event.startTime} • {event.venue?.name || 'TBA'}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-violet-500 rounded-full transition-all"
                                                                    style={{ width: `${Math.min(attendeePercent, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-gray-300">
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
                                        <p className="text-sm text-gray-300 mb-3">No events organized yet</p>
                                        <Link href="/create/event">
                                            <Button variant="secondary" size="sm">Create Your First Event</Button>
                                        </Link>
                                    </div>
                                )}
                                {organizedPage.total > 0 && (
                                    <Link href="/dashboard/events" className="block pt-2 text-sm text-violet-400 hover:text-violet-300">
                                        View all events →
                                    </Link>
                                )}
                            </div>
                            <Pagination
                                page={organizedPage.page}
                                totalPages={organizedPage.totalPages}
                                onChange={organizedPage.setPage}
                                disabled={loading}
                            />
                        </div>
                    </FadeIn>

                    {/* Recent Activity */}
                    <FadeIn delay={0.2}>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl h-full flex flex-col overflow-hidden">
                            <h2 className="text-lg font-semibold text-white px-6 pt-6 mb-4">Recent Activity</h2>
                            <div className="space-y-4 flex-1 px-6 pb-6">
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
                                ) : activityPage.total > 0 ? (
                                    activityPage.pageRows.map((activity) => (
                                        <div key={activity._id} className="flex items-start gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.category)}`}>
                                                {getActivityIcon(activity.category)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white">{activity.title}</p>
                                                {activity.message && (
                                                    <p className="text-xs text-gray-300 truncate">{activity.message}</p>
                                                )}
                                                <p className="text-xs text-gray-300 mt-1">{formatTime(activity.createdAt)}</p>
                                            </div>
                                            {!activity.isRead && (
                                                <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-300 text-center py-4">No recent activity</p>
                                )}
                                <Link href="/notifications" className="block pt-2 text-sm text-violet-400 hover:text-violet-300">
                                    View all activity →
                                </Link>
                            </div>
                            <Pagination
                                page={activityPage.page}
                                totalPages={activityPage.totalPages}
                                onChange={activityPage.setPage}
                                disabled={loading}
                            />
                        </div>
                    </FadeIn>
                </div>
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
                                <X className="w-5 h-5 text-gray-300" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto max-h-[60vh] p-4">
                            {followingBrands.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-300 mb-4">You&apos;re not following any creators yet</p>
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
                                                    <div className="flex items-center gap-2 text-xs text-gray-300">
                                                        <span className="capitalize">{brand.type}</span>
                                                        <span>•</span>
                                                        <span>{brand.stats.followers} followers</span>
                                                    </div>
                                                </div>

                                                {/* Arrow */}
                                                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
