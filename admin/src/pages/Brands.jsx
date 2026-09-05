import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { useBulkSelection } from '../lib/useBulkSelection';
import BulkActionBar from '../components/BulkActionBar';

const ITEMS_PER_PAGE = 10;

export default function Brands() {
    const navigate = useNavigate();
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [bulkBusy, setBulkBusy] = useState(false);
    const bulk = useBulkSelection();
    const pageIds = brands.map((b) => b._id);

    useEffect(() => {
        fetchBrands();
    }, [filter, currentPage, search]);

    const fetchBrands = async () => {
        try {
            setLoading(true);
            const params = { page: currentPage, limit: ITEMS_PER_PAGE };
            if (filter !== 'all') params.status = filter;
            if (search) params.search = search;
            const data = await adminApi.getBrands(params);
            setBrands(data.brands || []);
            setTotalPages(data.totalPages || 1);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch creators:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        setCurrentPage(1);
    };

    const handleApprove = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Approve this creator? They will be publicly visible and earn a verified badge.')) return;
        try {
            await adminApi.updateBrandStatus(id, 'approved');
            fetchBrands();
        } catch (err) {
            console.error('Failed to approve creator:', err);
        }
    };

    const handleReject = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Reject this creator application?')) return;
        try {
            await adminApi.updateBrandStatus(id, 'rejected');
            fetchBrands();
        } catch (err) {
            console.error('Failed to reject creator:', err);
        }
    };

    const handleBlock = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Block this creator? Their profile will be hidden and their verified badge removed.')) return;
        try {
            await adminApi.updateBrandStatus(id, 'blocked');
            fetchBrands();
        } catch (err) {
            console.error('Failed to block creator:', err);
        }
    };

    // Hard delete. Unlike block, this removes the profile entirely and resets the
    // owner's verified badge, letting them apply again from scratch - which is the
    // whole point of offering it. The confirm spells that out because it cannot be
    // undone.
    const handleDelete = async (brand, e) => {
        e.stopPropagation();
        const owner = brand.owner?.name || brand.user?.name || 'its owner';
        if (!window.confirm(
            `Delete "${brand.name}"?\n\nThis permanently removes the creator profile and its posts, and resets ${owner}'s verified badge so they can create a new profile. This cannot be undone.`
        )) return;
        try {
            await adminApi.deleteBrand(brand._id);
            fetchBrands();
        } catch (err) {
            console.error('Failed to delete creator:', err);
            alert(err.message || 'Failed to delete creator');
        }
    };

    const runBulk = async (label, fn) => {
        if (bulk.count === 0) return;
        if (!window.confirm(`${label} ${bulk.count} selected creator${bulk.count !== 1 ? 's' : ''}?`)) return;
        setBulkBusy(true);
        try {
            for (const id of bulk.selectedIds) await fn(id);
            bulk.clear();
            await fetchBrands();
        } catch (err) {
            alert(err.message || `Failed to ${label.toLowerCase()} some creators`);
            await fetchBrands();
        } finally {
            setBulkBusy(false);
        }
    };

    const bulkActions = [
        { label: 'Approve', onClick: () => runBulk('Approve', (id) => adminApi.updateBrandStatus(id, 'approved')) },
        { label: 'Reject', variant: 'danger', onClick: () => runBulk('Reject', (id) => adminApi.updateBrandStatus(id, 'rejected')) },
        { label: 'Block', variant: 'danger', onClick: () => runBulk('Block', (id) => adminApi.updateBrandStatus(id, 'blocked')) },
        { label: 'Delete', variant: 'danger', onClick: () => runBulk('Permanently delete', (id) => adminApi.deleteBrand(id)) },
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'blocked': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const pendingCount = brands.filter(b => b.status === 'pending').length;

    return (
        <div className="p-6 lg:p-8">
            <FadeIn>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Creators</h1>
                        <div className="flex items-center gap-2 text-gray-300">
                            <span>Manage and approve creator profiles</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            <span>{total} total</span>
                        </div>
                    </div>
                    {pendingCount > 0 && (
                        <div className="bg-yellow-500/10 text-yellow-400 px-4 py-2 rounded-xl border border-yellow-500/20 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                            {pendingCount} pending approvals
                        </div>
                    )}
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                        {['all', 'pending', 'approved', 'rejected'].map(status => (
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
                                placeholder="Search creators..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                            />
                            <svg className="w-5 h-5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                {/* Bulk action bar */}
                <BulkActionBar count={bulk.count} actions={bulkActions} onClear={bulk.clear} busy={bulkBusy} />

                {/* Table */}
                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-300">Loading creators...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white/[0.02] border-b border-white/[0.05]">
                                    <tr>
                                        <th className="px-6 py-4 w-10">
                                            <input
                                                type="checkbox"
                                                checked={bulk.isPageAllSelected(pageIds)}
                                                onChange={() => bulk.togglePage(pageIds)}
                                                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500 cursor-pointer"
                                                aria-label="Select all on this page"
                                            />
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Creator</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Owner</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Followers</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Events</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.05]">
                                    {brands.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-12 text-center text-gray-300">
                                                No creators found matching your criteria
                                            </td>
                                        </tr>
                                    ) : brands.map((brand) => (
                                        <tr
                                            key={brand._id}
                                            onClick={() => navigate(`/brands/${brand._id}`)}
                                            className={`hover:bg-white/[0.02] transition-colors cursor-pointer group ${bulk.isSelected(brand._id) ? 'bg-violet-500/5' : ''}`}
                                        >
                                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={bulk.isSelected(brand._id)}
                                                    onChange={() => bulk.toggle(brand._id)}
                                                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500 cursor-pointer"
                                                    aria-label={`Select ${brand.name}`}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-white font-medium border border-white/10 group-hover:scale-105 transition-transform overflow-hidden">
                                                        {brand.logo ? (
                                                            <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            (brand.name?.charAt(0) || 'C').toUpperCase()
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-white group-hover:text-violet-400 transition-colors">{brand.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-white text-sm">{brand.owner?.name || 'N/A'}</span>
                                                    <span className="text-gray-300 text-xs">{brand.owner?.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-300 text-sm capitalize">{brand.type || 'Individual'}</td>
                                            <td className="px-6 py-4 text-gray-300 text-sm">{(brand.followersCount || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-gray-300 text-sm">{brand.eventsCount || 0}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(brand.status)}`}>
                                                    {brand.status.charAt(0).toUpperCase() + brand.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    {brand.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={(e) => handleApprove(brand._id, e)}
                                                                className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/20 transition-colors"
                                                                title="Approve"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleReject(brand._id, e)}
                                                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                                                                title="Reject"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </>
                                                    )}
                                                    {brand.status === 'approved' && (
                                                        <button
                                                            onClick={(e) => handleBlock(brand._id, e)}
                                                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                                                            title="Block"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    {brand.status === 'blocked' && (
                                                        <button
                                                            onClick={(e) => handleApprove(brand._id, e)}
                                                            className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/20 transition-colors"
                                                            title="Unblock"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    {/* Delete is offered on every row, whatever the
                                                        status: its purpose is to free the owner to
                                                        re-apply, which is as valid for a rejected or
                                                        blocked profile as an approved one. */}
                                                    <button
                                                        onClick={(e) => handleDelete(brand, e)}
                                                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                                                        title="Delete creator"
                                                        aria-label={`Delete creator ${brand.name}`}
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    <Pagination currentPage={currentPage} totalPages={totalPages} onChange={setCurrentPage} />
                </div>
            </FadeIn>
        </div>
    );
}
