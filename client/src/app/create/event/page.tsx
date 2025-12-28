'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { eventsApi, venuesApi, uploadApi } from '@/lib/api';

const categories = ['party', 'concert', 'wedding', 'corporate', 'birthday', 'festival', 'other'];

export default function CreateEventPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: 'party',
        date: '',
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
    });
    const [venues, setVenues] = useState<{ _id: string; name: string }[]>([]);
    const [loadingVenues, setLoadingVenues] = useState(true);
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string>('');

    useEffect(() => {
        // Only redirect if auth check is complete AND user is not authenticated
        if (!isLoading && !isAuthenticated) {
            router.replace('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    // Fetch venues on mount
    useEffect(() => {
        const fetchVenues = async () => {
            try {
                const response = await venuesApi.getAll() as { venues?: { _id: string; name: string }[] } | { _id: string; name: string }[];
                const venueList = Array.isArray(response) ? response : (response?.venues || []);
                setVenues(venueList);
            } catch (err) {
                console.error('Failed to fetch venues:', err);
            } finally {
                setLoadingVenues(false);
            }
        };
        fetchVenues();
    }, []);

    const handleSubmit = async () => {
        if (!user?._id) {
            showToast('Please sign in to create an event', 'error');
            return;
        }
        if (!formData.venueId) {
            showToast('Please select a venue', 'error');
            return;
        }
        if (!formData.name || !formData.description || !formData.date || !formData.startTime || !formData.endTime) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        // Validate date/time is not in the past
        const selectedDateTime = new Date(`${formData.date}T${formData.startTime}`);
        if (selectedDateTime < new Date()) {
            showToast('Event date and time cannot be in the past', 'error');
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

            const eventData = {
                organizer: user._id,
                venue: formData.venueId,
                name: formData.name,
                description: formData.description,
                category: formData.category,
                date: formData.date,
                startTime: formData.startTime,
                endTime: formData.endTime,
                eventType: formData.eventType,
                ticketType: formData.ticketType,
                ticketPrice: formData.ticketType === 'paid' ? formData.ticketPrice : 0,
                maxAttendees: formData.maxAttendees,
                termsAndConditions: formData.termsAndConditions || null,
                images: imageUrls,
                status: 'upcoming',
            };

            await eventsApi.create(eventData);
            showToast('Event created successfully!', 'success');
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
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${step >= s ? 'bg-violet-500 text-white' : 'bg-white/10 text-gray-500'
                                    }`}>
                                    {s}
                                </div>
                                {s < 3 && (
                                    <div className={`w-12 h-0.5 mx-2 ${step > s ? 'bg-violet-500' : 'bg-white/10'}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Form Card */}
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8">
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

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                                    <input
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Start Time</label>
                                        <input
                                            type="time"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">End Time</label>
                                        <input
                                            type="time"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Venue *</label>
                                    <div className="relative">
                                        <select
                                            value={formData.venueId}
                                            onChange={(e) => setFormData({ ...formData, venueId: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 appearance-none cursor-pointer"
                                            disabled={loadingVenues}
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
                                    <p className="mt-1.5 text-xs text-gray-500">Choose from available venues for your event</p>
                                </div>

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
                                            <img src={coverImagePreview} alt="Preview" className="mt-2 w-full h-40 object-cover rounded-xl" />
                                        )}
                                    </div>
                                    <p className="mt-1.5 text-xs text-gray-500">Recommended: 1200x600px, max 10MB</p>
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
