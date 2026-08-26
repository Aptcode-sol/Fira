import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';

const formatCapacity = (capacity) => {
    if (capacity == null) return '—';
    if (typeof capacity === 'object') {
        const { min, max } = capacity;
        if (min != null && max != null) return `${min}–${max}`;
        return String(min ?? max ?? '—');
    }
    return String(capacity);
};

const statusBadge = (status) => {
    const map = {
        approved: 'bg-green-500/20 text-green-400 border-green-500/30',
        pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
        suspended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return map[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
};

// Admin-only view: bank details are surfaced here because this whole panel is
// gated behind the admin session (server also enforces adminAuth). (Flow 8.6)
function BankDetails({ bank }) {
    const hasAny = bank && (bank.accountNumber || bank.ifscCode || bank.accountName || bank.bankName);
    if (!hasAny) {
        return <p className="text-gray-500 text-sm py-2">No bank details on file.</p>;
    }
    const rows = [
        ['Account Name', bank.accountName],
        ['Account Number', bank.accountNumber],
        ['IFSC Code', bank.ifscCode],
        ['Bank Name', bank.bankName],
    ];
    return (
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                    Bank Details
                </span>
                <span className="text-[10px] text-gray-500">(admin-only)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rows.map(([label, value]) => (
                    <div key={label}>
                        <p className="text-gray-500 text-[11px]">{label}</p>
                        <p className="text-gray-200 text-sm break-all">{value || '—'}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function VenueOwners() {
    const [owners, setOwners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    const fetchOwners = async (searchTerm = '') => {
        try {
            setLoading(true);
            const data = await adminApi.getVenueOwners(searchTerm ? { search: searchTerm } : {});
            setOwners(data?.owners || []);
        } catch (err) {
            console.error('Failed to fetch venue owners:', err);
            setOwners([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOwners();
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchOwners(search.trim());
    };

    return (
        <div className="p-6 lg:p-8">
            <FadeIn>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Venue Owners</h1>
                        <div className="flex items-center gap-2 text-gray-300">
                            <span>Owners and their venues</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            <span>{owners.length} owners</span>
                        </div>
                    </div>
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name or email…"
                            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/20"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-white/[0.08] text-white text-sm hover:bg-white/[0.14] transition-colors"
                        >
                            Search
                        </button>
                    </form>
                </div>

                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-300">Loading venue owners…</div>
                    ) : owners.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-2xl">🏢</span>
                                <span className="text-gray-300">No venue owners found</span>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.05]">
                            {owners.map((owner) => {
                                const isOpen = expandedId === owner._id;
                                return (
                                    <div key={owner._id}>
                                        <div
                                            className="flex items-center gap-3 px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                                            onClick={() => setExpandedId(isOpen ? null : owner._id)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && setExpandedId(isOpen ? null : owner._id)}
                                            aria-expanded={isOpen}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-white font-semibold text-sm">
                                                        {owner.name || 'Unnamed'}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-500/20 text-blue-300 border-blue-500/30">
                                                        {owner.venues.length} venue{owner.venues.length === 1 ? '' : 's'}
                                                    </span>
                                                </div>
                                                <div className="text-gray-400 text-xs mt-1">
                                                    {owner.email}
                                                    {owner.phone && ` · ${owner.phone}`}
                                                </div>
                                            </div>
                                            <span className="text-gray-500 text-xs">{isOpen ? '▲' : '▼'}</span>
                                        </div>

                                        {isOpen && (
                                            <div className="px-6 pb-5 bg-white/[0.01] space-y-4">
                                                <BankDetails bank={owner.bankDetails} />

                                                <div>
                                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                                        Venues
                                                    </p>
                                                    {owner.venues.length === 0 ? (
                                                        <p className="text-gray-500 text-sm">No venues.</p>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-sm">
                                                                <thead className="border-b border-white/[0.05]">
                                                                    <tr>
                                                                        <th className="pb-2 text-xs text-gray-400 font-medium">Name</th>
                                                                        <th className="pb-2 text-xs text-gray-400 font-medium">City</th>
                                                                        <th className="pb-2 text-xs text-gray-400 font-medium">Capacity</th>
                                                                        <th className="pb-2 text-xs text-gray-400 font-medium">Status</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-white/[0.03]">
                                                                    {owner.venues.map((v) => (
                                                                        <tr key={v._id}>
                                                                            <td className="py-2 text-gray-200">
                                                                                <Link
                                                                                    to={`/venues/${v._id}`}
                                                                                    className="hover:text-white underline-offset-2 hover:underline"
                                                                                >
                                                                                    {v.name}
                                                                                </Link>
                                                                            </td>
                                                                            <td className="py-2 text-gray-400">
                                                                                {v.address?.city || '—'}
                                                                            </td>
                                                                            <td className="py-2 text-gray-400">
                                                                                {formatCapacity(v.capacity)}
                                                                            </td>
                                                                            <td className="py-2">
                                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(v.status)}`}>
                                                                                    {v.status || 'unknown'}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </FadeIn>
        </div>
    );
}
