import { useState, useEffect } from 'react';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';

const ITEMS_PER_PAGE = 20;

const ENTITY_TYPES = ['event', 'venue', 'creator', 'user'];
const ACTIONS = ['approve', 'reject', 'block', 'unblock', 'feature', 'unfeature'];

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

const getActionColor = (action) => {
    switch (action) {
        case 'approve': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'reject': return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'block': return 'bg-red-700/20 text-red-300 border-red-700/30';
        case 'unblock': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'feature': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'unfeature': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
};

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
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <select
                        value={entityTypeFilter}
                        onChange={handleFilterChange(setEntityTypeFilter)}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                    >
                        <option value="">All Entity Types</option>
                        {ENTITY_TYPES.map(type => (
                            <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                        ))}
                    </select>
                    <select
                        value={actionFilter}
                        onChange={handleFilterChange(setActionFilter)}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                    >
                        <option value="">All Actions</option>
                        {ACTIONS.map(action => (
                            <option key={action} value={action}>{action.charAt(0).toUpperCase() + action.slice(1)}</option>
                        ))}
                    </select>
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
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Admin User</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Action</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Entity Type</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Entity ID</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.05]">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-2xl">📋</span>
                                                    <span className="text-gray-300">No audit logs found</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : logs.map((log) => (
                                        <tr key={log._id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="text-white text-sm">{log.adminUser?.name || 'Unknown'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-gray-300 text-sm capitalize">{log.entityType}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-gray-400 text-xs font-mono">{log.entityId}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-gray-300 text-sm">{formatTimestamp(log.timestamp)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-4 border-t border-white/[0.05] flex items-center justify-between">
                            <span className="text-sm text-gray-400">
                                Page {currentPage} of {totalPages}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
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
