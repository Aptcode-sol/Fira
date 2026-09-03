import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';
import { Button } from '../components/ui/Button';
import { useBulkSelection } from '../lib/useBulkSelection';
import BulkActionBar from '../components/BulkActionBar';

const ITEMS_PER_PAGE = 10;

export default function Users() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [bulkBusy, setBulkBusy] = useState(false);
    const bulk = useBulkSelection();
    const pageIds = users.map((u) => u._id);

    useEffect(() => {
        fetchUsers();
    }, [filter, currentPage, search]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const params = { page: currentPage, limit: ITEMS_PER_PAGE };
            if (filter !== 'all') params.status = filter;
            if (search) params.search = search;
            const data = await adminApi.getUsers(params);
            setUsers(data.users || []);
            setTotalPages(data.totalPages || 1);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        setCurrentPage(1);
    };

    const handleBlock = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Block this user? They will lose access to their account.')) return;
        try {
            await adminApi.blockUser(id);
            fetchUsers();
        } catch (err) {
            console.error('Failed to block user:', err);
        }
    };

    const handleUnblock = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Unblock this user? They will regain full access to their account.')) return;
        try {
            await adminApi.unblockUser(id);
            fetchUsers();
        } catch (err) {
            console.error('Failed to unblock user:', err);
        }
    };

    // Irreversible: removes the account plus every event, venue, booking,
    // ticket and post it owns. window.confirm is the guard - native, and the
    // operator has to acknowledge the blast radius before the request is sent.
    const handleDelete = async (user, e) => {
        e.stopPropagation();
        const label = user.name || user.email || 'this user';
        if (!window.confirm(`Permanently delete ${label}?\n\nThis also removes their events, venues, bookings, tickets and posts. This cannot be undone.`)) return;
        try {
            await adminApi.deleteUser(user._id);
            fetchUsers();
        } catch (err) {
            console.error('Failed to delete user:', err);
            alert(err.message || 'Failed to delete user');
        }
    };

    // Run one admin call per selected id, sequentially so a mid-batch failure
    // stops rather than firing the rest blind. Refetch + clear selection after.
    const runBulk = async (label, fn) => {
        if (bulk.count === 0) return;
        if (!window.confirm(`${label} ${bulk.count} selected user${bulk.count !== 1 ? 's' : ''}?`)) return;
        setBulkBusy(true);
        try {
            for (const id of bulk.selectedIds) {
                await fn(id);
            }
            bulk.clear();
            await fetchUsers();
        } catch (err) {
            alert(err.message || `Failed to ${label.toLowerCase()} some users`);
            await fetchUsers();
        } finally {
            setBulkBusy(false);
        }
    };

    const bulkActions = [
        { label: 'Block', variant: 'danger', onClick: () => runBulk('Block', (id) => adminApi.blockUser(id)) },
        { label: 'Unblock', onClick: () => runBulk('Unblock', (id) => adminApi.unblockUser(id)) },
        { label: 'Delete', variant: 'danger', onClick: () => runBulk('Permanently delete', (id) => adminApi.deleteUser(id)) },
    ];

    // The User model has no `status` field - block state lives on `isBlocked`.
    const userStatus = (user) => (user.isBlocked ? 'blocked' : 'active');

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'blocked': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    // Prefer the `roles` array (source of truth); fall back to legacy `role`.
    // Surface adminRole (super_admin/admin/moderator) as its own badge when set.
    const userRoleLabels = (user) => {
        const labels = Array.isArray(user.roles) && user.roles.length
            ? [...user.roles]
            : (user.role ? [user.role] : []);
        if (user.adminRole && !labels.includes(user.adminRole)) labels.push(user.adminRole);
        return labels.length ? labels : ['user'];
    };

    const getRoleColor = (label) => {
        switch (label) {
            case 'admin':
            case 'super_admin':
                return 'bg-red-500/20 text-red-400 border-red-500/20';
            case 'moderator':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/20';
            case 'venue_owner':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
            default:
                return 'bg-violet-500/20 text-violet-400 border-violet-500/20';
        }
    };

    const formatRoleLabel = (label) => label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <FadeIn>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Users</h1>
                        <div className="flex items-center gap-2 text-gray-300">
                            <span>Manage user accounts</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            <span>{total} total</span>
                        </div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                        {['all', 'active', 'blocked'].map(status => (
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
                                placeholder="Search users..."
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

                {/* Bulk action bar - appears only when rows are selected */}
                <BulkActionBar
                    count={bulk.count}
                    actions={bulkActions}
                    onClear={bulk.clear}
                    busy={bulkBusy}
                />

                {/* Table */}
                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-300">Loading users...</div>
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
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">User</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Badge</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Phone</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Followers</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Joined</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.05]">
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-12 text-center text-gray-300">
                                                No users found matching your criteria
                                            </td>
                                        </tr>
                                    ) : users.map((user) => (
                                        <tr
                                            key={user._id}
                                            onClick={() => navigate(`/users/${user._id}`)}
                                            className={`hover:bg-white/[0.02] transition-colors group cursor-pointer ${bulk.isSelected(user._id) ? 'bg-violet-500/5' : ''}`}
                                        >
                                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={bulk.isSelected(user._id)}
                                                    onChange={() => bulk.toggle(user._id)}
                                                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500 cursor-pointer"
                                                    aria-label={`Select ${user.name || user.email}`}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-white font-medium border border-white/10 overflow-hidden">
                                                        {(user.name?.charAt(0) || 'U').toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-white group-hover:text-blue-400 transition-colors">{user.name}</span>
                                                        <span className="text-gray-300 text-xs">{user.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-300 text-sm">
                                                <div className="flex flex-wrap gap-1">
                                                    {userRoleLabels(user).map(label => (
                                                        <span
                                                            key={label}
                                                            className={`px-2 py-0.5 rounded text-xs font-medium border ${getRoleColor(label)}`}
                                                        >
                                                            {formatRoleLabel(label)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-300 text-sm">{user.phoneNumber || 'N/A'}</td>
                                            <td className="px-6 py-4 text-gray-300 text-sm">{(user.followers?.length || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-gray-300 text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(userStatus(user))}`}>
                                                    {userStatus(user).charAt(0).toUpperCase() + userStatus(user).slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    {userStatus(user) !== 'blocked' && (
                                                        <button
                                                            onClick={(e) => handleBlock(user._id, e)}
                                                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
                                                            title="Block User"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    {userStatus(user) === 'blocked' && (
                                                        <button
                                                            onClick={(e) => handleUnblock(user._id, e)}
                                                            className="p-2 rounded-lg text-green-400 hover:bg-green-500/20 hover:text-green-300 transition-all"
                                                            title="Unblock User"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => handleDelete(user, e)}
                                                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
                                                        title="Delete User"
                                                        aria-label={`Delete ${user.name || user.email || 'user'}`}
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
