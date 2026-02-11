import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import adminApi from '../api/adminApi';
import { FadeIn } from '../components/animations';

export default function VenueDetail() {
    const { id } = useParams();
    const [venue, setVenue] = useState(null);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchVenue();
    }, [id]);

    const fetchVenue = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getVenueById(id);
            setVenue(data);
            setStats(data.stats || {});
        } catch (err) {
            console.error('Failed to fetch venue:', err);
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
        return <div className="p-12 text-center text-gray-500">Loading venue details...</div>;
    }

    if (!venue) {
        return (
            <div className="p-12 text-center text-gray-500">
                <p>Venue not found</p>
                <Link to="/venues" className="text-violet-400 hover:text-violet-300 mt-4 inline-block">← Back to Venues</Link>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8">
            <FadeIn>
                {/* Header */}
                <div className="flex flex-col gap-6 mb-8">
                    <Link to="/venues" className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors w-fit">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back to Venues
                    </Link>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{venue.name}</h1>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-gray-400">
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {venue.address?.street}, {venue.address?.city}
                                </span>
                                <span className="hidden sm:inline">•</span>
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Capacity: {venue.capacity}
                                </span>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${venue.status === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                venue.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                    venue.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            }`}>
                            {venue.status.charAt(0).toUpperCase() + venue.status.slice(1)}
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
                            <span className="text-gray-400 font-medium">Total Bookings</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{stats.totalBookings || 0}</div>
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
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 6v6l4 2" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Per Hour</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{formatCurrency(venue.pricePerHour)}</div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium">Rating</span>
                        </div>
                        <div className="text-2xl font-bold text-white pl-1">{venue.rating?.average?.toFixed(1) || 'N/A'}</div>
                    </div>
                </div>

                {/* Content Logic */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Owner & Details */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Owner Info */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Owner Information</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Name</div>
                                    <div className="text-white font-medium">{venue.owner?.name || 'N/A'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Email</div>
                                    <div className="text-white">{venue.owner?.email || 'N/A'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Phone</div>
                                    <div className="text-white">{venue.owner?.phone || 'N/A'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Amenities */}
                        {venue.amenities && venue.amenities.length > 0 && (
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                <h2 className="text-lg font-semibold text-white mb-4">Amenities</h2>
                                <div className="flex flex-wrap gap-2">
                                    {venue.amenities.map((amenity, i) => (
                                        <span key={i} className="px-3 py-1.5 rounded-full bg-violet-500/15 text-violet-400 text-sm font-medium border border-violet-500/20">
                                            {amenity}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {venue.description && (
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                <h2 className="text-lg font-semibold text-white mb-4">Description</h2>
                                <p className="text-gray-300 leading-relaxed">{venue.description}</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Summary Card */}
                    <div>
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 sticky top-8">
                            <h2 className="text-lg font-semibold text-white mb-4">Booking Summary</h2>
                            <div className="space-y-4">
                                <div className="flex justifying-between items-center">
                                    <span className="text-gray-400">Completed Bookings</span>
                                    <span className="text-white font-medium ml-auto">{stats.completedBookings || 0}</span>
                                </div>
                                <div className="pt-4 border-t border-white/10 flex justifying-between items-center">
                                    <span className="text-gray-400">Total Revenue</span>
                                    <span className="text-green-400 font-bold ml-auto text-lg">{formatCurrency(stats.totalRevenue)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </FadeIn>
        </div>
    );
}
