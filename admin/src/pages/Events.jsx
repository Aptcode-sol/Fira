import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';
import { Button } from '../components/ui/Button';

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

export default function Events() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'all'
    const [events, setEvents] = useState([]);
    const [pendingEvents, setPendingEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [processingId, setProcessingId] = useState(null);
    const [rejectingEvent, setRejectingEvent] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Mock admin ID - in real app this would come from auth context
    const adminId = 'admin-user-id';

    useEffect(() => {
        if (activeTab === 'pending') {
            fetchPendingEvents();
        } else {
            fetchEvents();
        }
    }, [activeTab, filter, currentPage, search]);

    const fetchPendingEvents = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getPendingEventApprovals({ page: currentPage, limit: ITEMS_PER_PAGE });
            setPendingEvents(data.events || []);
            setTotalPages(data.totalPages || 1);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch pending events:', err);
            setPendingEvents([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const params = { page: currentPage, limit: ITEMS_PER_PAGE };
            if (filter === 'public' || filter === 'private') {
                params.eventType = filter;
            } else if (filter !== 'all') {
                params.status = filter;
            }
            if (search) params.search = search;
            const data = await adminApi.getEvents(params);
            setEvents(data.events || []);
            setTotalPages(data.totalPages || 1);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch events:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        setCurrentPage(1);
    };

    const handleAdminApprove = async (eventId, status, reason = '') => {
        setProcessingId(eventId);
        try {
            await adminApi.adminApproveEvent(eventId, adminId, status, reason);
            setRejectingEvent(null);
            setRejectionReason('');
            if (activeTab === 'pending') {
                fetchPendingEvents();
            } else {
                fetchEvents();
            }
        } catch (err) {
            console.error('Failed to update event:', err);
            alert('Failed to update event status');
        } finally {
            setProcessingId(null);
        }
    };

    const handleBlock = async (id, e) => {
        e.stopPropagation();
        try {
            await adminApi.updateEventStatus(id, 'blocked');
            fetchEvents();
        } catch (err) {
            console.error('Failed to block event:', err);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    return (
        <div className="p-6 lg:p-8">
            <FadeIn>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Events</h1>
                        <div className="flex items-center gap-2 text-gray-400">
                            <span>Manage and approve event listings</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            <span>{total} total</span>
                        </div>
                    </div>
                    {pendingEvents.length > 0 && activeTab === 'all' && (
                        <div
                            onClick={() => setActiveTab('pending')}
                            className="bg-yellow-500/10 text-yellow-400 px-4 py-2 rounded-xl border border-yellow-500/20 flex items-center gap-2 cursor-pointer hover:bg-yellow-500/20 transition-colors"
                        >
                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                            {pendingEvents.length} pending approvals
                        </div>
                    )}
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-4 border-b border-white/10 mb-6">
                    <button
                        onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
                        className={`pb-3 px-1 text-sm font-medium transition-all relative ${activeTab === 'pending'
                                ? 'text-violet-400'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Pending Approvals
                        {pendingEvents.length > 0 && (
                            <span className="ml-2 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                                {pendingEvents.length}
                            </span>
                        )}
                        {activeTab === 'pending' && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-violet-400 rounded-t-full"></span>
                        )}
                    </button>
                    <button
                        onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                        className={`pb-3 px-1 text-sm font-medium transition-all relative ${activeTab === 'all'
                                ? 'text-violet-400'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        All Events
                        {activeTab === 'all' && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-violet-400 rounded-t-full"></span>
                        )}
                    </button>
                </div>

                {/* Content based on active tab */}
                {activeTab === 'pending' ? (
                    // Pending Approvals Tab
                    <div className="space-y-4">
                        {/* Info Banner */}
                        <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 flex items-start gap-3">
                            <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <h3 className="text-yellow-400 font-medium text-sm">Action Required</h3>
                                <p className="text-yellow-400/70 text-sm mt-1">
                                    These events have been approved by their venue owners and await your final approval to go live.
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-gray-500">Loading events...</div>
                        ) : pendingEvents.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
                                <div className="text-4xl mb-4">✅</div>
                                <h3 className="text-white font-medium text-lg">All Caught Up!</h3>
                                <p className="text-gray-400">No events pending approval</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pendingEvents.map(event => (
                                    <div key={event._id} className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 transition-all hover:bg-white/[0.04]">
                                        <div className="flex flex-col lg:flex-row gap-6 justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/20">
                                                        ✓ Venue Approved
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/20">
                                                        ⏳ Admin Pending
                                                    </span>
                                                </div>
                                                <h3 className="text-xl font-bold text-white mb-2">{event.name}</h3>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4">
                                                    <div>
                                                        <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Venue</span>
                                                        <span className="text-gray-300">{event.venue?.name || 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Start Time</span>
                                                        <span className="text-gray-300">{formatDateTime(event.startDateTime)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">End Time</span>
                                                        <span className="text-gray-300">{formatDateTime(event.endDateTime)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Capacity</span>
                                                        <span className="text-gray-300">{event.maxAttendees}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-sm text-gray-500">
                                                    <span>Organizer:</span>
                                                    <span className="text-gray-300">{event.organizer?.name}</span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                                                    <span>{event.organizer?.email}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-row lg:flex-col gap-2 justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => navigate(`/events/${event._id}`)}
                                                >
                                                    View Details
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleAdminApprove(event._id, 'approved')}
                                                    disabled={processingId === event._id}
                                                    className="bg-green-600 hover:bg-green-700 text-white border-none"
                                                >
                                                    {processingId === event._id ? 'Approving...' : 'Approve'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => setRejectingEvent(event)}
                                                    disabled={processingId === event._id}
                                                >
                                                    Reject
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    // All Events Tab
                    <>
                        {/* Filters & Search */}
                        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                                {['all', 'approved', 'pending', 'rejected', 'cancelled'].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => { setFilter(status); setCurrentPage(1); }}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${filter === status
                                                ? 'bg-white text-black shadow-lg shadow-white/10'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={handleSearch} className="flex gap-2 max-w-md w-full">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search events..."
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                                    />
                                    <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <Button type="submit" size="sm" variant="secondary">Search</Button>
                                {search && (
                                    <Button type="button" size="sm" variant="ghost" onClick={() => { setSearch(''); setSearchInput(''); setCurrentPage(1); }}>
                                        Clear
                                    </Button>
                                )}
                            </form>
                        </div>

                        {/* Table */}
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                            {loading ? (
                                <div className="p-12 text-center text-gray-500">Loading events...</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/[0.02] border-b border-white/[0.05]">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Event</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Organizer</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Venue</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Approvals</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.05]">
                                            {events.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                                        No events found matching your criteria
                                                    </td>
                                                </tr>
                                            ) : events.map((event) => (
                                                <tr
                                                    key={event._id}
                                                    onClick={() => navigate(`/events/${event._id}`)}
                                                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.5} />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 2v4M8 2v4M3 10h18" />
                                                                </svg>
                                                            </div>
                                                            <span className="font-medium text-white group-hover:text-blue-400 transition-colors">{event.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-white text-sm">{event.organizer?.name || 'N/A'}</span>
                                                            <span className="text-gray-500 text-xs">{event.organizer?.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-300 text-sm">{event.venue?.name || 'N/A'}</td>
                                                    <td className="px-6 py-4 text-gray-300 text-sm">{formatDateTime(event.startDateTime)}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded w-fit ${event.venueApproval?.status === 'approved'
                                                                    ? 'bg-green-500/10 text-green-400'
                                                                    : 'bg-yellow-500/10 text-yellow-400'
                                                                }`}>
                                                                Venue: {event.venueApproval?.status || 'pending'}
                                                            </span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded w-fit ${event.adminApproval?.status === 'approved'
                                                                    ? 'bg-green-500/10 text-green-400'
                                                                    : 'bg-yellow-500/10 text-yellow-400'
                                                                }`}>
                                                                Admin: {event.adminApproval?.status || 'pending'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}>
                                                            {event.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                        {event.status === 'approved' && (
                                                            <button
                                                                onClick={(e) => handleBlock(event._id, e)}
                                                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                                                                title="Block"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

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
                                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                            let page = i + 1;
                                            if (totalPages > 5) {
                                                if (currentPage > 3) page = currentPage - 2 + i;
                                                if (page > totalPages) page = totalPages - (4 - i);
                                            }
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${currentPage === page
                                                            ? 'bg-violet-500 text-white'
                                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
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
                    </>
                )}

                {/* Rejection Modal */}
                {rejectingEvent && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#1f2937] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-2">Reject Event?</h3>
                            <p className="text-gray-400 text-sm mb-4">
                                Please provide a reason for rejecting "{rejectingEvent.name}". This will be sent to the organizer.
                            </p>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Enter rejection reason..."
                                className="w-full h-32 px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none mb-6"
                            />
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="ghost"
                                    onClick={() => { setRejectingEvent(null); setRejectionReason(''); }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => handleAdminApprove(rejectingEvent._id, 'rejected', rejectionReason)}
                                    disabled={processingId === rejectingEvent._id}
                                >
                                    {processingId === rejectingEvent._id ? 'Rejecting...' : 'Reject Event'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </FadeIn>
        </div>
    );
}
