'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button, Input } from '@/components/ui';
import { venuesApi, uploadApi, bookingsApi, eventsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

interface Venue {
    _id: string;
    name: string;
    description: string;
    images: string[];
    address: { street: string; city: string; state: string; pincode: string };
    capacity: { min: number; max: number };
    pricing: { basePrice: number; pricePerHour?: number };
    amenities: string[];
    rules: string[];
    availability: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[];
    blockedDates: { date: string; slots: { startTime: string; endTime: string; type: 'busy' | 'booked' }[] }[];
    status: string;
    isActive: boolean;
    rating: { average: number; count: number };
    locationLink?: string;
}

interface Booking {
    _id: string;
    user: { _id: string; name: string; email: string; phone?: string };
    bookingDate: string;
    startTime: string;
    endTime: string;
    purpose: string;
    expectedGuests: number;
    totalAmount: number;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
    createdAt: string;
}

interface EventRequest {
    _id: string;
    name: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    organizer: { _id: string; name: string; email: string };
    venue: { _id: string; name: string };
    category: string;
    eventType: 'public' | 'private';
    maxAttendees: number;
    venueApproval: { status: string };
    createdAt: string;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COMMON_AMENITIES = ['Parking', 'WiFi', 'AC', 'Sound System', 'Projector', 'Stage', 'Green Room', 'Catering', 'Security', 'Restrooms'];

export default function VenueManagePage() {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const { showToast } = useToast();

    const [venue, setVenue] = useState<Venue | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Edit form state
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        street: '',
        city: '',
        state: '',
        pincode: '',
        locationLink: '',
        basePrice: 0,
        pricePerHour: 0,
        capacityMin: 1,
        capacityMax: 100,
        amenities: [] as string[],
        rules: [] as string[],
        images: [] as string[],
        autoApproveBookings: false,
    });

    // Image management
    const [selectedImage, setSelectedImage] = useState(0);
    const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
    const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [deletingImage, setDeletingImage] = useState<string | null>(null);

    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [hoursForm, setHoursForm] = useState({ startTime: '09:00', endTime: '22:00', isAvailable: true });
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);

    // Booking state
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);

    // Event requests state (for venue owner approval)
    const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
    const [processingEventId, setProcessingEventId] = useState<string | null>(null);

    // Venue status management
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isTogglingAutoApprove, setIsTogglingAutoApprove] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (params.id && isAuthenticated) {
            fetchVenue(params.id as string);
            fetchBookings(params.id as string);
        }
    }, [params.id, isAuthenticated]);

    // Fetch event requests when user is available
    useEffect(() => {
        if (user?._id && isAuthenticated) {
            fetchEventRequests(user._id);
        }
    }, [user?._id, isAuthenticated]);

    const fetchVenue = async (id: string) => {
        try {
            setIsLoading(true);
            const data = await venuesApi.getById(id);
            setVenue(data as Venue);
            initEditForm(data as Venue);
        } catch {
            setError('Failed to load venue');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchBookings = async (venueId: string) => {
        try {
            const data = await bookingsApi.getVenueBookings(venueId) as Booking[];
            setBookings(data || []);
        } catch {
            console.error('Failed to fetch bookings');
        }
    };

    const fetchEventRequests = async (userId: string) => {
        try {
            const result = await eventsApi.getVenueRequests(userId) as { events: EventRequest[] };
            setEventRequests(result.events || []);
        } catch {
            console.error('Failed to fetch event requests');
        }
    };

    const handleEventApproval = async (eventId: string, status: 'approved' | 'rejected') => {
        if (!user?._id) return;
        setProcessingEventId(eventId);
        try {
            await eventsApi.venueApprove(eventId, {
                venueOwnerId: user._id,
                status
            });
            showToast(`Event ${status}!`, 'success');
            fetchEventRequests(user._id);
        } catch {
            showToast('Failed to update event status', 'error');
        } finally {
            setProcessingEventId(null);
        }
    };

    const handleBookingStatus = async (bookingId: string, status: 'accepted' | 'rejected') => {
        setProcessingBookingId(bookingId);
        try {
            await bookingsApi.updateStatus(bookingId, status);
            showToast(`Booking ${status}!`, 'success');
            if (params.id) {
                fetchBookings(params.id as string);
                // Also refresh venue to update calendar with booked slots
                if (status === 'accepted') {
                    fetchVenue(params.id as string);
                }
            }
        } catch {
            showToast('Failed to update booking', 'error');
        } finally {
            setProcessingBookingId(null);
        }
    };

    const toggleVenueStatus = async () => {
        if (!venue) return;
        setIsTogglingStatus(true);
        try {
            await venuesApi.update(venue._id, { isActive: !venue.isActive });
            showToast(`Venue ${venue.isActive ? 'deactivated' : 'activated'}!`, 'success');
            fetchVenue(venue._id);
        } catch {
            showToast('Failed to update venue status', 'error');
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const handleCancelVenue = async () => {
        if (!venue) return;
        setIsCancelling(true);
        try {
            await venuesApi.cancel(venue._id);
            showToast('Venue deleted successfully', 'success');
            setShowCancelModal(false);
            router.push('/dashboard/venues');
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to delete venue', 'error');
        } finally {
            setIsCancelling(false);
        }
    };

    const toggleAutoApproveBookings = async () => {
        if (!venue) return;
        setIsTogglingAutoApprove(true);
        try {
            const newValue = !(venue as any).autoApproveBookings;
            await venuesApi.update(venue._id, { autoApproveBookings: newValue });
            showToast(`Auto-approve ${newValue ? 'enabled' : 'disabled'}!`, 'success');
            fetchVenue(venue._id);
        } catch (err) {
            showToast('Failed to update auto-approve setting', 'error');
        } finally {
            setIsTogglingAutoApprove(false);
        }
    };

    const initEditForm = (v: Venue) => {
        setEditForm({
            name: v.name || '',
            description: v.description || '',
            street: v.address?.street || '',
            city: v.address?.city || '',
            state: v.address?.state || '',
            pincode: v.address?.pincode || '',
            locationLink: (v as any).locationLink || '',
            basePrice: v.pricing?.basePrice || 0,
            pricePerHour: v.pricing?.pricePerHour || 0,
            capacityMin: v.capacity?.min || 1,
            capacityMax: v.capacity?.max || 100,
            amenities: v.amenities || [],
            rules: v.rules || [],
            images: v.images || [],
            autoApproveBookings: (v as any).autoApproveBookings || false,
        });
        setSelectedImage(0);
    };

    const handleSave = async () => {
        if (!venue) return;
        setIsSaving(true);
        try {
            let allImages = [...editForm.images];
            if (newImageFiles.length > 0) {
                const uploadResult = await uploadApi.multiple(newImageFiles, 'venues');
                allImages = [...allImages, ...uploadResult.images.map(img => img.url)];
            }

            await venuesApi.update(venue._id, {
                name: editForm.name,
                description: editForm.description,
                address: { street: editForm.street, city: editForm.city, state: editForm.state, pincode: editForm.pincode },
                locationLink: editForm.locationLink,
                pricing: { basePrice: editForm.basePrice, pricePerHour: editForm.pricePerHour },
                capacity: { min: editForm.capacityMin, max: editForm.capacityMax },
                amenities: editForm.amenities,
                rules: editForm.rules,
                images: allImages,
                autoApproveBookings: editForm.autoApproveBookings,
            });

            setNewImageFiles([]);
            setImagePreviews([]);
            setIsEditMode(false);
            fetchVenue(venue._id);
        } catch (err) {
            setError('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveImage = async (imageUrl: string) => {
        const urlParts = imageUrl.split('/');
        const filenameWithExt = urlParts[urlParts.length - 1];
        const filename = filenameWithExt.split('.')[0];
        const folder = urlParts[urlParts.length - 2];
        const publicId = `${folder}/${filename}`;

        setDeletingImage(imageUrl);
        try {
            await uploadApi.delete(publicId);
            setEditForm(prev => ({ ...prev, images: prev.images.filter(img => img !== imageUrl) }));
            if (selectedImage >= editForm.images.length - 1) setSelectedImage(Math.max(0, editForm.images.length - 2));
        } catch (err) {
            setError('Failed to delete image');
        } finally {
            setDeletingImage(null);
        }
    };

    const handleDragStart = (idx: number) => setDraggedImageIndex(idx);
    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (draggedImageIndex === null || draggedImageIndex === idx) return;
        const newImages = [...editForm.images];
        const dragged = newImages[draggedImageIndex];
        newImages.splice(draggedImageIndex, 1);
        newImages.splice(idx, 0, dragged);
        setEditForm(prev => ({ ...prev, images: newImages }));
        setDraggedImageIndex(idx);
    };
    const handleDragEnd = () => setDraggedImageIndex(null);

    const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setNewImageFiles(prev => [...prev, ...files]);
            setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
        }
    };

    const toggleAmenity = (amenity: string) => {
        setEditForm(prev => ({
            ...prev,
            amenities: prev.amenities.includes(amenity)
                ? prev.amenities.filter(a => a !== amenity)
                : [...prev.amenities, amenity]
        }));
    };

    // Calendar helpers
    const getCalendarDays = () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();
        const days: (Date | null)[] = [];
        for (let i = 0; i < startPadding; i++) days.push(null);
        for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
        return days;
    };

    const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

    const toggleDateSelection = (date: Date) => {
        const key = formatDateKey(date);
        setSelectedDates(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
    };

    const applyHoursToSelected = async () => {
        if (!venue || selectedDates.length === 0) return;
        setIsSaving(true);
        try {
            // Build updated blockedDates
            const updatedBlockedDates = [...(venue.blockedDates || [])];

            selectedDates.forEach(date => {
                const existing = updatedBlockedDates.find(b => b.date === date);
                const newSlot = { startTime: hoursForm.startTime, endTime: hoursForm.endTime, type: 'busy' as const };

                if (hoursForm.isAvailable) {
                    // If marking as available, remove this time slot if it exists
                    if (existing) {
                        existing.slots = existing.slots.filter(s =>
                            !(s.startTime === hoursForm.startTime && s.endTime === hoursForm.endTime)
                        );
                        // Remove date entry if no slots left
                        if (existing.slots.length === 0) {
                            const idx = updatedBlockedDates.indexOf(existing);
                            updatedBlockedDates.splice(idx, 1);
                        }
                    }
                } else {
                    // If marking as busy, add slot
                    if (existing) {
                        // Check if slot already exists
                        const slotExists = existing.slots.some(s =>
                            s.startTime === hoursForm.startTime && s.endTime === hoursForm.endTime
                        );
                        if (!slotExists) {
                            existing.slots.push(newSlot);
                        }
                    } else {
                        updatedBlockedDates.push({ date, slots: [newSlot] });
                    }
                }
            });

            await venuesApi.update(venue._id, { blockedDates: updatedBlockedDates });

            setSelectedDates([]);
            fetchVenue(venue._id);
        } catch (err) {
            setError('Failed to update availability');
        } finally {
            setIsSaving(false);
        }
    };

    const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
    const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

    const formatPrice = (price: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

    // Format DateTime like "3 Jan 2026 14:00"
    const formatDateTime = (dateTimeStr: string) => {
        if (!dateTimeStr) return 'N/A';
        const dt = new Date(dateTimeStr);
        if (isNaN(dt.getTime())) return 'Invalid Date';
        const day = dt.getDate();
        const month = dt.toLocaleString('en-US', { month: 'short' });
        const year = dt.getFullYear();
        const hours = dt.getHours().toString().padStart(2, '0');
        const mins = dt.getMinutes().toString().padStart(2, '0');
        return `${day} ${month} ${year} ${hours}:${mins}`;
    };

    // Get availability info for a specific date - returns all slots
    const getDateAvailability = (date: Date) => {
        const key = formatDateKey(date);
        const dayOfWeek = date.getDay();
        const blockedEntry = venue?.blockedDates?.find(b => b.date === key);
        const weeklySlot = venue?.availability?.find(a => a.dayOfWeek === dayOfWeek);

        // Default venue hours
        const defaultStart = weeklySlot?.startTime || '09:00';
        const defaultEnd = weeklySlot?.endTime || '22:00';

        const slots: { startTime: string; endTime: string; type: 'busy' | 'booked' | 'available' }[] = [];

        if (blockedEntry?.slots && blockedEntry.slots.length > 0) {
            // Add blocked/booked slots
            blockedEntry.slots.forEach(s => {
                slots.push({ startTime: s.startTime, endTime: s.endTime, type: s.type });
            });
        }

        // Determine overall color: green (all available), red (all blocked), orange (mixed)
        let color = 'green';
        if (slots.length > 0) {
            const hasBooked = slots.some(s => s.type === 'booked');
            const fullDayBlocked = slots.some(s => s.startTime === defaultStart && s.endTime === defaultEnd);
            if (fullDayBlocked) {
                color = 'red';
            } else if (hasBooked || slots.length > 0) {
                color = 'orange';
            }
        }

        if (!weeklySlot?.isAvailable && weeklySlot) {
            color = 'gray';
        }

        return {
            slots,
            defaultStart,
            defaultEnd,
            color,
            isClosed: weeklySlot && !weeklySlot.isAvailable
        };
    };

    if (authLoading || isLoading) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    if (!venue) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white mb-2">Venue not found</h1>
                        <Button onClick={() => router.push('/dashboard/venues')}>Back to Venues</Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    const displayImages = isEditMode ? editForm.images : venue.images;

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto py-8 px-4">
                {/* Header with Edit Toggle */}
                <div className="flex items-center justify-between mb-6">
                    <button onClick={() => router.push('/dashboard/venues')} className="flex items-center gap-2 text-gray-400 hover:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Venues
                    </button>
                    <div className="flex items-center gap-3">
                        {/* Status badges */}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${venue.status === 'approved'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/20'
                            : venue.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/20'
                            }`}>
                            {venue.status}
                        </span>

                        {/* Active/Inactive Toggle */}
                        <button
                            onClick={toggleVenueStatus}
                            disabled={isTogglingStatus}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${venue.isActive !== false
                                ? 'bg-green-500/20 text-green-400 border border-green-500/20 hover:bg-green-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30'
                                }`}
                        >
                            {isTogglingStatus ? '...' : venue.isActive !== false ? 'Active' : 'Inactive'}
                        </button>

                        {/* Cancel Button */}
                        {venue.status !== 'cancelled' && (
                            <button
                                onClick={() => setShowCancelModal(true)}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30 transition-colors"
                            >
                                Delete Venue
                            </button>
                        )}

                        {/* Auto-Approve Bookings Toggle */}
                        <button
                            onClick={toggleAutoApproveBookings}
                            disabled={isTogglingAutoApprove}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${(venue as any).autoApproveBookings
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20 hover:bg-blue-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/20 hover:bg-gray-500/30'
                                }`}
                            title={`Auto-approve booking requests: ${(venue as any).autoApproveBookings ? 'Enabled' : 'Disabled'}`}
                        >
                            {isTogglingAutoApprove ? '...' : (venue as any).autoApproveBookings ? '✓ Auto-Approve ON' : 'Auto-Approve OFF'}
                        </button>

                        {isEditMode ? (
                            <>
                                <Button variant="ghost" onClick={() => { setIsEditMode(false); initEditForm(venue); }}>Cancel Edit</Button>
                                <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
                            </>
                        ) : (
                            <Button onClick={() => setIsEditMode(true)}>Edit Venue</Button>
                        )}
                    </div>
                </div>

                {/* Cancel Confirmation Modal */}
                {showCancelModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-2">Cancel Venue?</h3>
                            <p className="text-gray-400 mb-6">
                                Are you sure you want to cancel <strong className="text-white">{venue.name}</strong>? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button variant="ghost" onClick={() => setShowCancelModal(false)} disabled={isCancelling}>
                                    Keep Venue
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleCancelVenue}
                                    disabled={isCancelling}
                                    className="bg-red-500 hover:bg-red-600"
                                >
                                    {isCancelling ? 'Deleting...' : 'Yes, Delete Venue'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {error && <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400">{error}</div>}

                {/* Image Gallery */}
                <div className="mb-8">
                    <div className="relative h-[400px] rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-violet-500/20 to-pink-500/20">
                        {displayImages && displayImages.length > 0 ? (
                            <img src={displayImages[selectedImage] || displayImages[0]} alt={venue.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Thumbnails */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {displayImages?.map((image, idx) => (
                            <div
                                key={idx}
                                draggable={isEditMode}
                                onDragStart={() => isEditMode && handleDragStart(idx)}
                                onDragOver={(e) => isEditMode && handleDragOver(e, idx)}
                                onDragEnd={handleDragEnd}
                                className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedImage === idx ? 'border-violet-500' : 'border-transparent opacity-60 hover:opacity-100'
                                    } ${isEditMode ? 'cursor-move' : ''} ${draggedImageIndex === idx ? 'opacity-50 scale-95' : ''}`}
                                onClick={() => setSelectedImage(idx)}
                            >
                                <img src={image} alt="" className="w-full h-full object-cover" />
                                {isEditMode && (
                                    <>
                                        <div className="absolute top-1 left-1 w-5 h-5 bg-black/70 rounded text-white text-xs flex items-center justify-center">{idx + 1}</div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveImage(image); }}
                                            disabled={deletingImage === image}
                                            className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white"
                                        >
                                            {deletingImage === image ? <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" /> : '×'}
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                        {/* New image previews */}
                        {isEditMode && imagePreviews.map((preview, idx) => (
                            <div key={`new-${idx}`} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-dashed border-violet-500/50">
                                <img src={preview} alt="" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => { setNewImageFiles(prev => prev.filter((_, i) => i !== idx)); setImagePreviews(prev => prev.filter((_, i) => i !== idx)); }}
                                    className="absolute top-1 right-1 w-5 h-5 bg-gray-800/80 rounded-full text-white text-xs"
                                >×</button>
                            </div>
                        ))}
                        {isEditMode && (
                            <label className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-violet-500/50">
                                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <input type="file" accept="image/*" multiple onChange={handleImageAdd} className="hidden" />
                            </label>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Location */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h2 className="text-xl font-semibold text-white mb-2">Location</h2>
                            {isEditMode ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Input
                                        placeholder="Street"
                                        value={editForm.street}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, street: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="City"
                                        value={editForm.city}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="State"
                                        value={editForm.state}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="Pincode"
                                        value={editForm.pincode}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, pincode: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="Location link (Google Maps URL)"
                                        value={editForm.locationLink}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, locationLink: e.target.value }))}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-gray-300">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    <span>{venue.address.street}, {venue.address.city}, {venue.address.state}</span>
                                    {venue.locationLink && (
                                        <a
                                            href={venue.locationLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-3 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs hover:bg-violet-500/30"
                                        >
                                            Open in Maps
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
                                            </svg>
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Description */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h2 className="text-xl font-semibold text-white mb-4">About this venue</h2>
                            {isEditMode ? (
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    rows={5}
                                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white"
                                />
                            ) : (
                                <p className="text-gray-400 leading-relaxed whitespace-pre-line">{venue.description}</p>
                            )}
                        </div>

                        {/* Availability Calendar */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 overflow-visible">
                            <h2 className="text-xl font-semibold text-white mb-2">Availability Calendar</h2>
                            <p className="text-gray-400 text-sm mb-4">
                                {isEditMode ? 'Click dates to select, then set hours for all selected dates.' : 'View your venue availability.'}
                            </p>

                            {/* Month Navigation */}
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <span className="text-white font-medium">
                                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </span>
                                <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>

                            {/* Week Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-1">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                    <div key={i} className="text-center text-xs text-gray-500 py-1">{d}</div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1 relative">
                                {getCalendarDays().map((date, i) => {
                                    if (!date) return <div key={i} className="aspect-square" />;
                                    const key = formatDateKey(date);
                                    const isSelected = selectedDates.includes(key);
                                    const isToday = date.toDateString() === new Date().toDateString();
                                    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                                    const blockedEntry = venue.blockedDates?.find(b => b.date === key);
                                    const availability = getDateAvailability(date);
                                    const isHovered = hoveredDate === key;

                                    return (
                                        <div key={i} className="relative">
                                            <button
                                                onClick={() => isEditMode && !isPast && toggleDateSelection(date)}
                                                onMouseEnter={() => setHoveredDate(key)}
                                                onMouseLeave={() => setHoveredDate(null)}
                                                className={`w-full aspect-square rounded-lg text-sm font-medium transition-all ${isPast ? 'text-gray-600 cursor-not-allowed' :
                                                    isSelected ? 'bg-violet-500 text-white ring-2 ring-violet-400 cursor-pointer' :
                                                        availability.color === 'red' ? 'bg-red-500/30 text-red-400 border border-red-500/50 cursor-pointer' :
                                                            availability.color === 'orange' ? 'bg-orange-500/30 text-orange-400 border border-orange-500/50 cursor-pointer' :
                                                                availability.color === 'gray' ? 'bg-gray-500/30 text-gray-400 border border-gray-500/50 cursor-pointer' :
                                                                    isToday ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-pointer' :
                                                                        isEditMode ? 'text-gray-300 hover:bg-white/10 cursor-pointer' :
                                                                            'text-gray-300 hover:bg-white/5 cursor-default'
                                                    }`}
                                            >
                                                {date.getDate()}
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
                                })}
                            </div>

                            {/* Selected Dates Hours Form */}
                            {isEditMode && selectedDates.length > 0 && (
                                <div className="mt-4 p-4 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                                    <p className="text-sm text-violet-300 mb-3">{selectedDates.length} date(s) selected</p>
                                    <div className="flex items-center gap-2 mb-3">
                                        <input
                                            type="time"
                                            value={hoursForm.startTime}
                                            onChange={(e) => setHoursForm(prev => ({ ...prev, startTime: e.target.value }))}
                                            className="flex-1 px-2 py-1.5 bg-black/40 border border-white/10 rounded text-white text-sm"
                                        />
                                        <span className="text-gray-500">to</span>
                                        <input
                                            type="time"
                                            value={hoursForm.endTime}
                                            onChange={(e) => setHoursForm(prev => ({ ...prev, endTime: e.target.value }))}
                                            className="flex-1 px-2 py-1.5 bg-black/40 border border-white/10 rounded text-white text-sm"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 mb-3">
                                        <input
                                            type="checkbox"
                                            checked={hoursForm.isAvailable}
                                            onChange={(e) => setHoursForm(prev => ({ ...prev, isAvailable: e.target.checked }))}
                                            className="w-4 h-4 rounded"
                                        />
                                        <span className="text-sm text-gray-300">Available for booking</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => setSelectedDates([])}>Clear Selection</Button>
                                        <Button size="sm" onClick={applyHoursToSelected} disabled={isSaving}>
                                            {isSaving ? 'Applying...' : 'Apply to Selected'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Event Requests Card */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Event Requests ({eventRequests.length})
                            </h3>

                            {eventRequests.length === 0 ? (
                                <div className="text-center py-6 text-gray-400">
                                    <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-sm">No pending requests</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[350px] overflow-y-auto">
                                    {eventRequests.map((event) => (
                                        <div key={event._id} className="p-4 rounded-xl bg-black/30 border border-white/5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-0.5 rounded text-xs ${event.eventType === 'private'
                                                    ? 'bg-violet-500/20 text-violet-400'
                                                    : 'bg-green-500/20 text-green-400'
                                                    }`}>
                                                    {event.eventType}
                                                </span>
                                            </div>
                                            <p className="text-white font-medium">{event.name}</p>
                                            <p className="text-gray-400 text-sm mt-1">
                                                by {event.organizer?.name || 'Unknown'}
                                            </p>
                                            <div className="mt-2 text-gray-500 text-xs space-y-1">
                                                <p className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    From: {formatDateTime(event.startDateTime)}
                                                </p>
                                                <p className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    To: {formatDateTime(event.endDateTime)}
                                                </p>
                                                <p className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                    {event.maxAttendees} max attendees
                                                </p>
                                            </div>
                                            {event.venueApproval?.status === 'pending' && (
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => handleEventApproval(event._id, 'rejected')}
                                                        disabled={processingEventId === event._id}
                                                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleEventApproval(event._id, 'approved')}
                                                        disabled={processingEventId === event._id}
                                                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                                    >
                                                        {processingEventId === event._id ? '...' : 'Approve'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Venue Stats */}

                    <div className="lg:col-span-1">
                        {/* Name & Location */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 mb-6">
                            {isEditMode ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Venue Name</label>
                                        <Input value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} className="text-xl font-bold" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Street</label>
                                            <Input value={editForm.street} onChange={(e) => setEditForm(prev => ({ ...prev, street: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">City</label>
                                            <Input value={editForm.city} onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">State</label>
                                            <Input value={editForm.state} onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Pincode</label>
                                            <Input value={editForm.pincode} onChange={(e) => setEditForm(prev => ({ ...prev, pincode: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-3xl font-bold text-white mb-3">{venue.name}</h1>
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                        <span>{venue.address.street}, {venue.address.city}, {venue.address.state}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="space-y-6">
                            {/* Stats Card */}
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                {/* Price */}
                                <div className="mb-6">
                                    {isEditMode ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">Base Price (₹)</label>
                                                <Input type="number" value={editForm.basePrice} onChange={(e) => setEditForm(prev => ({ ...prev, basePrice: Number(e.target.value) }))} />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">Price per Hour (₹)</label>
                                                <Input type="number" value={editForm.pricePerHour} onChange={(e) => setEditForm(prev => ({ ...prev, pricePerHour: Number(e.target.value) }))} />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-bold text-white">{formatPrice(venue.pricing.basePrice)}</span>
                                                <span className="text-gray-400">base</span>
                                            </div>
                                            {venue.pricing.pricePerHour && (
                                                <p className="text-sm text-gray-500 mt-1">+ {formatPrice(venue.pricing.pricePerHour)} / hour</p>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Capacity */}
                                <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                                    {isEditMode ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">Min Capacity</label>
                                                <Input type="number" value={editForm.capacityMin} onChange={(e) => setEditForm(prev => ({ ...prev, capacityMin: Number(e.target.value) }))} />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">Max Capacity</label>
                                                <Input type="number" value={editForm.capacityMax} onChange={(e) => setEditForm(prev => ({ ...prev, capacityMax: Number(e.target.value) }))} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-400">Capacity</span>
                                            <span className="text-white">{venue.capacity.min} - {venue.capacity.max} guests</span>
                                        </div>
                                    )}

                                    {venue.rating.count > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-400">Rating</span>
                                            <div className="flex items-center gap-1">
                                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                <span className="text-white">{venue.rating.average.toFixed(1)}</span>
                                                <span className="text-gray-500">({venue.rating.count})</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Status */}
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400 text-sm">Status</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${venue.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {venue.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Amenities */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 mt-6">
                            <h2 className="text-xl font-semibold text-white mb-4">Amenities</h2>
                            {isEditMode ? (
                                <div className="flex flex-wrap gap-2">
                                    {COMMON_AMENITIES.map((amenity) => (
                                        <button
                                            key={amenity}
                                            onClick={() => toggleAmenity(amenity)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editForm.amenities.includes(amenity)
                                                ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                                                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            {amenity}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {venue.amenities?.map((amenity, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-gray-300">
                                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {amenity}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
