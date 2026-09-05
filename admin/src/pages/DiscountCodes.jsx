import { useState, useEffect, useMemo } from 'react';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';
import { Pagination } from '../components/ui/Pagination';
import { useBulkSelection } from '../lib/useBulkSelection';
import BulkActionBar from '../components/BulkActionBar';

const PAGE_SIZE = 10;

const formatDate = (d) => {
    if (!d) return 'N/A';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return 'Invalid';
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`;

// Flow 8.7: a code created by a user with an adminRole is a platform code
// (intended to apply to every event); otherwise it was created by the event owner.
const isAdminCode = (code) => Boolean(code.createdBy?.adminRole);
const ownerKind = (code) => (isAdminCode(code) ? 'Admin (platform)' : 'Event owner');

export default function DiscountCodes() {
    const [codes, setCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedEventId, setExpandedEventId] = useState(null);
    const [expandedCodeId, setExpandedCodeId] = useState(null);
    const [analytics, setAnalytics] = useState({});
    const [analyticsLoading, setAnalyticsLoading] = useState({});
    const [toggling, setToggling] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [bulkBusy, setBulkBusy] = useState(false);
    const bulk = useBulkSelection();

    useEffect(() => {
        fetchCodes();
    }, []);

    const fetchCodes = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getDiscountCodes();
            setCodes(data || []);
        } catch (err) {
            console.error('Failed to fetch discount codes:', err);
            setCodes([]);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (code) => {
        const action = code.isActive ? 'Deactivate' : 'Activate';
        if (!window.confirm(`${action} discount code "${code.code}"?`)) return;
        setToggling((prev) => ({ ...prev, [code._id]: true }));
        try {
            if (code.isActive) {
                await adminApi.deactivateDiscountCode(code._id);
            } else {
                await adminApi.activateDiscountCode(code._id);
            }
            setCodes((prev) =>
                prev.map((c) => (c._id === code._id ? { ...c, isActive: !c.isActive } : c))
            );
        } catch (err) {
            console.error('Failed to toggle discount code:', err);
        } finally {
            setToggling((prev) => ({ ...prev, [code._id]: false }));
        }
    };

    const handleDelete = async (code) => {
        if (!window.confirm(`Delete discount code "${code.code}"? This cannot be undone.`)) return;
        try {
            await adminApi.deleteDiscountCode(code._id);
            setCodes((prev) => prev.filter((c) => c._id !== code._id));
        } catch (err) {
            alert(err.message || 'Failed to delete discount code');
        }
    };

    // Group codes by event. Events are the top-level (paged) rows; each expands
    // to its codes, and each code expands again to its analytics - the double
    // dropdown the users/venues/events tables use.
    const groups = useMemo(() => {
        const byEvent = codes.reduce((acc, code) => {
            const eventName = code.event?.name || 'Unknown Event';
            const eventId = code.event?._id || code.event || 'unknown';
            const key = String(eventId);
            if (!acc[key]) acc[key] = { id: key, name: eventName, codes: [] };
            acc[key].codes.push(code);
            return acc;
        }, {});
        return Object.values(byEvent);
    }, [codes]);

    const totalPages = Math.max(Math.ceil(groups.length / PAGE_SIZE), 1);
    // Filtering/deletion can shrink the list under the current page; clamp on read
    // so the view never goes blank (mirrors client/usePaged).
    const page = Math.min(currentPage, totalPages);
    const pageGroups = useMemo(
        () => groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [groups, page]
    );

    // Bulk selection operates on individual codes across the whole list.
    const pageCodeIds = pageGroups.flatMap((g) => g.codes.map((c) => c._id));

    const runBulk = async (fn) => {
        setBulkBusy(true);
        try {
            for (const id of bulk.selectedIds) await fn(id);
            bulk.clear();
            await fetchCodes();
        } catch (err) {
            console.error('Bulk action failed:', err);
        } finally {
            setBulkBusy(false);
        }
    };

    const handleExpandEvent = (eventId) => {
        setExpandedEventId((prev) => (prev === eventId ? null : eventId));
    };

    const handleExpandCode = async (codeId) => {
        if (expandedCodeId === codeId) {
            setExpandedCodeId(null);
            return;
        }
        setExpandedCodeId(codeId);
        if (!analytics[codeId]) {
            setAnalyticsLoading((prev) => ({ ...prev, [codeId]: true }));
            try {
                const data = await adminApi.getDiscountAnalytics(codeId);
                setAnalytics((prev) => ({ ...prev, [codeId]: data }));
            } catch (err) {
                console.error('Failed to fetch analytics:', err);
                setAnalytics((prev) => ({ ...prev, [codeId]: { error: true } }));
            } finally {
                setAnalyticsLoading((prev) => ({ ...prev, [codeId]: false }));
            }
        }
    };

    return (
        <div className="p-6 lg:p-8">
            <FadeIn>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Discount Codes</h1>
                        <div className="flex items-center gap-2 text-gray-300">
                            <span>Manage discount codes</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            <span>{codes.length} total codes</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            <span>{groups.length} events</span>
                        </div>
                    </div>
                </div>

                <BulkActionBar
                    count={bulk.count}
                    busy={bulkBusy}
                    onClear={bulk.clear}
                    actions={[
                        { label: 'Activate', onClick: () => {
                            if (!window.confirm(`Activate ${bulk.count} codes?`)) return;
                            runBulk(adminApi.activateDiscountCode);
                        }},
                        { label: 'Deactivate', onClick: () => {
                            if (!window.confirm(`Deactivate ${bulk.count} codes?`)) return;
                            runBulk(adminApi.deactivateDiscountCode);
                        }},
                        { label: 'Delete', variant: 'danger', onClick: () => {
                            if (!window.confirm(`Delete ${bulk.count} codes? This cannot be undone.`)) return;
                            runBulk(adminApi.deleteDiscountCode);
                        }},
                    ]}
                />

                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-300">Loading discount codes...</div>
                    ) : codes.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-2xl">🏷️</span>
                                <span className="text-gray-300">No discount codes found</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Select-all across the current page's codes */}
                            <div className="flex items-center gap-3 px-6 py-3 border-b border-white/[0.05] bg-white/[0.02]">
                                <input
                                    type="checkbox"
                                    checked={bulk.isPageAllSelected(pageCodeIds)}
                                    onChange={() => bulk.togglePage(pageCodeIds)}
                                    className="w-4 h-4 rounded accent-violet-500 cursor-pointer"
                                    aria-label="Select all codes on this page"
                                />
                                <span className="text-xs text-gray-400">Select all on page</span>
                            </div>

                            <div className="divide-y divide-white/[0.05]">
                                {/* Level 1: event rows */}
                                {pageGroups.map((group) => (
                                    <div key={group.id}>
                                        <div
                                            className="flex items-center gap-3 px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                                            onClick={() => handleExpandEvent(group.id)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && handleExpandEvent(group.id)}
                                            aria-expanded={expandedEventId === group.id}
                                        >
                                            <svg className="w-4 h-4 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.5} />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 2v4M8 2v4M3 10h18" />
                                            </svg>
                                            <span className="text-white font-medium text-sm flex-1 min-w-0 truncate">{group.name}</span>
                                            <span className="text-gray-500 text-xs">{group.codes.length} code{group.codes.length !== 1 ? 's' : ''}</span>
                                            <span className="text-gray-500 text-xs">{expandedEventId === group.id ? '▲' : '▼'}</span>
                                        </div>

                                        {/* Level 2: codes under this event */}
                                        {expandedEventId === group.id && (
                                            <div className="bg-white/[0.01] divide-y divide-white/[0.04]">
                                                {group.codes.map((code) => (
                                                    <div key={code._id}>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pl-10 pr-6 py-4 hover:bg-white/[0.02] transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={bulk.isSelected(code._id)}
                                                                onChange={() => bulk.toggle(code._id)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-4 h-4 rounded accent-violet-500 cursor-pointer flex-shrink-0"
                                                                aria-label={`Select ${code.code}`}
                                                            />
                                                            <div
                                                                className="flex-1 min-w-0 cursor-pointer"
                                                                onClick={() => handleExpandCode(code._id)}
                                                                role="button"
                                                                tabIndex={0}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleExpandCode(code._id)}
                                                                aria-expanded={expandedCodeId === code._id}
                                                            >
                                                                <div className="flex items-center gap-3 flex-wrap">
                                                                    <span className="text-white font-mono font-semibold text-sm">{code.code}</span>
                                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${code.isActive ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                                                        {code.isActive ? 'Active' : 'Inactive'}
                                                                    </span>
                                                                    <span
                                                                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${isAdminCode(code) ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}
                                                                        title={isAdminCode(code) ? 'Platform code — applies across events' : 'Created by the event owner'}
                                                                    >
                                                                        {ownerKind(code)}
                                                                    </span>
                                                                </div>
                                                                <div className="text-gray-400 text-xs mt-1">
                                                                    {code.discountType === 'percentage' ? `${code.discountValue}% off` : `₹${code.discountValue} off`}
                                                                    {' · '}Uses: {code.usedCount}/{code.maxUses || '∞'}
                                                                </div>
                                                                <div className="text-gray-500 text-xs mt-0.5">
                                                                    Valid: {formatDate(code.validFrom)} – {formatDate(code.validUntil)}
                                                                    {code.createdBy && ` · By: ${code.createdBy.name || code.createdBy.email || 'Unknown'}`}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleToggleActive(code)}
                                                                    disabled={toggling[code._id]}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${code.isActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                                                >
                                                                    {toggling[code._id] ? '...' : code.isActive ? 'Deactivate' : 'Activate'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(code)}
                                                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                                                                    title="Delete discount code"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                                <span className="text-gray-500 text-xs hidden sm:block">{expandedCodeId === code._id ? '▲' : '▼'}</span>
                                                            </div>
                                                        </div>

                                                        {/* Level 3: analytics for this code */}
                                                        {expandedCodeId === code._id && (
                                                            <div className="pl-10 pr-6 pb-5 bg-white/[0.01]">
                                                                {analyticsLoading[code._id] ? (
                                                                    <p className="text-gray-400 text-sm py-3">Loading analytics...</p>
                                                                ) : analytics[code._id]?.error ? (
                                                                    <p className="text-red-400 text-sm py-3">Failed to load analytics</p>
                                                                ) : analytics[code._id] ? (
                                                                    <div>
                                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                                                                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                                                                                <p className="text-gray-400 text-xs">Total Uses</p>
                                                                                <p className="text-white text-lg font-semibold">{analytics[code._id].totalUses}</p>
                                                                            </div>
                                                                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                                                                                <p className="text-gray-400 text-xs">Total Revenue</p>
                                                                                <p className="text-white text-lg font-semibold">{formatCurrency(analytics[code._id].totalRevenue)}</p>
                                                                            </div>
                                                                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                                                                                <p className="text-gray-400 text-xs">Purchases</p>
                                                                                <p className="text-white text-lg font-semibold">{analytics[code._id].purchases?.length || 0}</p>
                                                                            </div>
                                                                        </div>

                                                                        {analytics[code._id].purchases?.length > 0 && (
                                                                            <div className="overflow-x-auto">
                                                                                <table className="w-full text-left text-sm">
                                                                                    <thead className="border-b border-white/[0.05]">
                                                                                        <tr>
                                                                                            <th className="pb-2 text-xs text-gray-400 font-medium">User</th>
                                                                                            <th className="pb-2 text-xs text-gray-400 font-medium">Amount</th>
                                                                                            <th className="pb-2 text-xs text-gray-400 font-medium">Date</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-white/[0.03]">
                                                                                        {analytics[code._id].purchases.map((p) => (
                                                                                            <tr key={p._id}>
                                                                                                <td className="py-2 text-gray-300">{p.user?.name || p.user?.email || 'Unknown'}</td>
                                                                                                <td className="py-2 text-gray-300">{formatCurrency(p.totalAmount || p.amount)}</td>
                                                                                                <td className="py-2 text-gray-500">{formatDate(p.createdAt)}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Pagination over event groups */}
                            <Pagination currentPage={page} totalPages={totalPages} onChange={setCurrentPage} />
                        </>
                    )}
                </div>
            </FadeIn>
        </div>
    );
}
