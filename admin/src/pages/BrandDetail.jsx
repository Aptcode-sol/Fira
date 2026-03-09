import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';

export default function BrandDetail() {
    const { id } = useParams();
    const [brand, setBrand] = useState(null);
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBrand();
    }, [id]);

    const fetchBrand = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getBrandById(id);
            setBrand(data);
            setEvents(data.events || []);
            setStats(data.stats || {});
        } catch (err) {
            console.error('Failed to fetch brand:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    if (loading) {
        return <div className="p-12 text-center text-gray-500">Loading brand details...</div>;
    }

    if (!brand) {
        return (
            <div className="p-12 text-center text-gray-500">
                <p>Brand not found</p>
                <Link to="/brands" className="text-violet-400 hover:text-violet-300 mt-4 inline-block">← Back to Brands</Link>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8">
            <FadeIn>
                {/* Header */}
                <div className="flex flex-col gap-6 mb-8">
                    <Link to="/brands" className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors w-fit">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back to Creators
                    </Link>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-2xl font-bold text-white border border-white/10">
                                {brand.name?.charAt(0) || 'B'}
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-1">{brand.name}</h1>
                                <p className="text-gray-400 flex items-center gap-2">
                                    <span>{brand.type}</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                                    <span>{(brand.stats?.followers || 0).toLocaleString()} followers</span>
                                </p>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${brand.status === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            brand.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                brand.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                    'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            }`}>
                            {brand.status || 'approved'}
                        </span>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <path d="M16 2v4M8 2v4M3 10h18" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Events Hosted</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{stats.eventsHosted || brand.stats?.events || 0}</div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-green-500/10 text-green-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Total Revenue</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{formatCurrency(stats.totalRevenue)}</div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Followers</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{(brand.stats?.followers || 0).toLocaleString()}</div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 6v6l4 2" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Profile Views</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{(brand.stats?.views || 0).toLocaleString()}</div>
                    </div>
                </div>

                {/* Brand Info */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Creator Information</h2>
                            <p className="text-gray-300 leading-relaxed mb-6">{brand.bio || 'No bio available'}</p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-white/[0.05]">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Owner</div>
                                    <div className="text-white font-medium">{brand.user?.name || 'N/A'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Email</div>
                                    <div className="text-white">{brand.user?.email || 'N/A'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Phone</div>
                                    <div className="text-white">{brand.user?.phone || 'N/A'}</div>
                                </div>
                            </div>

                            {brand.socialLinks?.instagram && (
                                <div className="mt-6 pt-6 border-t border-white/[0.05]">
                                    <div className="text-xs text-gray-500 mb-1">Instagram</div>
                                    <a href="#" className="text-violet-400 hover:text-violet-300 transition-colors">@{brand.socialLinks.instagram}</a>
                                </div>
                            )}
                        </div>

                        {/* Events Hosted */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
                            <div className="p-6 border-b border-white/[0.05]">
                                <h2 className="text-lg font-semibold text-white">Events Hosted</h2>
                            </div>

                            {events.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    No events found
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.05]">
                                    {events.map((event) => (
                                        <Link to={`/events/${event._id}`} key={event._id} className="block p-6 hover:bg-white/[0.02] transition-colors group">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div>
                                                    <h3 className="text-lg font-medium text-white group-hover:text-violet-400 transition-colors mb-1">{event.name}</h3>
                                                    <div className="flex items-center gap-3 text-sm text-gray-400">
                                                        <span>{event.venue?.name || 'N/A'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                                                        <span>{new Date(event.date).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right hidden sm:block">
                                                        <div className="text-sm text-gray-400">
                                                            <span className="text-white font-medium">{event.currentAttendees || 0}</span> / {event.maxAttendees} tickets
                                                        </div>
                                                    </div>
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${event.status === 'upcoming' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                                        }`}>
                                                        {event.status}
                                                    </span>
                                                    <svg className="w-5 h-5 text-gray-500 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </FadeIn>
        </div>
    );
}
