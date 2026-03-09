import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';
import { Button } from '../components/ui/Button';

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
        try {
            await adminApi.updateBrandStatus(id, 'approved');
            fetchBrands();
        } catch (err) {
            console.error('Failed to approve creator:', err);
        }
    };

    const handleReject = async (id, e) => {
        e.stopPropagation();
        try {
            await adminApi.updateBrandStatus(id, 'rejected');
            fetchBrands();
        } catch (err) {
            console.error('Failed to reject creator:', err);
        }
    };

    const handleBlock = async (id, e) => {
        e.stopPropagation();
        try {
            await adminApi.updateBrandStatus(id, 'blocked');
            fetchBrands();
        } catch (err) {
            console.error('Failed to block creator:', err);
        }
    };

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
                        <div className="flex items-center gap-2 text-gray-400">
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
                        <div className="p-12 text-center text-gray-500">Loading creators...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white/[0.02] border-b border-white/[0.05]">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Creator</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Owner</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Followers</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Events</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.05]">
                                    {brands.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                                No creators found matching your criteria
                                            </td>
                                        </tr>
                                    ) : brands.map((brand) => (
                                        <tr
                                            key={brand._id}
                                            onClick={() => navigate(`/brands/${brand._id}`)}
                                            className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                        >
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
                                                    <span className="text-gray-500 text-xs">{brand.owner?.email}</span>
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
            </FadeIn>
        </div>
    );
}
