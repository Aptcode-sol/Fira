'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Modal } from '@/components/ui';
import { venuesApi, bookingsApi } from '@/lib/api';
import { Venue } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

export default function VenueDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, user } = useAuth();
    const { showToast } = useToast();
    const [venue, setVenue] = useState<Venue | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(() => {
        const today = new Date();
        // Use local date format to avoid timezone issues
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    // Format date for display as dd/mm/yyyy
    const formatDateForDisplay = (dateStr: string | null) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    const [bookingData, setBookingData] = useState({
        date: '',
        startTime: '',
        endTime: '',
        guests: 50,
        purpose: '',
    });
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    // Get availability info for tooltip - returns all slots
    const getDateAvailability = (date: Date) => {
        const dayOfWeek = date.getDay();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blockedEntry = (venue as any)?.blockedDates?.find((b: any) => b.date === dateKey);
        const weeklySlot = venue?.availability?.find(a => a.dayOfWeek === dayOfWeek);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const daySlot = (venue as any)?.daySlots?.find((s: any) =>
            new Date(s.date).toDateString() === date.toDateString()
        );

        const defaultStart = weeklySlot?.startTime || '09:00';
        const defaultEnd = weeklySlot?.endTime || '22:00';
        const slots: { startTime: string; endTime: string; type: 'busy' | 'booked' | 'available' }[] = [];

        // Add booked slots if day is booked
        if (daySlot?.isBooked) {
            slots.push({ startTime: defaultStart, endTime: defaultEnd, type: 'booked' });
        }

        // Add blocked slots from venue's blockedDates
        if (blockedEntry?.slots && blockedEntry.slots.length > 0) {
            blockedEntry.slots.forEach((s: any) => {
                slots.push({ startTime: s.startTime, endTime: s.endTime, type: s.type || 'busy' });
            });
        }

        // Determine overall color
        let color = 'green';
        if (daySlot?.isBooked || (slots.length > 0 && slots.some(s => s.startTime === defaultStart && s.endTime === defaultEnd))) {
            color = 'red';
        } else if (slots.length > 0) {
            color = 'orange';
        } else if (daySlot && !daySlot.isAvailable) {
            color = 'gray';
        } else if (!weeklySlot?.isAvailable && weeklySlot) {
            color = 'gray';
        }

        return {
            slots,
            defaultStart,
            defaultEnd,
            color,
            isClosed: (weeklySlot && !weeklySlot.isAvailable) || (daySlot && !daySlot.isAvailable)
        };
    };

    useEffect(() => {
        if (params.id) {
            fetchVenue(params.id as string);
        }
    }, [params.id]);

    const fetchVenue = async (id: string) => {
        try {
            setIsLoading(true);
            const data = await venuesApi.getById(id);
            setVenue(data as Venue);
        } catch (error) {
            console.error('Failed to fetch venue:', error);
            // Use mock data
            setVenue(getMockVenue(id));
        } finally {
            setIsLoading(false);
        }
    };

    const handleBooking = () => {
        if (!isAuthenticated) {
            showToast('Please sign in to create an event', 'warning');
            router.push('/signin');
            return;
        }
        // Navigate to create event page with venue pre-selected
        router.push(`/create/event?venue=${venue?._id}`);
    };

    const submitBooking = async () => {
        if (!venue || !user) return;

        try {
            // Calculate total price
            const startHour = parseInt(bookingData.startTime.split(':')[0]);
            const endHour = parseInt(bookingData.endTime.split(':')[0]);
            const hours = endHour - startHour;
            const hourlyRate = venue.pricing.pricePerHour || 0;
            const totalAmount = venue.pricing.basePrice + (hours * hourlyRate);

            await bookingsApi.create({
                user: user._id,
                venue: venue._id,
                bookingDate: bookingData.date,
                startTime: bookingData.startTime,
                endTime: bookingData.endTime,
                purpose: bookingData.purpose,
                expectedGuests: bookingData.guests,
                totalAmount,
                status: 'pending'
            });

            showToast('Booking request sent! Awaiting owner approval.', 'success');
            setIsBookingModalOpen(false);
            setBookingData({ date: '', startTime: '', endTime: '', guests: 50, purpose: '' });
        } catch (error) {
            console.error('Booking error:', error);
            showToast('Failed to submit booking request', 'error');
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(price);
    };

    if (isLoading) {
        return (
            <>
                <PartyBackground />
                <Navbar />
                <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                    <div className="max-w-6xl mx-auto">
                        <div className="animate-pulse">
                            <div className="h-96 bg-white/5 rounded-2xl mb-8" />
                            <div className="h-8 bg-white/5 rounded w-1/3 mb-4" />
                            <div className="h-4 bg-white/5 rounded w-full mb-2" />
                            <div className="h-4 bg-white/5 rounded w-2/3" />
                        </div>
                    </div>
                </main>
            </>
        );
    }

    if (!venue) {
        return (
            <>
                <PartyBackground />
                <Navbar />
                <main className="relative z-20 min-h-screen pt-28 pb-16 px-4 flex items-center justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white mb-2">Venue not found</h1>
                        <p className="text-gray-400 mb-6">The venue you&apos;re looking for doesn&apos;t exist.</p>
                        <Button onClick={() => router.push('/venues')}>Browse Venues</Button>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Image Gallery */}
                    <div className="mb-8">
                        <div className="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden mb-4">
                            {venue.images && venue.images.length > 0 ? (
                                <img
                                    src={venue.images[selectedImage]}
                                    alt={venue.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
                                    <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        {/* Thumbnail Gallery */}
                        {venue.images && venue.images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {venue.images.map((image, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedImage(index)}
                                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === index ? 'border-violet-500' : 'border-transparent opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <img src={image} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Title & Location */}
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <h1 className="text-3xl md:text-4xl font-bold text-white">{venue.name}</h1>
                                    {venue.status === 'approved' && (
                                        <span className="px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium">
                                            Verified
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-gray-400 mb-4">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    <span>{venue.address.street}, {venue.address.city}, {venue.address.state}</span>
                                </div>

                                {/* Owner Info */}
                                {venue.owner && typeof venue.owner === 'object' && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-medium overflow-hidden">
                                            {(venue.owner as { avatar?: string; name?: string }).avatar ? (
                                                <img src={(venue.owner as { avatar: string }).avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                (venue.owner as { name?: string }).name?.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-medium">{(venue.owner as { name?: string }).name}</span>
                                                <svg className="w-4 h-4 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <span className="text-gray-400 text-sm">Venue Owner</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                <h2 className="text-xl font-semibold text-white mb-4">About this venue</h2>
                                <p className="text-gray-400 leading-relaxed">{venue.description}</p>
                            </div>

                            {/* Amenities */}
                            {venue.amenities && venue.amenities.length > 0 && (
                                <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                    <h2 className="text-xl font-semibold text-white mb-4">Amenities</h2>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {venue.amenities.map((amenity, index) => (
                                            <div key={index} className="flex items-center gap-2 text-gray-300">
                                                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                    <h2 className="text-xl font-semibold text-white mb-4">Venue Rules</h2>
                                    <ul className="space-y-2">
                                        {venue.rules.map((rule, index) => (
                                            <li key={index} className="flex items-start gap-2 text-gray-400">
                                                <svg className="w-5 h-5 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                {rule}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Day-wise Availability Calendar */}
                            <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Availability Calendar</h2>
                                <p className="text-gray-400 text-sm mb-6">Showing availability for the next 2 months. Day-wise booking only.</p>

                                {/* Legend */}
                                <div className="flex flex-wrap gap-4 mb-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50"></div>
                                        <span className="text-sm text-gray-400">Available</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500/50"></div>
                                        <span className="text-sm text-gray-400">Booked</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-orange-500/30 border border-orange-500/50"></div>
                                        <span className="text-sm text-gray-400">Partially Booked</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-gray-500/30 border border-gray-500/50"></div>
                                        <span className="text-sm text-gray-400">Closed</span>
                                    </div>
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
                                    {/* Day headers */}
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                        <div key={day} className="text-center text-xs text-gray-500 font-medium py-2">
                                            {day}
                                        </div>
                                    ))}

                                    {/* Generate calendar days for the month */}
                                    {(() => {
                                        const slots = [];
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);

                                        const year = calendarMonth.getFullYear();
                                        const month = calendarMonth.getMonth();
                                        const firstDayOfMonth = new Date(year, month, 1);
                                        const lastDayOfMonth = new Date(year, month + 1, 0);

                                        // Add empty slots for days before the first day of month
                                        const firstDayOfWeek = firstDayOfMonth.getDay();
                                        for (let i = 0; i < firstDayOfWeek; i++) {
                                            slots.push(
                                                <div key={`empty-${i}`} className="aspect-square"></div>
                                            );
                                        }

                                        // Generate days for this month
                                        for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
                                            const date = new Date(year, month, d);
                                            const isPast = date < today;
                                            const isToday = date.toDateString() === today.toDateString();

                                            const yearStr = date.getFullYear();
                                            const monthStr = String(date.getMonth() + 1).padStart(2, '0');
                                            const dayStr = String(date.getDate()).padStart(2, '0');
                                            const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
                                            const isSelected = selectedDate === dateStr;
                                            const isHovered = hoveredDate === dateStr;
                                            const availability = getDateAvailability(date);

                                            // Determine background class based on availability color
                                            let bgClass = '';
                                            if (isPast) {
                                                bgClass = 'bg-gray-800/30 border-gray-700/30 text-gray-600 cursor-not-allowed';
                                            } else if (isSelected) {
                                                bgClass = 'bg-violet-500/30 border-violet-500 ring-2 ring-violet-500 text-white cursor-pointer';
                                            } else if (availability.isClosed) {
                                                bgClass = 'bg-gray-500/20 border-gray-500/40 text-gray-500 cursor-not-allowed';
                                            } else if (availability.color === 'red') {
                                                bgClass = 'bg-red-500/20 border-red-500/40 text-red-300 cursor-not-allowed';
                                            } else if (availability.color === 'orange') {
                                                bgClass = 'bg-orange-500/20 border-orange-500/40 text-orange-300 hover:bg-orange-500/30 cursor-pointer';
                                            } else {
                                                bgClass = 'bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500/30 cursor-pointer';
                                            }

                                            slots.push(
                                                <div key={dateStr} className="relative">
                                                    <button
                                                        className={`w-full aspect-square rounded-lg border text-xs font-medium flex flex-col items-center justify-center transition-colors ${bgClass}`}
                                                        onClick={() => {
                                                            if (!isPast && !availability.isClosed && availability.color !== 'red') {
                                                                setSelectedDate(dateStr);
                                                            }
                                                        }}
                                                        disabled={isPast || availability.isClosed || availability.color === 'red'}
                                                        onMouseEnter={() => setHoveredDate(dateStr)}
                                                        onMouseLeave={() => setHoveredDate(null)}
                                                    >
                                                        <span className={isToday ? 'font-bold' : ''}>{d}</span>
                                                    </button>

                                                    {/* Hover Tooltip */}
                                                    {isHovered && !isPast && (
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                                                            <div className="px-3 py-2 rounded-lg text-xs shadow-xl border bg-gray-900/95 border-gray-700 text-white min-w-[140px]">
                                                                <div className="font-semibold mb-1 text-gray-300">
                                                                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                </div>
                                                                {availability.isClosed ? (
                                                                    <div className="flex items-center gap-1.5 text-gray-400">
                                                                        <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                                                        Closed
                                                                    </div>
                                                                ) : availability.slots.length > 0 ? (
                                                                    <div className="space-y-1">
                                                                        {availability.slots.map((slot, idx) => (
                                                                            <div key={idx} className="flex items-center gap-1.5">
                                                                                <span className={`w-2 h-2 rounded-full ${slot.type === 'booked' ? 'bg-orange-500' : 'bg-red-500'}`}></span>
                                                                                <span className={slot.type === 'booked' ? 'text-orange-400' : 'text-red-400'}>
                                                                                    {slot.type === 'booked' ? 'Booked' : 'Busy'}: {slot.startTime} - {slot.endTime}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                        <div className="flex items-center gap-1.5 text-green-400">
                                                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                                            Available: Other hours
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 text-green-400">
                                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                                        Available: {availability.defaultStart} - {availability.defaultEnd}
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

                        {/* Sidebar - Booking Card */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-28 bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                {/* Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-white">{formatPrice(venue.pricing.basePrice)}</span>
                                        <span className="text-gray-400">base price</span>
                                    </div>
                                    {venue.pricing.pricePerHour && (
                                        <p className="text-sm text-gray-500 mt-1">
                                            + {formatPrice(venue.pricing.pricePerHour)} per hour
                                        </p>
                                    )}
                                </div>

                                {/* Quick Info */}
                                <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Capacity</span>
                                        <span className="text-white">{venue.capacity.min} - {venue.capacity.max} guests</span>
                                    </div>
                                    {venue.rating.count > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-400">Rating</span>
                                            <div className="flex items-center gap-1">
                                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                <span className="text-white">{venue.rating.average.toFixed(1)}</span>
                                                <span className="text-gray-500">({venue.rating.count} reviews)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Button className="w-full" size="lg" onClick={handleBooking}>
                                    Request Booking
                                </Button>

                                <p className="text-xs text-gray-500 text-center mt-4">
                                    You won&apos;t be charged until the owner accepts your request
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Booking Modal */}
            <Modal
                isOpen={isBookingModalOpen}
                onClose={() => setIsBookingModalOpen(false)}
                title="Request Booking"
                size="lg"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Select Date</label>
                        <input
                            type="date"
                            value={bookingData.date || selectedDate || ''}
                            onChange={(e) => {
                                setBookingData({ ...bookingData, date: e.target.value });
                                setSelectedDate(e.target.value);
                            }}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Start Time</label>
                            <input
                                type="time"
                                value={bookingData.startTime}
                                onChange={(e) => setBookingData({ ...bookingData, startTime: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">End Time</label>
                            <input
                                type="time"
                                value={bookingData.endTime}
                                onChange={(e) => setBookingData({ ...bookingData, endTime: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Expected Guests</label>
                        <input
                            type="number"
                            min={venue?.capacity.min}
                            max={venue?.capacity.max}
                            value={bookingData.guests}
                            onChange={(e) => setBookingData({ ...bookingData, guests: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Purpose / Event Type</label>
                        <textarea
                            value={bookingData.purpose}
                            onChange={(e) => setBookingData({ ...bookingData, purpose: e.target.value })}
                            placeholder="Describe your event..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <Button variant="secondary" className="flex-1" onClick={() => setIsBookingModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="flex-1" onClick={submitBooking}>
                            Submit Request
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

// Mock venue data
function getMockVenue(id: string): Venue {
    return {
        _id: id,
        owner: 'owner1',
        name: 'The Grand Ballroom',
        description: 'Experience luxury and elegance at The Grand Ballroom, one of the most prestigious event venues in Mumbai. Our stunning space features crystal chandeliers, marble flooring, and floor-to-ceiling windows overlooking the Arabian Sea. Perfect for weddings, corporate events, galas, and celebrations of all kinds.\n\nWith a dedicated team of event professionals and state-of-the-art facilities, we ensure every event is executed flawlessly. Our in-house catering team offers a diverse menu of international and local cuisines to delight your guests.',
        images: [
            'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200',
            'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
            'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800',
            'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
        ],
        videos: [],
        capacity: { min: 50, max: 500 },
        pricing: { basePrice: 50000, pricePerHour: 5000, currency: 'INR' },
        amenities: ['Parking', 'Catering', 'Sound System', 'Lighting', 'AC', 'WiFi', 'Stage', 'Green Room', 'Valet', 'Security'],
        rules: ['No outside alcohol', 'Event must end by midnight', 'Advance booking required', 'Decoration approval needed'],
        location: { type: 'Point', coordinates: [72.8777, 19.0760] },
        address: { street: 'Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '400002', country: 'India' },
        availability: [],
        blockedDates: [],
        status: 'approved',
        rating: { average: 4.8, count: 124 },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}
