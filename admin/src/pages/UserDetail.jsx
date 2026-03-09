import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';
import { Button } from '../components/ui/Button';

export default function UserDetail() {
    const { id } = useParams();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUser();
    }, [id]);

    const fetchUser = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getUserById(id);
            setUser(data);
        } catch (err) {
            console.error('Failed to fetch user:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleBlock = async () => {
        try {
            await adminApi.blockUser(id);
            fetchUser();
        } catch (err) {
            console.error('Failed to block user:', err);
        }
    };

    const handleUnblock = async () => {
        try {
            await adminApi.unblockUser(id);
            fetchUser();
        } catch (err) {
            console.error('Failed to unblock user:', err);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    if (loading) {
        return (
            <div className="p-12 text-center text-gray-500">Loading...</div>
        );
    }

    if (!user) {
        return (
            <div className="p-12 text-center text-gray-500">
                <p>User not found</p>
                <Link to="/users" className="text-violet-400 hover:text-violet-300 mt-4 inline-block">← Back to Users</Link>
            </div>
        );
    }

    const { stats, bookings, tickets } = user;

    return (
        <div className="p-6 lg:p-8">
            <FadeIn>
                {/* Header */}
                <div className="flex flex-col gap-6 mb-8">
                    <Link to="/users" className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors w-fit">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back to Users
                    </Link>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-2xl font-bold text-white border border-white/10">
                                {(user.name?.charAt(0) || 'U').toUpperCase()}
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                    {user.name}
                                    {user.badge && (
                                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-violet-500/20 text-violet-400 border border-violet-500/20">
                                            {user.badge}
                                        </span>
                                    )}
                                </h1>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-gray-400 mt-1">
                                    <span>{user.email}</span>
                                    {user.phoneNumber && (
                                        <>
                                            <span className="hidden sm:inline">•</span>
                                            <span>{user.phoneNumber}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {user.isBlocked ? (
                                <Button variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" onClick={handleUnblock}>
                                    Unblock User
                                </Button>
                            ) : (
                                <Button variant="destructive" onClick={handleBlock}>
                                    Block User
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Total Spent</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{formatCurrency(stats?.totalSpent)}</div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <path d="M16 2v4M8 2v4M3 10h18" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Bookings Made</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{stats?.totalBookings || 0}</div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-pink-500/10 text-pink-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Tickets Bought</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{stats?.totalTickets || 0}</div>
                    </div>
                </div>

                {/* Content Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Recent Bookings */}
                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Recent Bookings</h2>
                        <div className="space-y-4">
                            {!bookings?.length ? (
                                <p className="text-gray-500 text-sm">No bookings found</p>
                            ) : bookings.slice(0, 5).map((booking) => (
                                <div key={booking._id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                    <div>
                                        <div className="font-medium text-white">{booking.venue?.name || 'Unknown Venue'}</div>
                                        <div className="text-xs text-gray-500">{new Date(booking.date).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-white">{formatCurrency(booking.totalAmount)}</div>
                                        <div className={`text-xs capitalize ${booking.status === 'completed' ? 'text-green-400' :
                                                booking.status === 'cancelled' ? 'text-red-400' : 'text-yellow-400'
                                            }`}>{booking.status}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Tickets */}
                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Recent Tickets</h2>
                        <div className="space-y-4">
                            {!tickets?.length ? (
                                <p className="text-gray-500 text-sm">No tickets found</p>
                            ) : tickets.slice(0, 5).map((ticket) => (
                                <div key={ticket._id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                    <div>
                                        <div className="font-medium text-white">{ticket.event?.name || 'Unknown Event'}</div>
                                        <div className="text-xs text-gray-500">
                                            {ticket.event?.venue?.name} • {new Date(ticket.event?.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-white">{formatCurrency(ticket.price)}</div>
                                        <div className="text-xs text-gray-500">x{ticket.quantity || 1}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </FadeIn>
        </div>
    );
}
