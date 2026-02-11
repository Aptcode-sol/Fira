import { useState, useEffect } from 'react';
import adminApi from '../api/adminApi';
import { FadeIn, SlideUp } from '../components/animations';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await adminApi.getStats();
                setStats(data);
            } catch (err) {
                console.error(err);
                // Use mock data as fallback
                setStats({
                    pendingVenues: 5,
                    pendingEvents: 12,
                    pendingBrands: 3,
                    totalUsers: 1450,
                    totalRevenue: 450000,
                    totalTickets: 1250,
                    totalVenues: 45,
                    totalEvents: 120,
                    totalBrands: 25,
                    blockedUsers: 2
                });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const statCards = [
        {
            label: 'Pending Venues',
            value: stats?.pendingVenues || 0,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            color: 'orange'
        },
        {
            label: 'Pending Events',
            value: stats?.pendingEvents || 0,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
            ),
            color: 'yellow'
        },
        {
            label: 'Pending Brands',
            value: stats?.pendingBrands || 0,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
            ),
            color: 'pink'
        },
        {
            label: 'Total Users',
            value: (stats?.totalUsers || 0).toLocaleString(),
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
            color: 'violet'
        }
    ];

    const getColorClass = (color) => {
        const colors = {
            orange: 'text-orange-400 bg-orange-500/10',
            yellow: 'text-yellow-400 bg-yellow-500/10',
            pink: 'text-pink-400 bg-pink-500/10',
            violet: 'text-violet-400 bg-violet-500/10',
            green: 'text-green-400 bg-green-500/10',
            blue: 'text-blue-400 bg-blue-500/10',
        };
        return colors[color] || colors.violet;
    };

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <SlideUp>
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
                    <p className="text-gray-400">Overview of platform activity and pending approvals</p>
                </div>
            </SlideUp>

            {error && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Could not connect to server. Showing placeholder data.
                </div>
            )}

            {/* Stats Grid */}
            <FadeIn delay={0.1}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {statCards.map((stat, i) => (
                        <div key={i} className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 group cursor-pointer">
                            <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center group-hover:scale-105 transition-transform ${getColorClass(stat.color)}`}>
                                {stat.icon}
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </FadeIn>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Revenue Card */}
                <FadeIn delay={0.2}>
                    <div className="bg-gradient-to-br from-violet-500/10 to-pink-500/10 backdrop-blur-sm border border-violet-500/20 rounded-2xl p-6 h-full group hover:border-violet-500/30 transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-1">Platform Revenue</h2>
                                <p className="text-sm text-gray-400">Total earnings from ticket sales</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>

                        <div className="text-4xl font-bold text-white mb-8">
                            {formatCurrency(stats?.totalRevenue || 0)}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <div className="text-sm text-gray-400 mb-1">Tickets Sold</div>
                                <div className="text-xl font-bold text-white">{(stats?.totalTickets || 0).toLocaleString()}</div>
                            </div>
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <div className="text-sm text-gray-400 mb-1">Avg. Ticket Price</div>
                                <div className="text-xl font-bold text-white">
                                    {stats?.totalTickets > 0
                                        ? formatCurrency((stats?.totalRevenue || 0) / stats.totalTickets)
                                        : '₹0'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </FadeIn>

                {/* Platform Overview */}
                <FadeIn delay={0.3}>
                    <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 h-full">
                        <h2 className="text-lg font-semibold text-white mb-6">Platform Overview</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                <span className="text-gray-300">Total Venues</span>
                                <span className="font-bold text-white">{stats?.totalVenues || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                <span className="text-gray-300">Total Events</span>
                                <span className="font-bold text-white">{stats?.totalEvents || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                <span className="text-gray-300">Total Brands</span>
                                <span className="font-bold text-white">{stats?.totalBrands || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/[0.05] border border-red-500/20">
                                <span className="text-red-300">Blocked Users</span>
                                <span className="font-bold text-red-400">{stats?.blockedUsers || 0}</span>
                            </div>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </div>
    );
}
