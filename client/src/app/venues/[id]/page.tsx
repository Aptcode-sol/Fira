'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { BackButton, Button, Modal } from '@/components/ui';
import { venuesApi, bookingsApi } from '@/lib/api';
import { venueDayRate, venueBookingTotal, billableDays, bookingAdvance } from '@/lib/venuePricing';
import { Venue } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import InquiryForm from '@/components/InquiryForm';

/**
 * How long the success state stays on screen before we navigate to the
 * dashboard. Long enough to actually read the confirmation, short enough that
 * nobody thinks the page has hung.
 */
const SUCCESS_REDIRECT_DELAY_MS = 3000;

/**
 * Blank booking form. Declared once because the initial state and the post-success
 * reset both need it, and they previously carried separate literals.
 *
 * Times start at 00:00 rather than empty. An empty time input renders as "--:--"
 * and Android's picker opens on the current clock, so the value you got depended on
 * when you happened to open the form. Pricing is per-day, so the times do not affect
 * what is charged - and prefilling them means the cost summary, which only shows
 * once both are set, is visible immediately instead of after two extra taps.
 */
const EMPTY_BOOKING = {
    date: '',
    endDate: '',
    startTime: '00:00',
    endTime: '00:00',
    guests: 50,
    purpose: '',
};

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
    const [showBookingOptionsModal, setShowBookingOptionsModal] = useState(false);

    // Format date for display as dd/mm/yyyy
    const formatDateForDisplay = (dateStr: string | null) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    const [bookingData, setBookingData] = useState(EMPTY_BOOKING);
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [isSubmitting, setIsSubmitting] = useState(false);
    // In-modal booking validation errors (8.4/8.6) — keyed by field so each
    // error renders next to its input inside the modal, never behind it.
    const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({});

    // Availability calendar is bounded to the current month + next (the copy
    // says "next 2 months"), so navigation is clamped to that 2-month window
    // (8.11). ponytail: 2 is the copy's ceiling; widen both the copy and this
    // bound together if the availability window ever grows.
    const CALENDAR_MONTHS = 2;
    const calendarFirstMonth = (() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    })();
    const calendarLastMonth = new Date(
        calendarFirstMonth.getFullYear(),
        calendarFirstMonth.getMonth() + (CALENDAR_MONTHS - 1),
        1
    );
    const canGoPrevMonth =
        calendarMonth.getFullYear() > calendarFirstMonth.getFullYear() ||
        (calendarMonth.getFullYear() === calendarFirstMonth.getFullYear() &&
            calendarMonth.getMonth() > calendarFirstMonth.getMonth());
    const canGoNextMonth =
        calendarMonth.getFullYear() < calendarLastMonth.getFullYear() ||
        (calendarMonth.getFullYear() === calendarLastMonth.getFullYear() &&
            calendarMonth.getMonth() < calendarLastMonth.getMonth());

    // Review form state
    const [canReview, setCanReview] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [reviewSuccess, setReviewSuccess] = useState<any>(null);

    // Inquiry modal state
    const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

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

    // Check if user can leave a review (has completed booking at this venue)
    const checkReviewEligibility = useCallback(async () => {
        if (!isAuthenticated || !user?._id || !params.id) {
            setCanReview(false);
            return;
        }
        try {
            const bookings = await bookingsApi.getUserBookings(user._id) as any[];
            const hasCompleted = bookings.some(
                (b: any) => (b.venue === params.id || b.venue?._id === params.id) && b.status === 'completed'
            );
            setCanReview(hasCompleted);
        } catch {
            setCanReview(false);
        }
    }, [isAuthenticated, user?._id, params.id]);

    useEffect(() => {
        checkReviewEligibility();
    }, [checkReviewEligibility]);

    const handleReviewSubmit = async () => {
        if (!params.id || reviewRating < 1 || reviewRating > 5) return;
        setReviewSubmitting(true);
        setReviewError(null);
        try {
            const review = await venuesApi.submitReview(params.id as string, {
                rating: reviewRating,
                comment: reviewComment || undefined,
            });
            setReviewSuccess(review);
            setCanReview(false); // hide form after success
            showToast('Review submitted successfully!', 'success');
        } catch (err: any) {
            if (err.status === 403) {
                setReviewError('Complete a booking to leave a review');
            } else if (err.status === 409) {
                setReviewError('You have already reviewed this venue');
                setCanReview(false);
            } else {
                setReviewError(err.message || 'Failed to submit review');
            }
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleBooking = () => {
        if (!isAuthenticated) {
            showToast('Please sign in to book a venue', 'warning');
            router.push('/signin');
            return;
        }
        // Show modal with two booking options
        setShowBookingOptionsModal(true);
    };

    const submitBooking = async () => {
        if (!venue || !user) return;

        const finalStartDate = bookingData.date || selectedDate;

        // Validation — collect errors per field and render them INSIDE the
        // modal (8.4), never via a toast behind the overlay. Guest count is
        // validated against the venue capacity window (8.6).
        const errors: Record<string, string> = {};
        if (!finalStartDate) {
            errors.date = 'Please select a start date';
        }
        if (!bookingData.startTime) {
            errors.startTime = 'Please select a start time';
        }
        if (!bookingData.endTime) {
            errors.endTime = 'Please select an end time';
        }
        if (!bookingData.purpose.trim()) {
            errors.purpose = 'Please describe the purpose / event type';
        }
        const { min, max } = venue.capacity;
        if (
            Number.isNaN(bookingData.guests) ||
            bookingData.guests < min ||
            bookingData.guests > max
        ) {
            errors.guests = `Guests must be between ${min} and ${max}`;
        }

        if (Object.keys(errors).length > 0) {
            setBookingErrors(errors);
            return;
        }
        setBookingErrors({});

        try {
            setIsSubmitting(true);
            // Calculate total price
            // Day rate x days covered. Was basePrice + hours x hourlyRate, which
            // billed a multi-day booking as if it were one long day.
            const totalAmount = venueBookingTotal(venue, finalStartDate || '', bookingData.endDate);

            // 1. Create pending booking
            const bookingResult = await bookingsApi.create({
                user: user._id,
                venue: venue._id,
                bookingDate: finalStartDate,
                startTime: bookingData.startTime,
                endTime: bookingData.endTime,
                purpose: bookingData.purpose,
                expectedGuests: bookingData.guests,
                totalAmount,
                status: 'pending',
                bookingType: 'personal'
            });

            // Depending on how backend returns (direct object or nested under "booking")
            const bookingId = (bookingResult as any)._id || ((bookingResult as any).booking && (bookingResult as any).booking._id) || (bookingResult as any).id;

            if (!bookingId) {
                throw new Error("Failed to create booking");
            }

            // 2. Initiate payment for the 10% advance
            const paymentResult = await bookingsApi.initiatePayment(bookingId, user._id!);

            // 3. Load Razorpay and open modal
            const isLoaded = await loadRazorpay();
            if (!isLoaded) {
                showToast('Razorpay SDK failed to load. Are you online?', 'error');
                setIsSubmitting(false);
                return;
            }

            const options = {
                key: paymentResult.keyId,
                amount: paymentResult.amount,
                currency: paymentResult.currency,
                name: "Firaa Venues",
                description: `Advance for ${venue.name}`,
                order_id: paymentResult.gatewayOrderId,
                handler: async function (response: any) {
                    try {
                        const verifyResult = await bookingsApi.verifyPayment(bookingId, {
                            gatewayOrderId: response.razorpay_order_id,
                            gatewayPaymentId: response.razorpay_payment_id,
                            gatewaySignature: response.razorpay_signature
                        }) as { success: boolean };

                        if (verifyResult.success) {
                            showToast('Booking confirmed successfully!', 'success');
                            setIsBookingModalOpen(false);
                            setBookingData(EMPTY_BOOKING);
                            fetchVenue(venue._id); // Refresh availability
                            // Give the success toast time to be read before
                            // navigating - an instant redirect made it look like
                            // nothing had happened.
                            setTimeout(() => router.push('/dashboard/bookings'), SUCCESS_REDIRECT_DELAY_MS);
                        } else {
                            showToast('Payment verification failed', 'error');
                        }
                    } catch (err: any) {
                        console.error(err);
                        showToast(err.message || 'Payment verification failed', 'error');
                    } finally {
                        setIsSubmitting(false);
                    }
                },
                prefill: {
                    name: user.name,
                    email: user.email,
                    contact: user.phone || ''
                },
                theme: {
                    color: "#8b5cf6"
                },
                modal: {
                    ondismiss: function () {
                        setIsSubmitting(false);
                        showToast('Payment cancelled. Booking remains pending.', 'warning');
                    }
                }
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.open();

        } catch (error: any) {
            console.error('Booking error:', error);
            showToast(error.message || 'Failed to submit booking request', 'error');
            setIsSubmitting(false);
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
                        <p className="text-gray-300 mb-6">The venue you&apos;re looking for doesn&apos;t exist.</p>
                        <Button onClick={() => router.push('/venues')}>Browse Venues</Button>
                    </div>
                </main>
            </>
        );
    }

    // Availability calendar — presented INSIDE the booking popup after the user
    // proceeds (8.8), not on the page ahead of booking. Selecting a day feeds
    // `selectedDate`, which the modal's Start Date input reads.
    const availabilityCalendar = (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-white mb-1">Availability Calendar</h3>
            <p className="text-gray-300 text-sm mb-6">Showing availability for the next 2 months. Day-wise booking only.</p>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50"></div>
                    <span className="text-sm text-gray-300">Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500/50"></div>
                    <span className="text-sm text-gray-300">Booked</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-500/30 border border-orange-500/50"></div>
                    <span className="text-sm text-gray-300">Partially Booked</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-500/30 border border-gray-500/50"></div>
                    <span className="text-sm text-gray-300">Closed</span>
                </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    disabled={!canGoPrevMonth}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
                    disabled={!canGoNextMonth}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
                    <div key={day} className="text-center text-xs text-gray-300 font-medium py-2">
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
                            bgClass = 'bg-gray-500/20 border-gray-500/40 text-gray-300 cursor-not-allowed';
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
                                            setBookingData((prev) => ({ ...prev, date: dateStr }));
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
                                                <div className="flex items-center gap-1.5 text-gray-300">
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
    );

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* The only way off this page was the browser's own back gesture.
                        Falls back to the venues list when opened from a shared link. */}
                    <BackButton fallbackHref="/venues" label="Back to Venues" className="mb-4" />

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
                                <div className="flex items-start gap-2 text-gray-300 mb-4">
                                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    <span>{venue.address.street}, {venue.address.city}, {venue.address.state}</span>
                                    {/* Desktop keeps the chip inline - there is room for it
                                        beside the address, and the booking panel is already
                                        visible in the sidebar. On mobile it squeezed the
                                        address into two cramped lines, so it moves into the
                                        action row below instead. */}
                                    {venue.locationLink && (
                                        <a
                                            href={venue.locationLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-3 hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs hover:bg-violet-500/30 flex-shrink-0"
                                        >
                                            Open in Maps
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
                                            </svg>
                                        </a>
                                    )}
                                </div>

                                {/* Mobile action row. The booking panel is a sidebar on
                                    desktop but stacks to the very bottom of the page on
                                    mobile, so "Book Now" was several screens of scrolling
                                    away from the venue you just looked at. This puts it
                                    right under the address, with Maps alongside it. The
                                    bottom button stays for anyone who reads the whole page
                                    first. */}
                                <div className="flex gap-3 mb-4 lg:hidden">
                                    {venue.locationLink && (
                                        <a
                                            href={venue.locationLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm font-medium hover:bg-violet-500/30 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Open in Maps
                                        </a>
                                    )}
                                    <Button className="flex-1" onClick={handleBooking}>
                                        Book Now
                                    </Button>
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
                                            <span className="text-gray-300 text-sm">Venue Owner</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                <h2 className="text-xl font-semibold text-white mb-4">About this venue</h2>
                                <p className="text-gray-300 leading-relaxed">{venue.description}</p>
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
                                            <li key={index} className="flex items-start gap-2 text-gray-300">
                                                <svg className="w-5 h-5 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                {rule}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Cancellation Policy */}
                            {(() => {
                                const policy = venue.cancellationPolicy;
                                const freeCancellationHours = policy?.freeCancellationHours ?? 48;
                                const partialRefundPercentage = policy?.partialRefundPercentage ?? 50;
                                const noCancellationHours = policy?.noCancellationHours ?? 24;
                                return (
                                    <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                        <h2 className="text-xl font-semibold text-white mb-4">Cancellation Policy</h2>
                                        <ul className="space-y-3">
                                            <li className="flex items-start gap-3 text-gray-300">
                                                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>Free cancellation up to {freeCancellationHours} hours before the booking</span>
                                            </li>
                                            <li className="flex items-start gap-3 text-gray-300">
                                                <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                                                </svg>
                                                <span>{partialRefundPercentage}% refund within {noCancellationHours}–{freeCancellationHours} hours before the booking</span>
                                            </li>
                                            <li className="flex items-start gap-3 text-gray-300">
                                                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                <span>No cancellation within {noCancellationHours} hours of the booking</span>
                                            </li>
                                        </ul>
                                    </div>
                                );
                            })()}

                            {/* Venue Review Form — shown only if user has completed booking */}
                            {(canReview || reviewSuccess) && (
                                <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                    <h2 className="text-xl font-semibold text-white mb-4">Leave a Review</h2>
                                    {reviewSuccess ? (
                                        <div className="space-y-3">
                                            <p className="text-green-400 text-sm">Your review has been submitted!</p>
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <svg key={star} className={`w-5 h-5 ${star <= reviewSuccess.rating ? 'text-yellow-400' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                ))}
                                            </div>
                                            {reviewSuccess.comment && (
                                                <p className="text-gray-300 text-sm">{reviewSuccess.comment}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Star Rating */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Rating</label>
                                                <div className="flex items-center gap-1">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onClick={() => setReviewRating(star)}
                                                            className="focus:outline-none"
                                                            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                                        >
                                                            <svg className={`w-8 h-8 transition-colors ${star <= reviewRating ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-300'}`} fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                            </svg>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Comment */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Comment (optional)</label>
                                                <textarea
                                                    value={reviewComment}
                                                    onChange={(e) => setReviewComment(e.target.value.slice(0, 1000))}
                                                    placeholder="Share your experience..."
                                                    rows={3}
                                                    maxLength={1000}
                                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">{reviewComment.length}/1000</p>
                                            </div>

                                            {/* Error */}
                                            {reviewError && (
                                                <p className="text-red-400 text-sm">{reviewError}</p>
                                            )}

                                            {/* Submit */}
                                            <Button
                                                onClick={handleReviewSubmit}
                                                disabled={reviewSubmitting || reviewRating === 0}
                                                className="w-full"
                                            >
                                                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sidebar - Booking Card */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-28 bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                {/* Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-white">{formatPrice(venueDayRate(venue))}</span>
                                        <span className="text-gray-300">per day</span>
                                    </div>
                                </div>

                                {/* Quick Info */}
                                <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">Capacity</span>
                                        {/* Only show a range when the owner set a real
                                            minimum; "1 - 500 guests" is noise. */}
                                        <span className="text-white">
                                            {venue.capacity.min > 1
                                                ? `${venue.capacity.min} - ${venue.capacity.max} guests`
                                                : `Up to ${venue.capacity.max} guests`}
                                        </span>
                                    </div>
                                    {venue.rating.count > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-300">Rating</span>
                                            <div className="flex items-center gap-1">
                                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                <span className="text-white">{venue.rating.average.toFixed(1)}</span>
                                                <span className="text-gray-300">({venue.rating.count} reviews)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Button className="w-full" size="lg" onClick={handleBooking}>
                                    Book Now
                                </Button>

                                {/* Ask a Question button */}
                                <button
                                    onClick={() => setIsInquiryModalOpen(true)}
                                    className="w-full mt-3 text-sm text-violet-400 hover:text-violet-300 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.065 2.386-1.772 3.772-1.772 1.928 0 3.5 1.21 3.5 2.772 0 1.561-1.572 2.772-3.5 2.772-.969 0-1.839-.258-2.438-.698M12 17h.01" />
                                    </svg>
                                    Ask a Question
                                </button>

                                <p className="text-xs text-gray-300 text-center mt-4">
                                    A 10% advance payment is required to secure your booking
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Booking Options Modal */}
            <Modal
                isOpen={showBookingOptionsModal}
                onClose={() => setShowBookingOptionsModal(false)}
                title="How would you like to book?"
                size="md"
            >
                <div className="space-y-4">
                    {/* Create Event Option */}
                    <button
                        onClick={() => {
                            setShowBookingOptionsModal(false);
                            router.push(`/create/event?venue=${venue?._id}`);
                        }}
                        className="w-full p-4 text-left border border-violet-500/30 rounded-lg hover:bg-violet-500/10 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white mb-1">Create an Event</h3>
                                <p className="text-sm text-gray-300">Plan a full event with invitations, setup details, and more</p>
                            </div>
                        </div>
                    </button>

                    {/* Personal Booking Option */}
                    <button
                        onClick={() => {
                            setShowBookingOptionsModal(false);
                            setBookingErrors({});
                            setIsBookingModalOpen(true);
                        }}
                        className="w-full p-4 text-left border border-pink-500/30 rounded-lg hover:bg-pink-500/10 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white mb-1">Book Venue Personally</h3>
                                <p className="text-sm text-gray-300">Reserve the venue for personal use without creating an event</p>
                            </div>
                        </div>
                    </button>
                </div>
            </Modal>

            {/* Booking Modal */}
            <Modal
                isOpen={isBookingModalOpen}
                onClose={() => { setIsBookingModalOpen(false); setBookingErrors({}); }}
                title="Request Booking"
                size="lg"
            >
                <div className="space-y-4">
                    {/* Availability calendar, shown in-popup after proceeding (8.8) */}
                    {availabilityCalendar}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Start Date</label>
                            <input
                                type="date"
                                value={bookingData.date || selectedDate || ''}
                                onChange={(e) => {
                                    setBookingData({ ...bookingData, date: e.target.value });
                                    setSelectedDate(e.target.value);
                                }}
                                min={new Date().toISOString().split('T')[0]}
                                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark] ${bookingErrors.date ? 'border-red-500' : 'border-white/10'}`}
                            />
                            {bookingErrors.date && <p role="alert" className="mt-2 text-sm text-red-400">{bookingErrors.date}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">End Date</label>
                            <input
                                type="date"
                                value={bookingData.endDate}
                                onChange={(e) => setBookingData({ ...bookingData, endDate: e.target.value })}
                                min={bookingData.date || new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Start Time</label>
                            <input
                                type="time"
                                value={bookingData.startTime}
                                onChange={(e) => setBookingData({ ...bookingData, startTime: e.target.value })}
                                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark] ${bookingErrors.startTime ? 'border-red-500' : 'border-white/10'}`}
                            />
                            {bookingErrors.startTime && <p role="alert" className="mt-2 text-sm text-red-400">{bookingErrors.startTime}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">End Time</label>
                            <input
                                type="time"
                                value={bookingData.endTime}
                                onChange={(e) => setBookingData({ ...bookingData, endTime: e.target.value })}
                                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark] ${bookingErrors.endTime ? 'border-red-500' : 'border-white/10'}`}
                            />
                            {bookingErrors.endTime && <p role="alert" className="mt-2 text-sm text-red-400">{bookingErrors.endTime}</p>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Expected Guests</label>
                        <input
                            type="number"
                            min={venue?.capacity.min}
                            max={venue?.capacity.max}
                            value={Number.isNaN(bookingData.guests) ? '' : bookingData.guests}
                            onChange={(e) => setBookingData({ ...bookingData, guests: parseInt(e.target.value) })}
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${bookingErrors.guests ? 'border-red-500' : 'border-white/10'}`}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            {(venue?.capacity.min ?? 1) > 1
                                ? `This venue accepts ${venue?.capacity.min}–${venue?.capacity.max} guests.`
                                : `This venue holds up to ${venue?.capacity.max} guests.`}
                        </p>
                        {bookingErrors.guests && <p role="alert" className="mt-2 text-sm text-red-400">{bookingErrors.guests}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Purpose / Event Type</label>
                        <textarea
                            value={bookingData.purpose}
                            onChange={(e) => setBookingData({ ...bookingData, purpose: e.target.value })}
                            placeholder="Describe your event..."
                            rows={3}
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${bookingErrors.purpose ? 'border-red-500' : 'border-white/10'}`}
                        />
                        {bookingErrors.purpose && <p role="alert" className="mt-2 text-sm text-red-400">{bookingErrors.purpose}</p>}
                    </div>

                    {/* Price Calculation and 10% Advance Notice */}
                    {bookingData.startTime && bookingData.endTime && venue && (
                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 mt-2">
                            <h4 className="text-violet-300 font-medium mb-3">Booking Cost Summary</h4>
                            {(() => {
                                const startDate = bookingData.date || selectedDate || '';
                                const dayRate = venueDayRate(venue);
                                const days = billableDays(startDate, bookingData.endDate);
                                const totalAmount = dayRate * days;
                                // Itemised the same way the server bills it. This used to
                                // show a bare `totalAmount * 0.10` and stop there, while
                                // the server put that advance through calculateBilling and
                                // added a platform fee plus GST - so a ₹166 booking said
                                // ₹17 here and Razorpay asked for ₹18. The gateway was the
                                // first place the guest saw the real figure.
                                const bill = bookingAdvance(
                                    totalAmount,
                                    (venue as { platformFeePercentage?: number }).platformFeePercentage
                                );

                                return (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between gap-3 text-gray-300">
                                            <span>Day rate</span>
                                            <span className="whitespace-nowrap">{formatPrice(dayRate)}</span>
                                        </div>
                                        <div className="flex justify-between gap-3 text-gray-300">
                                            <span>{days} {days === 1 ? 'day' : 'days'}</span>
                                            <span className="whitespace-nowrap">&times; {days}</span>
                                        </div>
                                        <div className="flex justify-between gap-3 text-white font-medium pt-2 border-t border-white/10">
                                            <span>Total Price</span>
                                            <span className="whitespace-nowrap">{formatPrice(totalAmount)}</span>
                                        </div>

                                        <div className="flex justify-between gap-3 text-gray-300 pt-2 border-t border-white/10">
                                            <span>10% advance</span>
                                            <span className="whitespace-nowrap">{formatPrice(bill.advance)}</span>
                                        </div>
                                        <div className="flex justify-between gap-3 text-gray-300">
                                            <span>Platform fee ({bill.platformFeePercentage}%)</span>
                                            <span className="whitespace-nowrap">{formatPrice(bill.platformFee)}</span>
                                        </div>
                                        <div className="flex justify-between gap-3 text-gray-300">
                                            <span>GST (18% on platform fee)</span>
                                            <span className="whitespace-nowrap">{formatPrice(bill.gstAmount)}</span>
                                        </div>
                                        <div className="flex justify-between gap-3 text-violet-400 font-bold pt-2 border-t border-white/10">
                                            <span>Payable now</span>
                                            <span className="whitespace-nowrap">{formatPrice(bill.payableNow)}</span>
                                        </div>
                                        <p className="text-xs text-gray-300 mt-2 block">
                                            * Only the non-refundable advance and its fees are charged today to secure this booking.
                                            The remaining {formatPrice(bill.remaining)} is settled with the venue owner directly.
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Stacked on a phone, side by side from `sm` up.
                        Buttons are whitespace-nowrap, so "Proceed to Payment (10%)" at
                        flex-1 could not shrink to its half of a narrow row and spilled
                        past the modal edge - visible on Android, where the default font
                        renders wider than iOS. Full-width rows cannot overflow. */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button
                            variant="secondary"
                            className="w-full sm:flex-1 justify-center"
                            onClick={() => { setIsBookingModalOpen(false); setBookingErrors({}); }}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="w-full sm:flex-1 justify-center"
                            onClick={submitBooking}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Inquiry Modal */}
            <Modal
                isOpen={isInquiryModalOpen}
                onClose={() => setIsInquiryModalOpen(false)}
                title="Ask a Question"
                size="md"
            >
                {venue && (
                    <InquiryForm
                        referenceType="venue"
                        referenceId={venue._id}
                        referenceName={venue.name}
                        onClose={() => setIsInquiryModalOpen(false)}
                    />
                )}
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
