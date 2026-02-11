'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { eventsApi, venuesApi, uploadApi } from '@/lib/api';

const categories = ['party', 'concert', 'wedding', 'corporate', 'birthday', 'festival', 'other'];

// Inner component that uses useSearchParams
function CreateEventForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedVenueId = searchParams.get('venue');
    const { isAuthenticated, isLoading, user } = useAuth();
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: 'party',
        date: '',
        endDate: '',
        startTime: '',
        endTime: '',
        venueId: '',
        venueName: '',
        eventType: 'public' as 'public' | 'private',
        ticketType: 'free' as 'free' | 'paid',
        ticketPrice: 0,
        maxAttendees: 100,
        termsAndConditions: '',
        images: [] as string[],
        friendsAndFamilyStay: false,
        allowAlcohol: false,
        useCustomVenue: false,
        customVenue: {
            name: '',
            description: '',
            address: '',
            city: '',
            state: '',
            pincode: '',
            capacity: 0,
            images: [] as string[],
            locationLink: ''
        }
    });
    const [venues, setVenues] = useState<{ _id: string; name: string }[]>([]);
    const [loadingVenues, setLoadingVenues] = useState(true);
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string>('');

    useEffect(() => {
        // Only redirect if auth check is complete AND user is not authenticated
        if (!isLoading && !isAuthenticated) {
            router.replace('/signin?redirect=/create/event');
        }
    }, [isLoading, isAuthenticated, router]);

    // Fetch venues on mount
    useEffect(() => {
        const fetchVenues = async () => {
            try {
                const response = await venuesApi.getAll() as { venues?: { _id: string; name: string }[] } | { _id: string; name: string }[];
                const venueList = Array.isArray(response) ? response : (response?.venues || []);
                setVenues(venueList);

                // Pre-select venue if provided in URL
                if (preselectedVenueId && venueList.some(v => v._id === preselectedVenueId)) {
                    setFormData(prev => ({ ...prev, venueId: preselectedVenueId }));
                }
            } catch (err) {
                console.error('Failed to fetch venues:', err);
            } finally {
                setLoadingVenues(false);
            }
        };
        fetchVenues();
    }, [preselectedVenueId]);

    const handleSubmit = async () => {
        if (!user?._id) {
            showToast('Please sign in to create an event', 'error');
            return;
        }
        if (!formData.useCustomVenue && !formData.venueId) {
            showToast('Please select a venue or create a custom venue', 'error');
            return;
        }
        if (!formData.name) {
            showToast('Please enter an event name', 'error');
            setStep(1);
            return;
        }
        if (!formData.description) {
            showToast('Please enter an event description', 'error');
            setStep(1);
            return;
        }
        if (!formData.date) {
            showToast('Please select a start date', 'error');
            setStep(2);
            return;
        }
        if (!formData.startTime) {
            showToast('Please select a start time', 'error');
            setStep(2);
            return;
        }
        if (!formData.endTime) {
            showToast('Please select an end time', 'error');
            setStep(2);
            return;
        }

        // Validate date is not in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDate = new Date(formData.date);
        if (eventDate < today) {
            showToast('Event date cannot be in the past', 'error');
            return;
        }

        // Validate end date is after start date
        if (formData.endDate && new Date(formData.endDate) < new Date(formData.date)) {
            showToast('End date must be after start date', 'error');
            return;
        }

        // Validate custom venue if being used
        if (formData.useCustomVenue && (!formData.customVenue.name || !formData.customVenue.address || !formData.customVenue.city || !formData.customVenue.capacity || !formData.customVenue.locationLink)) {
            showToast('Please fill in all custom venue details', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            // Upload image if selected
            let imageUrls: string[] = [];
            if (coverImageFile) {
                showToast('Uploading image...', 'info');
                const uploadResult = await uploadApi.single(coverImageFile, 'events');
                imageUrls = [uploadResult.url];
            }

            // Combine date and time into DateTime strings
            const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
            const endDateStr = formData.endDate || formData.date;
            const endDateTime = new Date(`${endDateStr}T${formData.endTime}:00`);

            const eventData: any = {
                organizer: user._id,
                venue: formData.useCustomVenue ? null : formData.venueId,
                name: formData.name,
                description: formData.description,
                category: formData.category,
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString(),
                eventType: formData.eventType,
                ticketType: formData.ticketType,
                ticketPrice: formData.ticketType === 'paid' ? formData.ticketPrice : 0,
                maxAttendees: formData.maxAttendees,
                termsAndConditions: formData.termsAndConditions || null,
                images: imageUrls,
                friendsAndFamilyStay: formData.friendsAndFamilyStay,
                allowAlcohol: formData.allowAlcohol,
                status: 'pending', // Events need venue and admin approval first
            };

            if (formData.useCustomVenue) {
                eventData.customVenue = {
                    isCustom: true,
                    ...formData.customVenue
                };
            }

            await eventsApi.create(eventData);
            showToast('Event submitted for approval! The venue owner and admin will review it.', 'success');
            router.push('/dashboard/events');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create event';
            showToast(errorMessage, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Show loading while auth is being checked
    if (isLoading) {
        return (
            <>
                <PartyBackground />
                <Navbar />
                <main className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </main>
            </>
        );
    }

    // Redirect happens in useEffect, just don't render the form while not authenticated
    if (!isAuthenticated) {
        return (
            <>
                <PartyBackground />
                <Navbar />
                <main className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-gray-400 mb-4">Redirecting to sign in...</p>
                        <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full mx-auto" />
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
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Create Event</h1>
                        <p className="text-gray-400">Fill in the details to create your event</p>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${step >= s ? 'bg-violet-500 text-white' : 'bg-white/10 text-gray-500'
                                    }`}>
                                    {s}
                                </div>
                                {s < 4 && (
                                    <div className={`w-12 h-0.5 mx-2 ${step > s ? 'bg-violet-500' : 'bg-white/10'}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Form Card */}
                    <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8">
                        {/* Step 1: Basic Info */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>

                                <Input
                                    label="Event Name"
                                    placeholder="e.g., Neon Nights Festival"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                                    <textarea
                                        placeholder="Describe your event..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, category: cat })}
                                                className={`px-4 py-2 rounded-full text-sm capitalize transition-all ${formData.category === cat
                                                    ? 'bg-violet-500 text-white'
                                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={() => setStep(2)}>Next</Button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Date, Time & Venue */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Date, Time & Venue</h2>

                                {/* Date Warning */}
                                {formData.date && new Date(formData.date) < new Date(new Date().toDateString()) && (
                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span>Warning: You've selected a date in the past!</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Start Date *</label>
                                        <input
                                            type="date"
                                            value={formData.date}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">End Date</label>
                                        <input
                                            type="date"
                                            value={formData.endDate}
                                            min={formData.date || new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Leave empty for single-day events</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Start Time</label>
                                        <input
                                            type="time"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">End Time</label>
                                        <input
                                            type="time"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Venue *</label>
                                    <div className="relative mb-4">
                                        <select
                                            value={formData.venueId}
                                            onChange={(e) => setFormData({ ...formData, venueId: e.target.value, useCustomVenue: false })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 appearance-none cursor-pointer"
                                            disabled={loadingVenues || formData.useCustomVenue}
                                        >
                                            <option value="" className="bg-[#1a1a1a]">
                                                {loadingVenues ? 'Loading venues...' : 'Select a venue'}
                                            </option>
                                            {venues.map((venue) => (
                                                <option key={venue._id} value={venue._id} className="bg-[#1a1a1a]">
                                                    {venue.name}
                                                </option>
                                            ))}
                                        </select>
                                        <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="flex-1 h-px bg-white/10"></div>
                                        <span className="text-xs text-gray-500">OR</span>
                                        <div className="flex-1 h-px bg-white/10"></div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, useCustomVenue: !formData.useCustomVenue, venueId: '' })}
                                        className={`w-full p-4 rounded-xl border text-left transition-all ${formData.useCustomVenue
                                            ? 'bg-blue-500/10 border-blue-500/50 text-white'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="font-medium mb-1">+ Create Custom Venue</div>
                                        <div className="text-xs text-gray-500">Create a venue specific to this event only</div>
                                    </button>
                                    <p className="mt-1.5 text-xs text-gray-500">Choose from available venues or create a custom one for this event</p>
                                </div>

                                {formData.useCustomVenue && (
                                    <div className="space-y-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                                        <h3 className="text-sm font-semibold text-white">Custom Venue Details</h3>

                                        <Input
                                            label="Venue Name"
                                            placeholder="e.g., My Backyard"
                                            value={formData.customVenue.name}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                customVenue: { ...formData.customVenue, name: e.target.value }
                                            })}
                                            required
                                        />

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                                            <textarea
                                                placeholder="Describe your venue..."
                                                value={formData.customVenue.description}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    customVenue: { ...formData.customVenue, description: e.target.value }
                                                })}
                                                rows={3}
                                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                            />
                                        </div>

                                        <Input
                                            label="Address"
                                            placeholder="Street address"
                                            value={formData.customVenue.address}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                customVenue: { ...formData.customVenue, address: e.target.value }
                                            })}
                                            required
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="City"
                                                placeholder="City"
                                                value={formData.customVenue.city}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    customVenue: { ...formData.customVenue, city: e.target.value }
                                                })}
                                                required
                                            />
                                            <Input
                                                label="State"
                                                placeholder="State"
                                                value={formData.customVenue.state}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    customVenue: { ...formData.customVenue, state: e.target.value }
                                                })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="Pincode"
                                                placeholder="Pincode"
                                                value={formData.customVenue.pincode}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    customVenue: { ...formData.customVenue, pincode: e.target.value }
                                                })}
                                            />
                                            <Input
                                                label="Capacity"
                                                type="number"
                                                placeholder="Max capacity"
                                                value={formData.customVenue.capacity}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    customVenue: { ...formData.customVenue, capacity: parseInt(e.target.value) }
                                                })}
                                                required
                                            />
                                        </div>

                                        <Input
                                            label="Location Link (Maps URL)"
                                            placeholder="https://maps.google.com/..."
                                            value={formData.customVenue.locationLink}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                customVenue: { ...formData.customVenue, locationLink: e.target.value }
                                            })}
                                            required
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Maximum Attendees</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={formData.maxAttendees}
                                        onChange={(e) => setFormData({ ...formData, maxAttendees: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                    />
                                </div>

                                <div className="flex justify-between">
                                    <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                                    <Button onClick={() => setStep(3)}>Next</Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Tickets & Privacy */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Tickets & Privacy</h2>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">Event Type</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, eventType: 'public' })}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${formData.eventType === 'public'
                                                ? 'bg-violet-500/20 border-violet-500 text-white shadow-lg shadow-violet-500/20'
                                                : 'bg-white/5 border-white/10 text-gray-500 opacity-60 hover:opacity-80'
                                                }`}
                                        >
                                            <div className="font-medium mb-1">Public</div>
                                            <div className="text-xs opacity-70">Anyone can discover & join</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, eventType: 'private' })}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${formData.eventType === 'private'
                                                ? 'bg-violet-500/20 border-violet-500 text-white shadow-lg shadow-violet-500/20'
                                                : 'bg-white/5 border-white/10 text-gray-500 opacity-60 hover:opacity-80'
                                                }`}
                                        >
                                            <div className="font-medium mb-1">Private</div>
                                            <div className="text-xs opacity-70">Invite only with access code</div>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">Ticket Type</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, ticketType: 'free', ticketPrice: 0 })}
                                            className={`p-4 rounded-xl border text-left transition-all ${formData.ticketType === 'free'
                                                ? 'bg-green-500/10 border-green-500/50 text-white'
                                                : 'bg-white/5 border-white/10 text-gray-400'
                                                }`}
                                        >
                                            <div className="font-medium mb-1">Free</div>
                                            <div className="text-xs text-gray-500">No ticket required</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, ticketType: 'paid' })}
                                            className={`p-4 rounded-xl border text-left transition-all ${formData.ticketType === 'paid'
                                                ? 'bg-green-500/10 border-green-500/50 text-white'
                                                : 'bg-white/5 border-white/10 text-gray-400'
                                                }`}
                                        >
                                            <div className="font-medium mb-1">Paid</div>
                                            <div className="text-xs text-gray-500">Set your ticket price</div>
                                        </button>
                                    </div>
                                </div>

                                {formData.ticketType === 'paid' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Ticket Price (₹)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={formData.ticketPrice}
                                            onChange={(e) => setFormData({ ...formData, ticketPrice: parseInt(e.target.value) })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        />
                                    </div>
                                )}

                                {/* Event Cover Image */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Event Cover Image (Optional)</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                // 2MB size limit
                                                const MAX_SIZE = 2 * 1024 * 1024;
                                                if (file.size > MAX_SIZE) {
                                                    showToast('Image exceeds 2MB limit', 'error');
                                                    return;
                                                }
                                                setCoverImageFile(file);
                                                setCoverImagePreview(URL.createObjectURL(file));
                                            }}
                                            className="hidden"
                                            id="cover-image-upload"
                                        />
                                        <label
                                            htmlFor="cover-image-upload"
                                            className="flex items-center justify-center gap-2 w-full px-4 py-4 rounded-xl bg-white/5 border border-dashed border-white/20 text-gray-400 hover:bg-white/10 hover:border-violet-500/50 cursor-pointer transition-all"
                                        >
                                            {coverImagePreview ? (
                                                <span className="text-green-400 text-sm">✓ Image selected (will upload on submit)</span>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-sm">Click to select cover image</span>
                                                </>
                                            )}
                                        </label>
                                        {coverImagePreview && (
                                            <img src={coverImagePreview} alt="Preview" className="mt-2 w-full rounded-xl object-cover" />
                                        )}
                                    </div>
                                    <p className="mt-1.5 text-xs text-gray-500">Max size per image: 2MB</p>
                                </div>

                                {/* Terms and Conditions */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Terms & Conditions (Optional)</label>
                                    <textarea
                                        placeholder="Enter any rules, guidelines, or terms for attendees..."
                                        value={formData.termsAndConditions}
                                        onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                                    />
                                    <p className="mt-1.5 text-xs text-gray-500">Age restrictions, dress code, rules, etc.</p>
                                </div>

                                <div className="flex justify-between pt-4">
                                    <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                                    <Button onClick={() => setStep(4)}>Next</Button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Additional Options */}
                        {step === 4 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Additional Event Options</h2>

                                {/* Friends and Family Stay */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">Friends & Family Stay</label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, friendsAndFamilyStay: !formData.friendsAndFamilyStay })}
                                        className={`w-full p-4 rounded-xl border text-left transition-all ${formData.friendsAndFamilyStay
                                            ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium mb-1">Enable Friends & Family Stay</div>
                                                <div className="text-xs text-gray-500">Allow attendees to book accommodation with friends/family</div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${formData.friendsAndFamilyStay ? 'bg-emerald-500' : 'bg-white/20'}`}>
                                                {formData.friendsAndFamilyStay && <span className="text-white text-sm">✓</span>}
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* Alcohol Option */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">Alcohol Policy</label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, allowAlcohol: !formData.allowAlcohol })}
                                        className={`w-full p-4 rounded-xl border text-left transition-all ${formData.allowAlcohol
                                            ? 'bg-orange-500/10 border-orange-500/50 text-white'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium mb-1">Allow Alcohol at Event</div>
                                                <div className="text-xs text-gray-500">Indicate if alcoholic beverages are permitted</div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${formData.allowAlcohol ? 'bg-orange-500' : 'bg-white/20'}`}>
                                                {formData.allowAlcohol && <span className="text-white text-sm">✓</span>}
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                <div className="flex justify-between pt-4">
                                    <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
                                    <Button onClick={handleSubmit} isLoading={isSubmitting}>Create Event</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}

// Wrap with Suspense for useSearchParams
export default function CreateEventPage() {
    return (
        <Suspense fallback={
            <>
                <PartyBackground />
                <Navbar />
                <main className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </main>
            </>
        }>
            <CreateEventForm />
        </Suspense>
    );
}
