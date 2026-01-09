import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../api/adminApi';
import './ApprovalPage.css';

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

    const displayEvents = activeTab === 'pending' ? pendingEvents : events;

    return (
        <div className="approval-page">
            <div className="page-header">
                <div>
                    <h1>Events</h1>
                    <p>Manage and approve event listings • {total} total</p>
                </div>
                <div className="header-stats">
                    <span className="pending-badge">{pendingEvents.length || 0} pending approval</span>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                <button
                    className={`filter-btn ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
                    style={{ position: 'relative' }}
                >
                    🔔 Pending Approvals
                    {pendingEvents.length > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: '#f59e0b',
                            color: '#000',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold'
                        }}>
                            {pendingEvents.length}
                        </span>
                    )}
                </button>
                <button
                    className={`filter-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                >
                    📋 All Events
                </button>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'pending' ? (
                // Pending Approvals Tab
                <div className="card mt-4">
                    <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ margin: 0, color: '#f59e0b' }}>Events Pending Admin Approval</h3>
                        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            These events have been approved by their venue owners and await your final approval.
                        </p>
                    </div>

                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                    ) : pendingEvents.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                            No events pending approval
                        </div>
                    ) : (
                        <div style={{ padding: '1rem' }}>
                            {pendingEvents.map(event => (
                                <div key={event._id} style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: '250px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    background: 'rgba(16, 185, 129, 0.2)',
                                                    color: '#10b981',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem'
                                                }}>
                                                    ✓ Venue Approved
                                                </span>
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    background: 'rgba(245, 158, 11, 0.2)',
                                                    color: '#f59e0b',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem'
                                                }}>
                                                    ⏳ Admin Pending
                                                </span>
                                            </div>
                                            <h4 style={{ margin: '0 0 0.5rem', color: '#fff' }}>{event.name}</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', fontSize: '0.875rem' }}>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>📍 Venue: </span>
                                                    <span style={{ color: '#fff' }}>{event.venue?.name || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>📅 From: </span>
                                                    <span style={{ color: '#fff' }}>{formatDateTime(event.startDateTime)}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>📅 To: </span>
                                                    <span style={{ color: '#fff' }}>{formatDateTime(event.endDateTime)}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)' }}>👥 Capacity: </span>
                                                    <span style={{ color: '#fff' }}>{event.maxAttendees}</span>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Organizer: </span>
                                                <span style={{ color: '#fff', fontSize: '0.875rem' }}>{event.organizer?.name}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>{event.organizer?.email}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => navigate(`/events/${event._id}`)}
                                            >
                                                View Details
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => setRejectingEvent(event)}
                                                disabled={processingId === event._id}
                                            >
                                                Reject
                                            </button>
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => handleAdminApprove(event._id, 'approved')}
                                                disabled={processingId === event._id}
                                            >
                                                {processingId === event._id ? 'Processing...' : 'Approve'}
                                            </button>
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
                    {/* Filters */}
                    <div className="filters" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {['all', 'approved', 'pending', 'rejected', 'cancelled'].map(status => (
                                <button
                                    key={status}
                                    className={`filter-btn ${filter === status ? 'active' : ''}`}
                                    onClick={() => { setFilter(status); setCurrentPage(1); }}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Search all events..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="search-input"
                            />
                            <button type="submit" className="btn btn-primary btn-sm">Search</button>
                            {search && (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => { setSearch(''); setSearchInput(''); setCurrentPage(1); }}
                                >
                                    Clear
                                </button>
                            )}
                        </form>
                    </div>

                    {search && (
                        <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            Showing results for "{search}"
                        </div>
                    )}

                    {/* Table */}
                    <div className="card mt-4">
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Event</th>
                                            <th>Organizer</th>
                                            <th>Venue</th>
                                            <th>Date</th>
                                            <th>Approvals</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {events.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    No events found
                                                </td>
                                            </tr>
                                        ) : events.map((event) => (
                                            <tr key={event._id} onClick={() => navigate(`/events/${event._id}`)} style={{ cursor: 'pointer' }}>
                                                <td>
                                                    <div className="venue-info">
                                                        <div className="venue-thumb" style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)' }}>
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                                                <path d="M16 2v4M8 2v4M3 10h18" />
                                                            </svg>
                                                        </div>
                                                        <span className="venue-name">{event.name}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <div>{event.organizer?.name || 'N/A'}</div>
                                                        <div className="text-muted">{event.organizer?.email || ''}</div>
                                                    </div>
                                                </td>
                                                <td>{event.venue?.name || 'N/A'}</td>
                                                <td>{formatDateTime(event.startDateTime)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.25rem', flexDirection: 'column' }}>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: event.venueApproval?.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                            color: event.venueApproval?.status === 'approved' ? '#10b981' : '#f59e0b'
                                                        }}>
                                                            Venue: {event.venueApproval?.status || 'pending'}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: event.adminApproval?.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                            color: event.adminApproval?.status === 'approved' ? '#10b981' : '#f59e0b'
                                                        }}>
                                                            Admin: {event.adminApproval?.status || 'pending'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${event.status === 'approved' ? 'approved' : event.status}`}>
                                                        {event.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="actions">
                                                        {event.status === 'approved' && (
                                                            <button className="btn btn-danger btn-sm" onClick={(e) => handleBlock(event._id, e)}>
                                                                Block
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    className="page-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                >
                                    Previous
                                </button>
                                <div className="page-numbers">
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let page;
                                        if (totalPages <= 5) {
                                            page = i + 1;
                                        } else if (currentPage <= 3) {
                                            page = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            page = totalPages - 4 + i;
                                        } else {
                                            page = currentPage - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={page}
                                                className={`page-num ${currentPage === page ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(page)}
                                            >
                                                {page}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    className="page-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Rejection Modal */}
            {rejectingEvent && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#1f2937',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ margin: '0 0 0.5rem', color: '#fff' }}>Reject Event?</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Please provide a reason for rejecting "{rejectingEvent.name}"
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#fff',
                                marginBottom: '1rem',
                                minHeight: '80px',
                                resize: 'vertical'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setRejectingEvent(null); setRejectionReason(''); }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleAdminApprove(rejectingEvent._id, 'rejected', rejectionReason)}
                                disabled={processingId === rejectingEvent._id}
                            >
                                Reject Event
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
