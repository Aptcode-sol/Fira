'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button, Input } from '@/components/ui';
import { venuesApi, bookingsApi, uploadApi } from '@/lib/api';
import { FadeIn, SlideUp } from '@/components/animations';
import { motion } from 'framer-motion';

interface Venue {
    _id: string;
    name: string;
    description?: string;
    address: {
        street?: string;
        city: string;
        state: string;
        pincode?: string;
    };
    capacity: { min: number; max: number };
    pricing?: { basePrice: number; pricePerHour?: number };
    status: string;
    isActive?: boolean;
    rating?: { average: number; count: number };
    images?: string[];
    availability?: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[];
    totalBookings?: number;
    pendingBookings?: number;
    monthlyEarnings?: number;
    locationLink?: string;
}

interface Booking {
    _id: string;
    status: string;
    totalAmount: number;
    createdAt: string;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COMMON_AMENITIES = ['Parking', 'WiFi', 'AC', 'Sound System', 'Projector', 'Stage', 'Green Room', 'Catering', 'Security', 'Restrooms', 'Wheelchair Access', 'Lighting'];

export default function VenuesPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Edit Modal State
    const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
    const [editTab, setEditTab] = useState<'basic' | 'address' | 'capacity' | 'amenities' | 'photos'>('basic');
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        basePrice: 0,
        pricePerHour: 0,
        street: '',
        city: '',
        state: '',
        pincode: '',
        capacityMin: 1,
        capacityMax: 100,
        amenities: [] as string[],
        images: [] as string[],
    });
    const [isSaving, setIsSaving] = useState(false);
    const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [deletingImage, setDeletingImage] = useState<string | null>(null);
    const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);

    // Availability Modal State
    const [availabilityVenue, setAvailabilityVenue] = useState<Venue | null>(null);
    const [availability, setAvailability] = useState<{ dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[]>([]);
    const [blockedDates, setBlockedDates] = useState<{ date: string; startTime: string; endTime: string; reason: string }[]>([]);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [busyHoursForm, setBusyHoursForm] = useState({ startTime: '09:00', endTime: '18:00', reason: '' });

    // Cancel Venue State
    const [cancellingVenue, setCancellingVenue] = useState<Venue | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    const fetchVenues = async () => {
        if (!user?._id) return;
        try {
            setLoading(true);
            const response = await venuesApi.getUserVenues(user._id) as { venues: Venue[] };
            const venueData = response?.venues || [];

            // Fetch bookings for each venue to get stats
            const venuesWithStats = await Promise.all(
                venueData.map(async (venue) => {
                    try {
                        const bookings = await bookingsApi.getVenueBookings(venue._id) as Booking[];
                        const pendingBookings = bookings.filter(b => b.status === 'pending').length;
                        const thisMonth = new Date();
                        thisMonth.setDate(1);
                        const monthlyEarnings = bookings
                            .filter(b => b.status === 'completed' && new Date(b.createdAt) >= thisMonth)
                            .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

                        return {
                            ...venue,
                            totalBookings: bookings.length,
                            pendingBookings,
                            monthlyEarnings,
                        };
                    } catch {
                        return venue;
                    }
                })
            );

            setVenues(venuesWithStats);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load venues');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && user?._id) {
            fetchVenues();
        }
    }, [isAuthenticated, user?._id]);

    // Open edit modal
    const openEditModal = (venue: Venue) => {
        setEditingVenue(venue);
        setEditTab('basic');
        setNewImageFiles([]);
        setImagePreviews([]);
        setEditForm({
            name: venue.name || '',
            description: venue.description || '',
            basePrice: venue.pricing?.basePrice || 0,
            pricePerHour: venue.pricing?.pricePerHour || 0,
            street: venue.address?.street || '',
            city: venue.address?.city || '',
            state: venue.address?.state || '',
            pincode: venue.address?.pincode || '',
            capacityMin: venue.capacity?.min || 1,
            capacityMax: venue.capacity?.max || 100,
            amenities: (venue as any).amenities || [],
            images: venue.images || [],
        });
    };

    // Save venue edits
    const handleSaveEdit = async () => {
        if (!editingVenue) return;
        setIsSaving(true);
        try {
            // Upload new images if any
            let allImages = [...editForm.images];
            if (newImageFiles.length > 0) {
                const uploadResult = await uploadApi.multiple(newImageFiles, 'venues');
                const newUrls = uploadResult.images.map(img => img.url);
                allImages = [...allImages, ...newUrls];
            }

            await venuesApi.update(editingVenue._id, {
                name: editForm.name,
                description: editForm.description,
                pricing: {
                    basePrice: editForm.basePrice,
                    pricePerHour: editForm.pricePerHour,
                },
                address: {
                    street: editForm.street,
                    city: editForm.city,
                    state: editForm.state,
                    pincode: editForm.pincode,
                },
                capacity: {
                    min: editForm.capacityMin,
                    max: editForm.capacityMax,
                },
                amenities: editForm.amenities,
                images: allImages,
            });
            setEditingVenue(null);
            setNewImageFiles([]);
            setImagePreviews([]);
            fetchVenues();
        } catch (err) {
            setError('Failed to update venue');
        } finally {
            setIsSaving(false);
        }
    };

    // Toggle amenity
    const toggleAmenity = (amenity: string) => {
        setEditForm(prev => ({
            ...prev,
            amenities: prev.amenities.includes(amenity)
                ? prev.amenities.filter(a => a !== amenity)
                : [...prev.amenities, amenity]
        }));
    };

    // Handle adding new images
    const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setNewImageFiles(prev => [...prev, ...files]);
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setImagePreviews(prev => [...prev, ...newPreviews]);
        }
    };

    // Handle removing existing image
    const handleRemoveExistingImage = async (imageUrl: string) => {
        // Extract public ID from Cloudinary URL
        const urlParts = imageUrl.split('/');
        const filenameWithExt = urlParts[urlParts.length - 1];
        const filename = filenameWithExt.split('.')[0];
        const folder = urlParts[urlParts.length - 2];
        const publicId = `${folder}/${filename}`;

        setDeletingImage(imageUrl);
        try {
            await uploadApi.delete(publicId);
            setEditForm(prev => ({
                ...prev,
                images: prev.images.filter(img => img !== imageUrl)
            }));
        } catch (err) {
            setError('Failed to delete image');
        } finally {
            setDeletingImage(null);
        }
    };

    // Handle removing new image (not yet uploaded)
    const handleRemoveNewImage = (index: number) => {
        setNewImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    // Drag and drop for reordering images
    const handleDragStart = (index: number) => {
        setDraggedImageIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedImageIndex === null || draggedImageIndex === index) return;

        const newImages = [...editForm.images];
        const draggedItem = newImages[draggedImageIndex];
        newImages.splice(draggedImageIndex, 1);
        newImages.splice(index, 0, draggedItem);

        setEditForm(prev => ({ ...prev, images: newImages }));
        setDraggedImageIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedImageIndex(null);
    };

    // Toggle venue active status
    const toggleVenueStatus = async (venue: Venue) => {
        try {
            await venuesApi.update(venue._id, { isActive: !venue.isActive });
            fetchVenues();
        } catch (err) {
            setError('Failed to update venue status');
        }
    };

    // Open availability modal
    const openAvailabilityModal = (venue: Venue) => {
        setAvailabilityVenue(venue);
        // Initialize with existing availability or defaults
        if (venue.availability && venue.availability.length > 0) {
            setAvailability(venue.availability);
        } else {
            setAvailability(
                DAYS_OF_WEEK.map((_, i) => ({
                    dayOfWeek: i,
                    startTime: '09:00',
                    endTime: '22:00',
                    isAvailable: true,
                }))
            );
        }
    };

    // Save availability
    const handleSaveAvailability = async () => {
        if (!availabilityVenue) return;
        setIsSaving(true);
        try {
            await venuesApi.updateAvailability(availabilityVenue._id, availability);
            setAvailabilityVenue(null);
            fetchVenues();
        } catch (err) {
            setError('Failed to update availability');
        } finally {
            setIsSaving(false);
        }
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
        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push(new Date(year, month, d));
        }
        return days;
    };

    const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

    const isDateBlocked = (date: Date) => {
        const key = formatDateKey(date);
        return blockedDates.some(b => b.date === key);
    };

    const getBlockedHours = (date: Date) => {
        const key = formatDateKey(date);
        return blockedDates.filter(b => b.date === key);
    };

    const handleAddBusyHours = () => {
        if (!selectedDate) return;
        const dateKey = formatDateKey(selectedDate);
        setBlockedDates(prev => [...prev, {
            date: dateKey,
            startTime: busyHoursForm.startTime,
            endTime: busyHoursForm.endTime,
            reason: busyHoursForm.reason || 'Busy'
        }]);
        setBusyHoursForm({ startTime: '09:00', endTime: '18:00', reason: '' });
    };

    const handleRemoveBusyHours = (date: string, startTime: string) => {
        setBlockedDates(prev => prev.filter(b => !(b.date === date && b.startTime === startTime)));
    };

    const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
    const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

    const handleCancelVenue = async () => {
        if (!cancellingVenue) return;
        setIsCancelling(true);
        try {
            await venuesApi.cancel(cancellingVenue._id, cancelReason || 'Cancelled by owner');
            // Refresh venues list
            await fetchVenues();
            setCancellingVenue(null);
            setCancelReason('');
        } catch (error) {
            console.error('Failed to cancel venue:', error);
        } finally {
            setIsCancelling(false);
        }
    };

    if (isLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    const totalPendingRequests = venues.reduce((sum, v) => sum + (v.pendingBookings || 0), 0);
    const totalMonthlyEarnings = venues.reduce((sum, v) => sum + (v.monthlyEarnings || 0), 0);

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">My Venues</h1>
                            <p className="text-gray-400">Manage your venues and booking requests</p>
                        </div>
                        <Link href="/create/venue">
                            <Button>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Venue
                            </Button>
                        </Link>
                    </div>
                </SlideUp>

                {/* Summary Cards */}
                <FadeIn delay={0.1}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5">
                            <div className="text-sm text-gray-400 mb-1">Total Venues</div>
                            <div className="text-2xl font-bold text-white">{venues.length}</div>
                        </div>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5">
                            <div className="text-sm text-gray-400 mb-1">Active Venues</div>
                            <div className="text-2xl font-bold text-green-400">{venues.filter((v) => v.isActive !== false).length}</div>
                        </div>
                        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5">
                            <div className="text-sm text-gray-400 mb-1">Pending Requests</div>
                            <div className="text-2xl font-bold text-yellow-400">{totalPendingRequests}</div>
                        </div>
                        <div className="bg-gradient-to-r from-violet-500/20 to-pink-500/20 backdrop-blur-sm border border-violet-500/20 rounded-2xl p-5">
                            <div className="text-sm text-violet-300 mb-1">This Month&apos;s Earnings</div>
                            <div className="text-2xl font-bold text-white">₹{totalMonthlyEarnings.toLocaleString()}</div>
                        </div>
                    </div>
                </FadeIn>

                {/* Loading State - Skeleton Cards */}
                {loading && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[0, 1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                                className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden"
                            >
                                <div className="flex flex-col md:flex-row">
                                    <div className="md:w-48 h-40 md:h-48 bg-white/[0.05] animate-pulse" />
                                    <div className="flex-1 p-5 space-y-4">
                                        <div className="h-5 w-3/4 bg-white/[0.05] rounded animate-pulse" />
                                        <div className="h-4 w-1/2 bg-white/[0.05] rounded animate-pulse" />
                                        <div className="grid grid-cols-3 gap-4 pt-2">
                                            <div className="h-8 bg-white/[0.05] rounded animate-pulse" />
                                            <div className="h-8 bg-white/[0.05] rounded animate-pulse" />
                                            <div className="h-8 bg-white/[0.05] rounded animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="text-center py-16">
                        <p className="text-red-400 mb-4">{error}</p>
                        <Button onClick={() => { setError(''); fetchVenues(); }}>Try Again</Button>
                    </div>
                )}

                {/* Venues Grid */}
                {!loading && !error && (
                    <FadeIn>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {venues.map((venue, index) => (
                                <motion.div
                                    key={venue._id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                                >
                                    <Link
                                        href={`/dashboard/venues/${venue._id}`}
                                        className="group block bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 cursor-pointer"
                                    >
                                        <div className="flex flex-col md:flex-row">
                                            {/* Venue Image */}
                                            <div className="md:w-48 h-40 md:h-48 bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                                                {venue.images?.[0] ? (
                                                    <img src={venue.images[0]} alt={venue.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <svg className="w-12 h-12 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                )}
                                                <div className="absolute top-3 left-3 flex gap-2">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border ${venue.status === 'approved'
                                                        ? 'bg-green-500/20 text-green-400 border-green-500/20'
                                                        : venue.status === 'pending'
                                                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                                                            : 'bg-gray-500/20 text-gray-400 border-gray-500/20'
                                                        }`}>
                                                        {venue.status}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Venue Details */}
                                            <div className="flex-1 p-5">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h3 className="text-lg font-semibold text-white group-hover:text-violet-300 transition-colors">
                                                            {venue.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            {venue.address?.city}, {venue.address?.state}
                                                        </div>
                                                    </div>
                                                    {venue.rating?.average && (
                                                        <div className="flex items-center gap-1 text-yellow-400">
                                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                            </svg>
                                                            <span className="text-sm font-medium">{venue.rating.average.toFixed(1)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Stats */}
                                                <div className="grid grid-cols-3 gap-4 mb-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Capacity</p>
                                                        <p className="text-sm font-medium text-white">{venue.capacity?.max || venue.capacity?.min || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Bookings</p>
                                                        <p className="text-sm font-medium text-white">{venue.totalBookings || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">This Month</p>
                                                        <p className="text-sm font-medium text-emerald-400">₹{((venue.monthlyEarnings || 0) / 1000).toFixed(0)}K</p>
                                                    </div>
                                                </div>

                                                {/* Pending Requests Alert */}
                                                {(venue.pendingBookings || 0) > 0 && (
                                                    <div className="mb-4 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span className="text-sm text-yellow-400">{venue.pendingBookings} pending request{(venue.pendingBookings || 0) > 1 ? 's' : ''}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </FadeIn>
                )}

                {/* Empty State */}
                {!loading && !error && venues.length === 0 && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                        </svg>
                        <h3 className="text-xl font-semibold text-white mb-2">No venues yet</h3>
                        <p className="text-gray-400 mb-6">Start listing your venues to receive bookings!</p>
                        <Link href="/create/venue">
                            <Button>Add Your First Venue</Button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {
                editingVenue && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Edit Venue</h2>
                                <button onClick={() => setEditingVenue(null)} className="text-gray-400 hover:text-white">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-2 border-b border-white/10 pb-3 mb-4">
                                {(['basic', 'address', 'capacity', 'amenities', 'photos'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setEditTab(tab)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${editTab === tab
                                            ? 'bg-violet-500/20 text-violet-400'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        {tab === 'basic' ? 'Basic Info' : tab}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4">
                                {/* Basic Info Tab */}
                                {editTab === 'basic' && (
                                    <>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Venue Name</label>
                                            <Input
                                                value={editForm.name}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="bg-black/40"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Description</label>
                                            <textarea
                                                value={editForm.description}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                rows={4}
                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">Base Price (₹)</label>
                                                <Input
                                                    type="number"
                                                    value={editForm.basePrice}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, basePrice: Number(e.target.value) }))}
                                                    className="bg-black/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">Price per Hour (₹)</label>
                                                <Input
                                                    type="number"
                                                    value={editForm.pricePerHour}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, pricePerHour: Number(e.target.value) }))}
                                                    className="bg-black/40"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Address Tab */}
                                {editTab === 'address' && (
                                    <>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Street Address</label>
                                            <Input
                                                value={editForm.street}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, street: e.target.value }))}
                                                className="bg-black/40"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">City</label>
                                                <Input
                                                    value={editForm.city}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                                                    className="bg-black/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-1">State</label>
                                                <Input
                                                    value={editForm.state}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                                                    className="bg-black/40"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Pincode</label>
                                            <Input
                                                value={editForm.pincode}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, pincode: e.target.value }))}
                                                className="bg-black/40"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Capacity Tab */}
                                {editTab === 'capacity' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Minimum Capacity</label>
                                            <Input
                                                type="number"
                                                value={editForm.capacityMin}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, capacityMin: Number(e.target.value) }))}
                                                className="bg-black/40"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Maximum Capacity</label>
                                            <Input
                                                type="number"
                                                value={editForm.capacityMax}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, capacityMax: Number(e.target.value) }))}
                                                className="bg-black/40"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Amenities Tab */}
                                {editTab === 'amenities' && (
                                    <div>
                                        <p className="text-sm text-gray-400 mb-3">Select the amenities available at your venue:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {COMMON_AMENITIES.map((amenity) => (
                                                <button
                                                    key={amenity}
                                                    type="button"
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
                                        {editForm.amenities.length > 0 && (
                                            <p className="text-xs text-gray-500 mt-3">
                                                Selected: {editForm.amenities.join(', ')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Photos Tab */}
                                {editTab === 'photos' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-400">Manage your venue photos. Click the X to remove.</p>

                                        {/* Existing Images */}
                                        {editForm.images.length > 0 && (
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-2">Current Photos (drag to reorder)</label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {editForm.images.map((img, idx) => (
                                                        <div
                                                            key={img}
                                                            draggable
                                                            onDragStart={() => handleDragStart(idx)}
                                                            onDragOver={(e) => handleDragOver(e, idx)}
                                                            onDragEnd={handleDragEnd}
                                                            className={`relative aspect-video rounded-lg overflow-hidden bg-gray-800 cursor-move transition-all ${draggedImageIndex === idx ? 'opacity-50 scale-95 ring-2 ring-violet-500' : ''
                                                                }`}
                                                        >
                                                            <img src={img} alt={`Venue ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
                                                            <div className="absolute top-2 left-2 w-5 h-5 bg-black/60 rounded text-white text-xs flex items-center justify-center font-medium">
                                                                {idx + 1}
                                                            </div>
                                                            <button
                                                                onClick={() => handleRemoveExistingImage(img)}
                                                                disabled={deletingImage === img}
                                                                className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white transition-colors"
                                                            >
                                                                {deletingImage === img ? (
                                                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                                                ) : (
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* New Images Preview */}
                                        {imagePreviews.length > 0 && (
                                            <div>
                                                <label className="block text-sm text-gray-400 mb-2">New Photos (not yet saved)</label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {imagePreviews.map((preview, idx) => (
                                                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-gray-800 border-2 border-dashed border-violet-500/50">
                                                            <img src={preview} alt={`New ${idx + 1}`} className="w-full h-full object-cover" />
                                                            <button
                                                                onClick={() => handleRemoveNewImage(idx)}
                                                                className="absolute top-2 right-2 w-6 h-6 bg-gray-800/80 hover:bg-gray-800 rounded-full flex items-center justify-center text-white transition-colors"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Add Photos Button */}
                                        <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-violet-500/50 transition-colors">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            <span className="text-gray-400">Add Photos</span>
                                            <input type="file" accept="image/*" multiple onChange={handleImageAdd} className="hidden" />
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button variant="ghost" onClick={() => setEditingVenue(null)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveEdit} disabled={isSaving} className="flex-1">
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Availability Modal */}
            {
                availabilityVenue && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Venue Availability</h2>
                                <button onClick={() => setAvailabilityVenue(null)} className="text-gray-400 hover:text-white">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <p className="text-gray-400 text-sm mb-4">Set your venue&apos;s operating hours for each day of the week.</p>

                            <div className="space-y-3">
                                {DAYS_OF_WEEK.map((day, index) => {
                                    const dayAvail = availability.find(a => a.dayOfWeek === index) || {
                                        dayOfWeek: index,
                                        startTime: '09:00',
                                        endTime: '22:00',
                                        isAvailable: true,
                                    };
                                    return (
                                        <div key={day} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAvailability(prev =>
                                                        prev.map(a =>
                                                            a.dayOfWeek === index
                                                                ? { ...a, isAvailable: !a.isAvailable }
                                                                : a
                                                        )
                                                    );
                                                }}
                                                className={`w-5 h-5 rounded border flex-shrink-0 ${dayAvail.isAvailable
                                                    ? 'bg-green-500 border-green-500'
                                                    : 'border-gray-500'
                                                    }`}
                                            >
                                                {dayAvail.isAvailable && (
                                                    <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                            <span className="w-24 text-white font-medium">{day}</span>
                                            <input
                                                type="time"
                                                value={dayAvail.startTime}
                                                onChange={(e) => {
                                                    setAvailability(prev =>
                                                        prev.map(a =>
                                                            a.dayOfWeek === index
                                                                ? { ...a, startTime: e.target.value }
                                                                : a
                                                        )
                                                    );
                                                }}
                                                disabled={!dayAvail.isAvailable}
                                                className="px-2 py-1 bg-black/40 border border-white/10 rounded text-white text-sm disabled:opacity-50"
                                            />
                                            <span className="text-gray-500">to</span>
                                            <input
                                                type="time"
                                                value={dayAvail.endTime}
                                                onChange={(e) => {
                                                    setAvailability(prev =>
                                                        prev.map(a =>
                                                            a.dayOfWeek === index
                                                                ? { ...a, endTime: e.target.value }
                                                                : a
                                                        )
                                                    );
                                                }}
                                                disabled={!dayAvail.isAvailable}
                                                className="px-2 py-1 bg-black/40 border border-white/10 rounded text-white text-sm disabled:opacity-50"
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Calendar for Blocked Dates */}
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <h3 className="text-lg font-semibold text-white mb-3">Busy Hours Calendar</h3>
                                <p className="text-gray-400 text-sm mb-4">Click on a date to set busy/unavailable hours for specific days.</p>

                                {/* Month Navigation */}
                                <div className="flex items-center justify-between mb-3">
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

                                {/* Week Days Header */}
                                <div className="grid grid-cols-7 gap-1 mb-1">
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                        <div key={i} className="text-center text-xs text-gray-500 py-1">{d}</div>
                                    ))}
                                </div>

                                {/* Calendar Grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {getCalendarDays().map((date, i) => {
                                        if (!date) return <div key={i} className="aspect-square" />;
                                        const isToday = date.toDateString() === new Date().toDateString();
                                        const isBlocked = isDateBlocked(date);
                                        const isSelected = selectedDate?.toDateString() === date.toDateString();
                                        const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => !isPast && setSelectedDate(date)}
                                                disabled={isPast}
                                                className={`aspect-square rounded-lg text-sm font-medium transition-colors ${isPast ? 'text-gray-600 cursor-not-allowed' :
                                                    isSelected ? 'bg-violet-500 text-white' :
                                                        isBlocked ? 'bg-red-500/30 text-red-400 border border-red-500/50' :
                                                            isToday ? 'bg-white/10 text-white' :
                                                                'text-gray-300 hover:bg-white/10'
                                                    }`}
                                            >
                                                {date.getDate()}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Selected Date Busy Hours */}
                                {selectedDate && (
                                    <div className="mt-4 p-4 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                                        <h4 className="text-white font-medium mb-3">
                                            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                        </h4>

                                        {/* Existing busy hours for this date */}
                                        {getBlockedHours(selectedDate).length > 0 && (
                                            <div className="space-y-2 mb-3">
                                                {getBlockedHours(selectedDate).map((block, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2 bg-red-500/20 rounded">
                                                        <span className="text-sm text-red-300">
                                                            {block.startTime} - {block.endTime} ({block.reason})
                                                        </span>
                                                        <button
                                                            onClick={() => handleRemoveBusyHours(block.date, block.startTime)}
                                                            className="text-red-400 hover:text-red-300"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add busy hours form */}
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={busyHoursForm.startTime}
                                                    onChange={(e) => setBusyHoursForm(prev => ({ ...prev, startTime: e.target.value }))}
                                                    className="flex-1 px-2 py-1.5 bg-black/40 border border-white/10 rounded text-white text-sm"
                                                />
                                                <span className="text-gray-500">to</span>
                                                <input
                                                    type="time"
                                                    value={busyHoursForm.endTime}
                                                    onChange={(e) => setBusyHoursForm(prev => ({ ...prev, endTime: e.target.value }))}
                                                    className="flex-1 px-2 py-1.5 bg-black/40 border border-white/10 rounded text-white text-sm"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Reason (optional)"
                                                value={busyHoursForm.reason}
                                                onChange={(e) => setBusyHoursForm(prev => ({ ...prev, reason: e.target.value }))}
                                                className="px-3 py-1.5 bg-black/40 border border-white/10 rounded text-white text-sm placeholder:text-gray-500"
                                            />
                                            <Button size="sm" onClick={handleAddBusyHours}>
                                                Add Busy Hours
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button variant="ghost" onClick={() => setAvailabilityVenue(null)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveAvailability} disabled={isSaving} className="flex-1">
                                    {isSaving ? 'Saving...' : 'Save Availability'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Cancel Venue Modal */}
            {cancellingVenue && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Delete Venue</h2>
                            <button onClick={() => setCancellingVenue(null)} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div>
                                        <p className="text-red-400 font-medium">Delete {cancellingVenue.name}?</p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            This will set the venue status to inactive and it will no longer accept new bookings.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Reason for cancellation (optional)
                                </label>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="Let us know why you're cancelling..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500 resize-none"
                                    rows={3}
                                />
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => { setCancellingVenue(null); setCancelReason(''); }}
                                    disabled={isCancelling}
                                >
                                    Keep Venue
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1 !bg-red-500 hover:!bg-red-600"
                                    onClick={handleCancelVenue}
                                    disabled={isCancelling}
                                >
                                    {isCancelling ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Cancelling...
                                        </span>
                                    ) : (
                                        'Cancel Venue'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout >
    );
}
