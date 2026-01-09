import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import adminApi from '../api/adminApi';
import './DetailPage.css';

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

const ITEMS_PER_PAGE = 5;

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
        return (
            <div className="detail-page">
                <div className="detail-header">
                    <div className="back-nav">
                        <Link to="/events" className="back-btn">← Back to Events</Link>
                    </div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="detail-page">
                <div className="detail-header">
                    <div className="back-nav">
                        <Link to="/events" className="back-btn">← Back to Events</Link>
                    </div>
                    <p>Event not found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="detail-page">
            {/* Header */}
            <div className="detail-header">
                <div className="back-nav">
                    <Link to="/events" className="back-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back to Events
                    </Link>
                </div>
                <div className="detail-title-row">
                    <div>
                        <h1>{event.name}</h1>
                        <p className="detail-meta">
                            {event.venue?.name || 'N/A'} • {formatDateTime(event.startDateTime)} to {formatDateTime(event.endDateTime)}
                        </p>
                    </div>
                    <span className={`badge badge-${event.status === 'upcoming' ? 'approved' : event.status}`}>{event.status}</span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-icon tickets">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 9a3 3 0 013-3h14a3 3 0 013 3M2 9v8a3 3 0 003 3h14a3 3 0 003-3V9M2 9l10 6 10-6" />
                        </svg>
                    </div>
                    <div className="metric-info">
                        <div className="metric-value">{stats.ticketsSold || event.currentAttendees || 0}</div>
                        <div className="metric-label">Tickets Sold</div>
                    </div>
                    <div className="metric-progress">
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${((event.currentAttendees || 0) / event.maxAttendees) * 100}%` }} />
                        </div>
                        <span className="progress-text">{Math.round(((event.currentAttendees || 0) / event.maxAttendees) * 100)}% of {event.maxAttendees}</span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon revenue">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                        </svg>
                    </div>
                    <div className="metric-info">
                        <div className="metric-value revenue-text">{formatCurrency(stats.totalRevenue)}</div>
                        <div className="metric-label">Total Revenue</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon price">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="5" width="20" height="14" rx="2" />
                            <path d="M2 10h20" />
                        </svg>
                    </div>
                    <div className="metric-info">
                        <div className="metric-value">{formatCurrency(event.ticketPrice)}</div>
                        <div className="metric-label">Ticket Price</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon users">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                        </svg>
                    </div>
                    <div className="metric-info">
                        <div className="metric-value">{stats.totalBookings || tickets.length}</div>
                        <div className="metric-label">Total Bookings</div>
                    </div>
                </div>
            </div>

            {/* Ticket Buyers Table */}
            <div className="card mt-6">
                <div className="card-header">
                    <h2>Ticket Buyers</h2>
                    <input
                        type="text"
                        placeholder="Search buyers..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        className="search-input"
                    />
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Buyer</th>
                                <th>Phone</th>
                                <th>Tickets</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTickets.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No tickets found
                                    </td>
                                </tr>
                            ) : paginatedTickets.map((ticket) => (
                                <tr key={ticket._id}>
                                    <td>
                                        <div className="buyer-info">
                                            <div className="avatar">{ticket.user?.name?.charAt(0) || 'U'}</div>
                                            <div>
                                                <div className="buyer-name">{ticket.user?.name || 'N/A'}</div>
                                                <div className="buyer-email">{ticket.user?.email || ''}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{ticket.user?.phone || 'N/A'}</td>
                                    <td>{ticket.quantity || 1}</td>
                                    <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                                        {formatCurrency(ticket.price)}
                                    </td>
                                    <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <span className={`badge badge-${ticket.status === 'confirmed' ? 'approved' : 'pending'}`}>
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
                    <div className="pagination">
                        <button
                            className="page-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                        >
                            Previous
                        </button>
                        <div className="page-numbers">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    className={`page-num ${currentPage === page ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            ))}
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
        </div>
    );
}
