import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';
import { Select } from '../components/ui/Select';
import { Pagination } from '../components/ui/Pagination';
import { formatInr } from '../lib/formatInr';

const ITEMS_PER_PAGE = 20;

const ENTITY_TYPE_OPTIONS = [
    { value: '', label: 'All Entity Types' },
    { value: 'event', label: 'Event' },
    { value: 'venue', label: 'Venue' },
    { value: 'creator', label: 'Creator' },
    { value: 'user', label: 'User' },
];

const ACTION_OPTIONS = [
    { value: '', label: 'All Actions' },
    { value: 'approve', label: 'Approve' },
    { value: 'reject', label: 'Reject' },
    { value: 'block', label: 'Block' },
    { value: 'unblock', label: 'Unblock' },
    { value: 'feature', label: 'Feature' },
    { value: 'unfeature', label: 'Unfeature' },
    { value: 'settle', label: 'Settle' },
    { value: 'reverse', label: 'Reverse settlement' },
    { value: 'delete', label: 'Delete' },
    { value: 'update', label: 'Other change' },
];

/**
 * Absolute time plus a relative one.
 *
 * "2 hours ago" is what answers "is this recent?" at a glance, but on its own it is
 * useless for reconciling against anything, so both are shown - the exact stamp as
 * the value and the relative one underneath.
 */
const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    const dt = new Date(ts);
    if (isNaN(dt.getTime())) return 'Invalid Date';
    const day = dt.getDate();
    const month = dt.toLocaleString('en-US', { month: 'short' });
    const year = dt.getFullYear();
    const hours = dt.getHours().toString().padStart(2, '0');
    const mins = dt.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${mins}`;
};

const formatRelative = (ts) => {
    const dt = new Date(ts);
    if (!ts || isNaN(dt.getTime())) return '';
    const secs = Math.round((Date.now() - dt.getTime()) / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 31) return `${days}d ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.round(months / 12)}y ago`;
};

const getActionColor = (action) => {
    switch (action) {
        case 'approve': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'reject': return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'block': return 'bg-red-700/20 text-red-300 border-red-700/30';
        case 'unblock': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'feature': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'unfeature': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        case 'settle': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        case 'reverse': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        case 'delete': return 'bg-red-900/30 text-red-300 border-red-900/40';
        case 'update': return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
};

/** Where an entry's subject can be opened in the dashboard, if anywhere. */
const ENTITY_PATH = { event: '/events', venue: '/venues', creator: '/brands', user: '/users' };

const shortId = (id) => (id ? String(id).slice(-8) : '—');

const describeValue = (v) => {
    if (v === true) return 'yes';
    if (v === false) return 'no';
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
};

/**
 * What changed, in words.
 *
 * The table used to show only action / entity type / entity id, so reviewing a
 * decision meant copying a 24-character id into another screen and guessing what the
 * previous state had been. The from/to now recorded on every entry is the part that
 * makes the trail reviewable rather than merely present.
 */
function ChangeDetail({ log }) {
    const meta = log.metadata || {};
    const hasTransition = meta.field && (meta.from !== undefined || meta.to !== undefined);
    // Money movement records the listing under listingName, and the amount is the
    // whole point of the row - a settlement without its figure is unreviewable
    // (Requirement 8.5). A reversal's settledAmount is negative, and formatInr
    // renders the sign, which is what tells the two rows apart at a glance.
    const isSettlement = log.action === 'settle' || log.action === 'reverse';

    return (
        <div className="min-w-0">
            <div className="text-sm text-white truncate">
                {meta.name || meta.listingName || <span className="text-gray-500">Unnamed {log.entityType}</span>}
            </div>
            {isSettlement && (
                <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className={log.action === 'reverse' ? 'text-amber-300' : 'text-emerald-300'}>
                        {formatInr(meta.settledAmount)}
                    </span>
                    {meta.settlementReference && (
                        <span className="font-mono text-gray-400 truncate">{meta.settlementReference}</span>
                    )}
                </div>
            )}
            {hasTransition && (
                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-gray-500">{meta.field}</span>
                    <span className="line-through">{describeValue(meta.from)}</span>
                    <span aria-hidden="true">→</span>
                    <span className="text-gray-200">{describeValue(meta.to)}</span>
                </div>
            )}
            {meta.badgeChanged && (
                <div className="text-xs text-violet-300 mt-0.5">
                    Verified badge {meta.to === 'approved' ? 'granted' : 'removed'}
                </div>
            )}
            {meta.email && !hasTransition && (
                <div className="text-xs text-gray-400 mt-0.5 truncate">{meta.email}</div>
            )}
        </div>
    );
}

export default function AuditTrail() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [entityTypeFilter, setEntityTypeFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    useEffect(() => {
        fetchAuditTrail();
    }, [currentPage, entityTypeFilter, actionFilter]);

    const fetchAuditTrail = async () => {
        try {
            setLoading(true);
            const params = { page: currentPage, limit: ITEMS_PER_PAGE };
            if (entityTypeFilter) params.entityType = entityTypeFilter;
            if (actionFilter) params.action = actionFilter;
            const data = await adminApi.getAuditTrail(params);
            setLogs(data.entries || data.logs || []);
            setTotalPages(data.pages || data.totalPages || 1);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch audit trail:', err);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (setter) => (e) => {
        setter(e.target.value);
        setCurrentPage(1);
    };

    return (
        <div className="p-6 lg:p-8">
            <FadeIn>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Audit Trail</h1>
                        <div className="flex items-center gap-2 text-gray-300">
                            <span>Admin action history</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            <span>{total} total entries</span>
                            {/* Kept from the old pager, which showed this beside its
                                arrows. The shared Pagination matches the other admin
                                lists and does not, so it moves up here rather than
                                being lost. */}
                            {totalPages > 1 && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                                    <span>Page {currentPage} of {totalPages}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters. Fixed-width on desktop so two short dropdowns don't stretch
                    the full page width; full-width stacked below sm. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:max-w-xl gap-3 mb-6">
                    <Select
                        value={entityTypeFilter}
                        onChange={handleFilterChange(setEntityTypeFilter)}
                        options={ENTITY_TYPE_OPTIONS}
                        aria-label="Filter by entity type"
                    />
                    <Select
                        value={actionFilter}
                        onChange={handleFilterChange(setActionFilter)}
                        options={ACTION_OPTIONS}
                        aria-label="Filter by action"
                    />
                </div>

                {/* Table */}
                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-300">Loading audit trail...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white/[0.02] border-b border-white/[0.05]">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Action</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">What changed</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">By</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">When</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.05]">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-2xl">📋</span>
                                                    <span className="text-gray-300">No audit logs found</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : logs.map((log) => (
                                        <tr key={log._id} className="hover:bg-white/[0.02] transition-colors align-top">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                                <div className="text-xs text-gray-400 mt-1 capitalize">{log.entityType}</div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs">
                                                <ChangeDetail log={log} />
                                                {/* Last 8 characters, not all 24. The full id made every
                                                    row the same width as its longest column and pushed the
                                                    timestamp off screen; the tail is enough to tell two
                                                    entries apart, and the link is the way through. */}
                                                {ENTITY_PATH[log.entityType] && log.action !== 'delete' ? (
                                                    <Link
                                                        to={`${ENTITY_PATH[log.entityType]}/${log.entityId}`}
                                                        title={String(log.entityId)}
                                                        className="text-xs font-mono text-violet-400 hover:text-violet-300 mt-1 inline-block"
                                                    >
                                                        …{shortId(log.entityId)}
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs font-mono text-gray-500 mt-1 inline-block" title={String(log.entityId)}>
                                                        …{shortId(log.entityId)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-white text-sm">{log.adminUser?.name || 'Unknown'}</div>
                                                {log.adminUser?.email && (
                                                    <div className="text-xs text-gray-400 mt-0.5">{log.adminUser.email}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-300 text-sm">{formatTimestamp(log.timestamp)}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{formatRelative(log.timestamp)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Numbered pages, not just Previous/Next.
                        The other admin lists all have numbered pages; this one had two
                        arrows, so the only way to reach an entry from last month was to
                        click Next through every page in between - on the one screen whose
                        whole purpose is looking back. */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onChange={setCurrentPage}
                    />

                    {/* The pager hides itself at a single page, so a stale page number
                        would otherwise leave an empty table with no way back. */}
                    {totalPages <= 1 && currentPage > 1 && (
                        <div className="p-4 border-t border-white/[0.05] flex justify-center">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(1)}
                                className="px-3 py-1 rounded-lg bg-white/5 text-gray-400 hover:text-white"
                            >
                                Back to first page
                            </button>
                        </div>
                    )}
                </div>
            </FadeIn>
        </div>
    );
}
