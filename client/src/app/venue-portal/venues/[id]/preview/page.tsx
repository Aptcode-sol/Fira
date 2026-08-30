'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { venuesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { openEditVenue } from '@/components/modals/CreateVenueLauncher';
import { VENUE_SAVED } from '@/components/modals/CreateVenueModal';

interface Venue {
    _id: string;
    name: string;
    description: string;
    images: string[];
    status: string;
    address: { street: string; city: string; state: string; pincode?: string; country?: string };
    pricing: { basePrice: number; pricePerHour?: number; currency: string };
    capacity: { min: number; max: number };
    amenities: string[];
    rules: string[];
    rating: { average: number; count: number };
    locationLink?: string;
    owner?: { _id?: string; name?: string; email?: string; avatar?: string } | string;
    availability?: { dayOfWeek: number; isAvailable: boolean; startTime?: string; endTime?: string }[];
    daySlots?: { date: string; isAvailable: boolean; isBooked: boolean }[];
    blockedDates?: { date: string; slots: { startTime: string; endTime: string; type: string }[] }[];
    createdAt?: string;
}

export default function VenueOwnerPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const venueId = params.id as string;

    const [venue, setVenue] = useState<Venue | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.push('/signin');
        if (!isLoading && isAuthenticated && !isVenueOwner(user)) router.push('/dashboard');
    }, [isLoading, isAuthenticated, user, router]);

    useEffect(() => {
        if (!isAuthenticated || !isVenueOwner(user) || !venueId) return;
        const fetchVenue = async () => {
            setLoading(true);
            try {
                const data = await venuesApi.getById(venueId) as Venue;
                setVenue(data);
            } catch (err) {
                console.error('Failed to fetch venue:', err);
                router.push('/venue-portal/venues');
            } finally {
                setLoading(false);
            }
        };
        fetchVenue();
        // Editing happens in a modal over this page, so nothing remounts on save.
        window.addEventListener(VENUE_SAVED, fetchVenue);
        return () => window.removeEventListener(VENUE_SAVED, fetchVenue);
    }, [isAuthenticated, user, venueId]);

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

    const getDateAvailability = (date: Date) => {
        const dayOfWeek = date.getDay();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;

        const blockedEntry = venue?.blockedDates?.find((b: any) => b.date === dateKey);
        const weeklySlot = venue?.availability?.find(a => a.dayOfWeek === dayOfWeek);
        const daySlot = venue?.daySlots?.find((s: any) => new Date(s.date).toDateString() === date.toDateString());

        const defaultStart = weeklySlot?.startTime || '09:00';
        const defaultEnd = weeklySlot?.endTime || '22:00';
        const slots: { startTime: string; endTime: string; type: 'busy' | 'booked' | 'available' }[] = [];

        if (daySlot?.isBooked) slots.push({ startTime: defaultStart, endTime: defaultEnd, type: 'booked' });
        if (blockedEntry?.slots?.length) {
            blockedEntry.slots.forEach((s: any) => slots.push({ startTime: s.startTime, endTime: s.endTime, type: s.type || 'busy' }));
        }

        let color = 'green';
        if (daySlot?.isBooked || (slots.length > 0 && slots.some(s => s.startTime === defaultStart && s.endTime === defaultEnd))) color = 'red';
        else if (slots.length > 0) color = 'orange';
        else if (daySlot && !daySlot.isAvailable) color = 'gray';
        else if (!weeklySlot?.isAvailable && weeklySlot) color = 'gray';

        return { slots, defaultStart, defaultEnd, color, isClosed: (weeklySlot && !weeklySlot.isAvailable) || (daySlot && !daySlot.isAvailable) };
    };

    if (isLoading || loading) {
        return (
            <VenueDashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </VenueDashboardLayout>
        );
    }

    if (!isAuthenticated || !isVenueOwner(user)) return null;

    if (!venue) {
        return (
            <VenueDashboardLayout>
                <div className="min-h-screen flex items-center justify-center text-center px-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">Venue not found</h1>
                        <Button onClick={() => router.push('/venue-portal/venues')}>Back to My Venues</Button>
                    </div>
                </div>
            </VenueDashboardLayout>
        );
    }

    return (
        <VenueDashboardLayout>
            <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">

                {/* Owner Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/venue-portal/venues')}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <p className="text-xs text-gray-300 uppercase tracking-wider mb-0.5">Venue Preview</p>
                            <h1 className="text-lg font-semibold text-white">{venue.name}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            venue.status === 'approved' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : venue.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                            {venue.status}
                        </span>
                        <Button variant="violet" size="sm" className="shadow-lg shadow-violet-500/25" onClick={() => openEditVenue(venueId)}>
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Venue
                        </Button>
                    </div>
                </div>

                {/* Image Gallery */}
                <div className="mb-8">
                    <div className="relative h-[360px] md:h-[460px] rounded-2xl overflow-hidden mb-3">
                        {venue.images && venue.images.length > 0 ? (
                            <img src={venue.images[selectedImage]} alt={venue.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
                                <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                                </svg>
                            </div>
                        )}
                    </div>
                    {venue.images && venue.images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {venue.images.map((image, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedImage(index)}
                                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === index ? 'border-violet-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                >
                                    <img src={image} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Title & Location */}
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <h2 className="text-3xl md:text-4xl font-bold text-white">{venue.name}</h2>
                                {venue.status === 'approved' && (
                                    <span className="px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium">
                                        Verified
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-gray-300 mb-4 flex-wrap">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                </svg>
                                <span>{venue.address.street}, {venue.address.city}, {venue.address.state}</span>
                                {venue.locationLink && (
                                    <a
                                        href={venue.locationLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs hover:bg-violet-500/30 transition-colors"
                                    >
                                        Open in Maps
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
                                        </svg>
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                            <h3 className="text-xl font-semibold text-white mb-4">About this venue</h3>
                            <p className="text-gray-300 leading-relaxed whitespace-pre-line">{venue.description}</p>
                        </div>

                        {/* Amenities */}
                        {venue.amenities && venue.amenities.length > 0 && (
                            <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                <h3 className="text-xl font-semibold text-white mb-4">Amenities</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {venue.amenities.map((amenity, index) => (
                                        <div key={index} className="flex items-center gap-2 text-gray-300">
                                            <svg className="w-5 h-5 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {amenity}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rules */}
                        {venue.rules && venue.rules.length > 0 && (
                            <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                <h3 className="text-xl font-semibold text-white mb-4">Venue Rules</h3>
                                <ul className="space-y-2">
                                    {venue.rules.map((rule, index) => (
                                        <li key={index} className="flex items-start gap-2 text-gray-300">
                                            <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            {rule}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Availability Calendar (read-only) */}
                        <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                            <h3 className="text-xl font-semibold text-white mb-2">Availability Calendar</h3>
                            <p className="text-gray-300 text-sm mb-6">Current booking status for the next 2 months.</p>

                            {/* Legend */}
                            <div className="flex flex-wrap gap-4 mb-6">
                                {[
                                    { color: 'bg-green-500/30 border-green-500/50', label: 'Available' },
                                    { color: 'bg-red-500/30 border-red-500/50', label: 'Booked' },
                                    { color: 'bg-orange-500/30 border-orange-500/50', label: 'Partially Booked' },
                                    { color: 'bg-gray-500/30 border-gray-500/50', label: 'Closed' },
                                ].map(({ color, label }) => (
                                    <div key={label} className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded border ${color}`} />
                                        <span className="text-sm text-gray-300">{label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Month Navigation */}
                            <div className="flex items-center justify-between mb-6">
                                <button
                                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <span className="text-white font-medium">
                                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </span>
                                <button
                                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                    <div key={d} className="text-center text-xs text-gray-300 font-medium py-2">{d}</div>
                                ))}
                                {(() => {
                                    const slots = [];
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const year = calendarMonth.getFullYear();
                                    const month = calendarMonth.getMonth();
                                    const firstDayOfMonth = new Date(year, month, 1);
                                    const lastDayOfMonth = new Date(year, month + 1, 0);
                                    const firstDayOfWeek = firstDayOfMonth.getDay();

                                    for (let i = 0; i < firstDayOfWeek; i++) {
                                        slots.push(<div key={`empty-${i}`} className="aspect-square" />);
                                    }
                                    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
                                        const date = new Date(year, month, d);
                                        const isPast = date < today;
                                        const isToday = date.toDateString() === today.toDateString();
                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                        const isHovered = hoveredDate === dateStr;
                                        const availability = getDateAvailability(date);

                                        let bgClass = '';
                                        if (isPast) bgClass = 'bg-gray-800/30 border-gray-700/30 text-gray-300';
                                        else if (availability.isClosed) bgClass = 'bg-gray-500/20 border-gray-500/40 text-gray-300';
                                        else if (availability.color === 'red') bgClass = 'bg-red-500/20 border-red-500/40 text-red-300';
                                        else if (availability.color === 'orange') bgClass = 'bg-orange-500/20 border-orange-500/40 text-orange-300';
                                        else bgClass = 'bg-green-500/20 border-green-500/40 text-green-300';

                                        slots.push(
                                            <div key={dateStr} className="relative">
                                                <div
                                                    className={`w-full aspect-square rounded-lg border text-xs font-medium flex items-center justify-center ${bgClass}`}
                                                    onMouseEnter={() => setHoveredDate(dateStr)}
                                                    onMouseLeave={() => setHoveredDate(null)}
                                                >
                                                    <span className={isToday ? 'font-bold' : ''}>{d}</span>
                                                </div>
                                                {isHovered && !isPast && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                                                        <div className="px-3 py-2 rounded-lg text-xs shadow-xl border bg-gray-900/95 border-gray-700 text-white min-w-[140px]">
                                                            <div className="font-semibold mb-1 text-gray-300">
                                                                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            </div>
                                                            {availability.isClosed ? (
                                                                <div className="flex items-center gap-1.5 text-gray-300">
                                                                    <span className="w-2 h-2 rounded-full bg-gray-500" /> Closed
                                                                </div>
                                                            ) : availability.slots.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {availability.slots.map((slot, idx) => (
                                                                        <div key={idx} className="flex items-center gap-1.5">
                                                                            <span className={`w-2 h-2 rounded-full ${slot.type === 'booked' ? 'bg-orange-500' : 'bg-red-500'}`} />
                                                                            <span className={slot.type === 'booked' ? 'text-orange-400' : 'text-red-400'}>
                                                                                {slot.type === 'booked' ? 'Booked' : 'Busy'}: {slot.startTime} – {slot.endTime}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 text-green-400">
                                                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                                                    Available: {availability.defaultStart} – {availability.defaultEnd}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900/95" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return slots;
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar — Owner Info Card (no Book Now) */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8 bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6 space-y-6">
                            {/* Price */}
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-white">{formatPrice(venue.pricing.basePrice)}</span>
                                    <span className="text-gray-300 text-sm">base price</span>
                                </div>
                                {venue.pricing.pricePerHour && (
                                    <p className="text-sm text-gray-300 mt-1">
                                        + {formatPrice(venue.pricing.pricePerHour)} per hour
                                    </p>
                                )}
                            </div>

                            {/* Quick Info */}
                            <div className="space-y-3 pb-6 border-b border-white/10">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-300">Capacity</span>
                                    <span className="text-white">{venue.capacity.min} – {venue.capacity.max} guests</span>
                                </div>
                                {venue.rating.count > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">Rating</span>
                                        <div className="flex items-center gap-1">
                                            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                            <span className="text-white">{venue.rating.average.toFixed(1)}</span>
                                            <span className="text-gray-300">({venue.rating.count})</span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-300">Status</span>
                                    <span className={`capitalize font-medium ${
                                        venue.status === 'approved' ? 'text-green-400'
                                        : venue.status === 'pending' ? 'text-yellow-400'
                                        : 'text-red-400'
                                    }`}>{venue.status}</span>
                                </div>
                            </div>

                            {/* Owner Actions */}
                            <div className="space-y-3">
                                <Button variant="violet" className="w-full shadow-lg shadow-violet-500/25" onClick={() => openEditVenue(venueId)}>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit Venue
                                </Button>
                                <button
                                    onClick={() => router.push('/venue-portal/venues')}
                                    className="w-full py-2.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all"
                                >
                                    Back to My Venues
                                </button>
                            </div>

                            <p className="text-xs text-gray-300 text-center">
                                This is your owner preview. Customers see this page with a booking option.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </VenueDashboardLayout>
    );
}
