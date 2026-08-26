'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Input, StepperModal } from '@/components/ui';
import type { StepperStep } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { eventsApi, venuesApi, uploadApi, usersApi } from '@/lib/api';
import { isVenueOwner } from '@/lib/types';
import BankDetailsForm from '@/components/dashboard/BankDetailsForm';

const categories = ['party', 'concert', 'wedding', 'corporate', 'birthday', 'festival', 'other'];

type BankDetails = { accountName: string; accountNumber: string; ifscCode: string; bankName: string };

// Inner component that uses useSearchParams
function CreateEventForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedVenueId = searchParams.get('venue');
    const { isAuthenticated, isLoading, user } = useAuth();
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Jump back to the top whenever the step changes.
    // On a phone the form is taller than the screen, so pressing Next at the
    // bottom of step 1 dropped you into the middle of step 2 - it looked like
    // nothing had happened.
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [step]);
    interface TicketTier {
        name: string;
        price: number;
        description: string;
        // '' while the field is being cleared; coerced to a number on submit.
        maxQuantity: number | '';
    }

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
        // number | '' so the field can be emptied while typing. parseInt('')
        // is NaN, which a controlled number input rejects - that was why
        // backspacing over the last digit was impossible. Validated on submit.
        maxAttendees: 100 as number | '',
        ticketTiers: [{ name: '', price: 0, description: '', maxQuantity: 1 }] as TicketTier[],
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
            capacity: '' as number | '',
            images: [] as string[],
            locationLink: ''
        }
    });
    const [tierErrors, setTierErrors] = useState<Record<number, string>>({});
    const [venues, setVenues] = useState<{ _id: string; name: string }[]>([]);
    const [loadingVenues, setLoadingVenues] = useState(true);
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string>('');
    const [isVenueDropdownOpen, setIsVenueDropdownOpen] = useState(false);
    const [venueSearchQuery, setVenueSearchQuery] = useState('');
    const filteredVenues = venues.filter(v => v.name.toLowerCase().includes(venueSearchQuery.toLowerCase()));

    // Payout bank details — only relevant for owners (they receive settlement).
    // Captured here on first create, prefilled from User.bankDetails on later ones.
    const owner = isVenueOwner(user);
    const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
    useEffect(() => {
        if (!owner || !user?._id) return;
        let cancelled = false;
        usersApi.getProfile(user._id)
            .then((profile: any) => {
                if (!cancelled && profile?.bankDetails?.accountName) {
                    setBankDetails(profile.bankDetails);
                }
            })
            .catch(() => { /* no saved details yet — form starts empty */ });
        return () => { cancelled = true; };
    }, [owner, user?._id]);

    // Ticket tier helpers
    const updateTier = (index: number, field: keyof TicketTier, value: string | number) => {
        // TS: value is stored as-is; '' is only ever passed for numeric fields.
        const tiers = [...formData.ticketTiers];
        tiers[index] = { ...tiers[index], [field]: value };
        setFormData({ ...formData, ticketTiers: tiers });

        // Validate unique names
        if (field === 'name') {
            const names = tiers.map(t => t.name.trim().toLowerCase());
            const errors: Record<number, string> = {};
            names.forEach((n, i) => {
                if (n && names.indexOf(n) !== i) {
                    errors[i] = 'Duplicate tier name';
                }
            });
            setTierErrors(errors);
        }
    };

    const addTier = () => {
        if (formData.ticketTiers.length >= 10) return;
        setFormData({ ...formData, ticketTiers: [...formData.ticketTiers, { name: '', price: 0, description: '', maxQuantity: 1 }] });
    };

    const removeTier = (index: number) => {
        if (formData.ticketTiers.length <= 1) return;
        const tiers = formData.ticketTiers.filter((_, i) => i !== index);
        setFormData({ ...formData, ticketTiers: tiers });
        // Re-validate names
        const names = tiers.map(t => t.name.trim().toLowerCase());
        const errors: Record<number, string> = {};
        names.forEach((n, i) => {
            if (n && names.indexOf(n) !== i) {
                errors[i] = 'Duplicate tier name';
            }
        });
        setTierErrors(errors);
    };

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

    // Per-step validation gate for the stepper's Next button. Steps are
    // 1-based here (step state starts at 1) so the StepperModal's 0-based
    // index is offset by 1 when wired below.
    const validateStep = (currentStep: number): boolean => {
        if (currentStep === 1) {
            if (!formData.name) { showToast('Please enter an event name', 'error'); return false; }
            if (!formData.description) { showToast('Please enter an event description', 'error'); return false; }
        }
        if (currentStep === 2) {
            if (!formData.date) { showToast('Please select a start date', 'error'); return false; }
            if (!formData.endDate) { showToast('Please select an end date', 'error'); return false; }
            if (!formData.startTime) { showToast('Please select a start time', 'error'); return false; }
            if (!formData.endTime) { showToast('Please select an end time', 'error'); return false; }
            if (!formData.maxAttendees || Number(formData.maxAttendees) < 1) {
                showToast('Please enter a valid number of maximum attendees', 'error'); return false;
            }
        }
        if (currentStep === 3 && formData.ticketType === 'paid') {
            const tiers = formData.ticketTiers;
            for (let i = 0; i < tiers.length; i++) {
                if (!tiers[i].name.trim()) { showToast(`Tier ${i + 1}: Please enter a name`, 'error'); return false; }
                if (Number(tiers[i].maxQuantity) < 1) { showToast(`Tier ${i + 1}: Max quantity must be at least 1`, 'error'); return false; }
            }
            const names = tiers.map(t => t.name.trim().toLowerCase());
            if (names.some((n, i) => n && names.indexOf(n) !== i)) {
                showToast('Tier names must be unique', 'error'); return false;
            }
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!user?._id) {
            showToast('Please sign in to create an event', 'error');
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
        if (!formData.endDate) {
            showToast('Please select an end date', 'error');
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

        // Max attendees must be a positive number - the field can be left
        // empty while typing, so catch that here rather than clamping keystrokes.
        if (!formData.maxAttendees || Number(formData.maxAttendees) < 1) {
            showToast('Please enter a valid number of maximum attendees', 'error');
            setStep(2);
            return;
        }

        // Validate custom venue if being used
        if (formData.useCustomVenue && (!formData.customVenue.name || !formData.customVenue.address || !formData.customVenue.city || !formData.customVenue.capacity || Number(formData.customVenue.capacity) < 1 || !formData.customVenue.locationLink)) {
            showToast('Please fill in all custom venue details with a valid capacity', 'error');
            return;
        }

        // Validate ticket tiers for paid events
        if (formData.ticketType === 'paid') {
            const tiers = formData.ticketTiers;
            for (let i = 0; i < tiers.length; i++) {
                if (!tiers[i].name.trim()) {
                    showToast(`Tier ${i + 1}: Please enter a name`, 'error');
                    setStep(3);
                    return;
                }
                if (Number(tiers[i].maxQuantity) < 1) {
                    showToast(`Tier ${i + 1}: Max quantity must be at least 1`, 'error');
                    setStep(3);
                    return;
                }
            }
            // Check duplicate names
            const names = tiers.map(t => t.name.trim().toLowerCase());
            const hasDuplicates = names.some((n, i) => n && names.indexOf(n) !== i);
            if (hasDuplicates) {
                showToast('Tier names must be unique', 'error');
                setStep(3);
                return;
            }
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
                venue: (formData.useCustomVenue || !formData.venueId) ? null : formData.venueId,
                name: formData.name,
                description: formData.description,
                category: formData.category,
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString(),
                eventType: formData.eventType,
                ticketType: formData.ticketType,
                ticketPrice: formData.ticketType === 'paid' ? (formData.ticketTiers[0]?.price ?? 0) : 0,
                maxAttendees: formData.maxAttendees,
                termsAndConditions: formData.termsAndConditions || null,
                images: imageUrls,
                friendsAndFamilyStay: formData.friendsAndFamilyStay,
                allowAlcohol: formData.allowAlcohol,
                status: 'pending', // Events need venue and admin approval first
            };

            // Include ticket tiers for paid events
            if (formData.ticketType === 'paid') {
                eventData.ticketTiers = formData.ticketTiers.map(t => ({
                    name: t.name.trim(),
                    price: t.price,
                    description: t.description.trim(),
                    maxQuantity: Number(t.maxQuantity) || 1,
                }));
            }

            if (formData.useCustomVenue) {
                eventData.customVenue = {
                    isCustom: true,
                    ...formData.customVenue
                };
            }

            await eventsApi.create(eventData);
            // Custom venues are auto-approved, so only admin review remains -
            // don't tell the organizer a venue owner will review a venue that
            // has no owner.
            showToast(
                formData.useCustomVenue
                    ? 'Event submitted for approval! Our admin team will review it.'
                    : 'Event submitted for approval! The venue owner and admin will review it.',
                'success'
            );
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
                        <p className="text-gray-300 mb-4">Redirecting to sign in...</p>
                        <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full mx-auto" />
                    </div>
                </main>
            </>
        );
    }

    // Steps rendered inside the reusable StepperModal (built on the shared
    // <Modal>). Reusing <Modal> makes the create UI responsive by construction,
    // so there is no mobile horizontal overflow (35.1) and no per-field width
    // patching needed.
    const steps: StepperStep[] = [
        // Step 1: Basic Info
        {
            label: 'Basic Information',
            content: (
                <>
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

                </>
            ),
        },
        // Step 2: Date, Time & Venue
        {
            label: 'Date, Time & Venue',
            content: (
                <>
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
                                            className="w-full px-4 py-3 min-h-[50px] appearance-none rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">End Date *</label>
                                        <input
                                            type="date"
                                            value={formData.endDate}
                                            min={formData.date || new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                            className="w-full px-4 py-3 min-h-[50px] appearance-none rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Start Time *</label>
                                        <input
                                            type="time"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            className="w-full px-4 py-3 min-h-[50px] appearance-none rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">End Time *</label>
                                        <input
                                            type="time"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            className="w-full px-4 py-3 min-h-[50px] appearance-none rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Venue (Optional)</label>
                                    <div className="relative mb-4">
                                        <div 
                                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white flex justify-between items-center cursor-pointer ${loadingVenues || formData.useCustomVenue ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            onClick={() => {
                                                if (!loadingVenues && !formData.useCustomVenue) {
                                                    setIsVenueDropdownOpen(!isVenueDropdownOpen);
                                                }
                                            }}
                                        >
                                            <span className={formData.venueId ? "text-white" : "text-gray-300"}>
                                                {loadingVenues ? 'Loading venues...' : 
                                                 formData.venueId ? venues.find(v => v._id === formData.venueId)?.name || 'Selected Venue' : 'Select a venue'}
                                            </span>
                                            <svg className={`w-4 h-4 text-gray-300 transition-transform ${isVenueDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>

                                        {isVenueDropdownOpen && !formData.useCustomVenue && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setIsVenueDropdownOpen(false)} />
                                                <div className="absolute z-50 w-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col" style={{ maxHeight: '300px' }}>
                                                    <div className="p-2 border-b border-white/10">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Search venues..." 
                                                            value={venueSearchQuery}
                                                            onChange={(e) => setVenueSearchQuery(e.target.value)}
                                                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                                                            onClick={(e) => e.stopPropagation()}
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="overflow-y-auto">
                                                        <div 
                                                            className={`px-4 py-3 cursor-pointer hover:bg-white/10 text-sm ${!formData.venueId ? 'text-gray-300' : 'text-gray-300'}`}
                                                            onClick={() => {
                                                                setFormData({ ...formData, venueId: '', useCustomVenue: false });
                                                                setIsVenueDropdownOpen(false);
                                                                setVenueSearchQuery('');
                                                            }}
                                                        >
                                                            Clear Selection
                                                        </div>
                                                        {filteredVenues.length > 0 ? (
                                                            filteredVenues.map(venue => (
                                                                <div 
                                                                    key={venue._id} 
                                                                    className={`px-4 py-3 cursor-pointer hover:bg-violet-500/20 text-sm ${formData.venueId === venue._id ? 'bg-violet-500/10 text-violet-400' : 'text-gray-300'} transition-colors`}
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, venueId: venue._id, useCustomVenue: false });
                                                                        setIsVenueDropdownOpen(false);
                                                                        setVenueSearchQuery('');
                                                                    }}
                                                                >
                                                                    {venue.name}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    // Venue isn't listed - drop straight into the
                                                                    // manual details form. Custom venues are
                                                                    // auto-approved server-side, so this never sits
                                                                    // in "venue approval pending".
                                                                    setFormData({ ...formData, useCustomVenue: true, venueId: '' });
                                                                    setIsVenueDropdownOpen(false);
                                                                    setVenueSearchQuery('');
                                                                }}
                                                                className="w-full px-4 py-3 text-sm text-left text-gray-300 hover:bg-violet-500/20 transition-colors"
                                                            >
                                                                Venue not listed? <span className="text-violet-400 font-medium">Add its details manually →</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="flex-1 h-px bg-white/10"></div>
                                        <span className="text-xs text-gray-300">OR</span>
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
                                        <div className="text-xs text-gray-300">Create a venue specific to this event only</div>
                                    </button>
                                    <p className="mt-1.5 text-xs text-gray-300">Choose from available venues or create a custom one for this event</p>
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
                                                    customVenue: { ...formData.customVenue, capacity: e.target.value === '' ? '' : parseInt(e.target.value) }
                                                })}
                                                onWheel={(e) => e.currentTarget.blur()}
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
                                        onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                    />
                                </div>

                </>
            ),
        },
        // Step 3: Tickets & Privacy
        {
            label: 'Tickets & Privacy',
            content: (
                <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">Event Type</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, eventType: 'public' })}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${formData.eventType === 'public'
                                                ? 'bg-violet-500/20 border-violet-500 text-white shadow-lg shadow-violet-500/20'
                                                : 'bg-white/5 border-white/10 text-gray-300 opacity-60 hover:opacity-80'
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
                                                : 'bg-white/5 border-white/10 text-gray-300 opacity-60 hover:opacity-80'
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
                                                : 'bg-white/5 border-white/10 text-gray-300'
                                                }`}
                                        >
                                            <div className="font-medium mb-1">Free</div>
                                            <div className="text-xs text-gray-300">No ticket required</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, ticketType: 'paid' })}
                                            className={`p-4 rounded-xl border text-left transition-all ${formData.ticketType === 'paid'
                                                ? 'bg-green-500/10 border-green-500/50 text-white'
                                                : 'bg-white/5 border-white/10 text-gray-300'
                                                }`}
                                        >
                                            <div className="font-medium mb-1">Paid</div>
                                            <div className="text-xs text-gray-300">Set your ticket price</div>
                                        </button>
                                    </div>
                                </div>

                                {formData.ticketType === 'paid' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-medium text-gray-300">Ticket Tiers</label>
                                            <span className="text-xs text-gray-500">{formData.ticketTiers.length}/10</span>
                                        </div>

                                        {formData.ticketTiers.map((tier, index) => (
                                            <div key={index} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-gray-400">Tier {index + 1}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTier(index)}
                                                        disabled={formData.ticketTiers.length <= 1}
                                                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <input
                                                            type="text"
                                                            placeholder="Tier name"
                                                            maxLength={50}
                                                            value={tier.name}
                                                            onChange={(e) => updateTier(index, 'name', e.target.value)}
                                                            className={`w-full px-3 py-2 rounded-lg bg-white/5 border text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${tierErrors[index] ? 'border-red-500/50' : 'border-white/10'}`}
                                                        />
                                                        {tierErrors[index] && (
                                                            <p className="mt-1 text-xs text-red-400">{tierErrors[index]}</p>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        placeholder="Price (₹)"
                                                        min={0}
                                                        value={tier.price || ''}
                                                        onChange={(e) => updateTier(index, 'price', Math.max(0, parseInt(e.target.value) || 0))}
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Description (optional)"
                                                    maxLength={200}
                                                    value={tier.description}
                                                    onChange={(e) => updateTier(index, 'description', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                                />
                                                <div>
                                                    <label className="text-xs text-gray-400">Max Quantity</label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={tier.maxQuantity || ''}
                                                        onChange={(e) => updateTier(index, 'maxQuantity', e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={addTier}
                                            disabled={formData.ticketTiers.length >= 10}
                                            className="w-full py-2 rounded-xl border border-dashed border-white/20 text-sm text-gray-400 hover:bg-white/5 hover:border-violet-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        >
                                            + Add Tier
                                        </button>
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
                                    <p className="mt-1.5 text-xs text-gray-300">Max size per image: 2MB</p>
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
                                    <p className="mt-1.5 text-xs text-gray-300">Age restrictions, dress code, rules, etc.</p>
                                </div>

                </>
            ),
        },
        // Step 4: Additional Options
        {
            label: 'Additional Event Options',
            content: (
                <>
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
                                                <div className="text-xs text-gray-300">Allow attendees to book accommodation with friends/family</div>
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
                                                <div className="text-xs text-gray-300">Indicate if alcoholic beverages are permitted</div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${formData.allowAlcohol ? 'bg-orange-500' : 'bg-white/20'}`}>
                                                {formData.allowAlcohol && <span className="text-white text-sm">✓</span>}
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* 11.15 / 11.16 — entry points for features whose CRUD is
                                    owned by platform-feature-overhaul and only becomes available
                                    once the event exists. Rather than duplicating that CRUD in the
                                    create flow, surface a scoped notice pointing to where they're
                                    configured (the event's manage page after creation).
                                    ponytail: link-only entry point; the real UI lives on the
                                    manage page (DiscountCodesSection + scanning allocation). */}
                                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
                                    <div className="text-sm font-medium text-gray-300">After you create this event</div>
                                    <ul className="text-xs text-gray-400 list-disc list-inside space-y-1">
                                        <li>Set up <span className="text-gray-200">discount codes / coupons</span> — with validity bounded to your event dates.</li>
                                        <li>Assign <span className="text-gray-200">per-tier gate / scanner allocations</span> for entry management.</li>
                                    </ul>
                                    <p className="text-xs text-gray-500">
                                        These open on the event&apos;s manage page once it&apos;s created — find it under{' '}
                                        <span className="text-violet-400">Dashboard → Events</span>.
                                    </p>
                                </div>

                                {/* Owner payout bank details — capture on first create,
                                    prefill on later ones. Persists straight to
                                    User.bankDetails so settlement can read it later. */}
                                {owner && (
                                    <div className="border-t border-white/10 pt-6">
                                        <BankDetailsForm
                                            existingDetails={bankDetails}
                                            onSaved={(details) => setBankDetails(details)}
                                        />
                                    </div>
                                )}

                </>
            ),
        },
    ];

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-2xl mx-auto text-center">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Create Event</h1>
                    <p className="text-gray-300">Fill in the details to create your event</p>
                </div>
            </main>

            {/* Reusable stepper modal (built on the shared <Modal>). Always open
                on this dedicated create route; closing returns to the dashboard.
                step state is 1-based, the modal is 0-based -> offset by 1. */}
            <StepperModal
                isOpen
                onClose={() => router.push('/dashboard/events')}
                title="Create Event"
                size="lg"
                steps={steps}
                step={step - 1}
                onStepChange={(next) => setStep(next + 1)}
                canAdvance={(fromStep) => validateStep(fromStep + 1)}
                onFinish={handleSubmit}
                finishLabel="Create Event"
                isFinishing={isSubmitting}
            />
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
