import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';

// Helper to format DateTime like "30 Dec 2025 14:00"
const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return 'N/A';
    const dt = new Date(dateTimeStr);
    if (isNaN(dt.getTime())) return 'Invalid Date';
    const day = dt.getDate();
    const month = dt.toLocaleString('en-US', { month: 'short' });
    const year = dt.getFullYear();
    const hours = dt.getHours().toString().padStart(2, '0');
    const mins = dt.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${mins}`;
};

const ITEMS_PER_PAGE = 10;

export default function EventDetail() {
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchEvent();
    }, [id]);

    const fetchEvent = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getEventById(id);
            setEvent(data);
            setTickets(data.tickets || []);
            setStats(data.stats || {});
        } catch (err) {
            console.error('Failed to fetch event:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredTickets = tickets.filter(t =>
        t.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.user?.email?.toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
    const paginatedTickets = filteredTickets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    if (loading) {
        return <div className="p-12 text-center text-gray-500">Loading event details...</div>;
    }

    if (!event) {
        return (
            <div className="p-12 text-center text-gray-500">
                <p>Event not found</p>
                <Link to="/events" className="text-violet-400 hover:text-violet-300 mt-4 inline-block">← Back to Events</Link>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8">
            <FadeIn>
                {/* Header */}
                <div className="flex flex-col gap-6 mb-8">
                    <Link to="/events" className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors w-fit">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back to Events
                    </Link>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{event.name}</h1>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-gray-400">
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {event.venue?.name || 'N/A'}
                                </span>
                                <span className="hidden sm:inline">•</span>
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {formatDateTime(event.startDateTime)} to {formatDateTime(event.endDateTime)}
                                </span>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${event.status === 'approved' || event.status === 'upcoming' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                event.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                    event.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            }`}>
                            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                        </span>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 relative overflow-hidden">
                        <div className="flex items-center gap-4 mb-2 relative z-10">
                            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M2 9a3 3 0 013-3h14a3 3 0 013 3M2 9v8a3 3 0 003 3h14a3 3 0 003-3V9M2 9l10 6 10-6" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Tickets Sold</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1 relative z-10">{stats.ticketsSold || event.currentAttendees || 0}</div>

                        {/* Progress Bar */}
                        <div className="mt-4 relative z-10">
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${Math.min(((event.currentAttendees || 0) / event.maxAttendees) * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-gray-500">
                                <span>{Math.round(((event.currentAttendees || 0) / event.maxAttendees) * 100)}% sold</span>
                                <span>{event.maxAttendees} total</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-green-500/10 text-green-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Total Revenue</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{formatCurrency(stats.totalRevenue)}</div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="2" y="5" width="20" height="14" rx="2" />
                                    <path d="M2 10h20" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Ticket Price</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{formatCurrency(event.ticketPrice)}</div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Total Bookings</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{stats.totalBookings || tickets.length}</div>
                    </div>
                </div>

                {/* Ticket Buyers Table */}
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/[0.05] flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 className="text-lg font-semibold text-white">Ticket Buyers</h2>
                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                placeholder="Search buyers..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                            />
                            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/[0.02] border-b border-white/[0.05]">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Buyer</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tickets</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.05]">
                                {paginatedTickets.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                            No tickets found
                                        </td>
                                    </tr>
                                ) : paginatedTickets.map((ticket) => (
                                    <tr key={ticket._id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-white text-xs font-medium border border-white/10">
                                                    {(ticket.user?.name?.charAt(0) || 'U').toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{ticket.user?.name || 'N/A'}</div>
                                                    <div className="text-xs text-gray-500">{ticket.user?.email || ''}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">{ticket.user?.phone || 'N/A'}</td>
                                        <td className="px-6 py-4 text-white font-medium">{ticket.quantity || 1}</td>
                                        <td className="px-6 py-4 text-green-400 font-medium">
                                            {formatCurrency(ticket.price)}
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${ticket.status === 'confirmed'
                                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                                }`}>
                                                {ticket.status || 'confirmed'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-4 border-t border-white/[0.05] flex justify-center">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => (
                                    <button
                                        key={i + 1}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${currentPage === i + 1
                                            ? 'bg-violet-500 text-white'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </FadeIn>
        </div>
    );
}
