'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { notificationsApi } from '@/lib/api';
import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';

type NotificationCategory = 'all' | 'events' | 'bookings' | 'payments' | 'system';

interface Notification {
    _id: string;
    category: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
}

export default function NotificationsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [categoryFilter, setCategoryFilter] = useState<NotificationCategory>('all');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        const fetchNotifications = async () => {
            if (!user?._id) return;
            try {
                setLoading(true);
                const data = await notificationsApi.getUserNotifications(user._id) as Notification[];
                setNotifications(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load notifications');
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated && user?._id) {
            fetchNotifications();
        }
    }, [isAuthenticated, user?._id]);

    if (isLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    const filteredNotifications = categoryFilter === 'all'
        ? notifications
        : notifications.filter((n) => n.category === categoryFilter);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const markAsRead = async (id: string) => {
        try {
            await notificationsApi.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, read: true } : n))
            );
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const markAllAsRead = async () => {
        if (!user?._id) return;
        try {
            await notificationsApi.markAllAsRead(user._id);
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
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

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'events':
                return (
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                );
            case 'bookings':
                return (
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                        </svg>
                    </div>
                );
            case 'payments':
                return (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
            case 'system':
            default:
                return (
                    <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                );
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
                            <p className="text-gray-400">
                                {unreadCount > 0 ? `You have ${unreadCount} unread notifications` : 'You\'re all caught up!'}
                            </p>
                        </div>
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                                Mark all as read
                            </Button>
                        )}
                    </div>
                </SlideUp>

                {/* Category Filters */}
                <FadeIn delay={0.1}>
                    <div className="flex gap-2 mb-8 flex-wrap">
                        {(['all', 'events', 'bookings', 'payments', 'system'] as NotificationCategory[]).map((category) => (
                            <button
                                key={category}
                                onClick={() => setCategoryFilter(category)}
                                className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-all duration-200 ${categoryFilter === category
                                    ? 'bg-white text-black shadow-lg shadow-white/10'
                                    : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.08]'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </FadeIn>

                {/* Loading State - Skeleton Cards */}
                {loading && (
                    <div className="space-y-3">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                                className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-4 flex items-start gap-4"
                            >
                                <div className="w-10 h-10 rounded-xl bg-white/[0.05] animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-48 bg-white/[0.05] rounded animate-pulse" />
                                    <div className="h-3 w-full bg-white/[0.05] rounded animate-pulse" />
                                    <div className="h-3 w-24 bg-white/[0.05] rounded animate-pulse" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="text-center py-16">
                        <p className="text-red-400 mb-4">{error}</p>
                        <Button onClick={() => window.location.reload()}>Try Again</Button>
                    </div>
                )}

                {/* Notifications List */}
                {!loading && !error && (
                    <div className="space-y-3">
                        {filteredNotifications.map((notification) => (
                            <div
                                key={notification._id}
                                onClick={() => markAsRead(notification._id)}
                                className={`bg-white/[0.02] backdrop-blur-sm border rounded-2xl p-4 flex items-start gap-4 cursor-pointer transition-all duration-200 hover:bg-white/[0.04] ${notification.read
                                    ? 'border-white/[0.05]'
                                    : 'border-violet-500/30 bg-violet-500/[0.03]'
                                    }`}
                            >
                                {getCategoryIcon(notification.category)}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className={`font-medium ${notification.read ? 'text-white' : 'text-violet-300'}`}>
                                            {notification.title}
                                        </h3>
                                        {!notification.read && (
                                            <span className="w-2 h-2 rounded-full bg-violet-500" />
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-400 mb-2">{notification.message}</p>
                                    <p className="text-xs text-gray-500">{formatTime(notification.createdAt)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && filteredNotifications.length === 0 && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <h3 className="text-xl font-semibold text-white mb-2">No notifications</h3>
                        <p className="text-gray-400">
                            {categoryFilter === 'all'
                                ? 'You\'re all caught up! Check back later for updates.'
                                : `No ${categoryFilter} notifications at the moment.`}
                        </p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
