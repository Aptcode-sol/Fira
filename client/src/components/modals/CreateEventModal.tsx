'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button, Input, StepperModal } from '@/components/ui';
import type { StepperStep } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { eventsApi, venuesApi, uploadApi, usersApi, clearRequestCache } from '@/lib/api';
import { isVenueOwner } from '@/lib/types';
import PayoutAccountStep from '@/components/dashboard/PayoutAccountStep';
import { openPickerOnClick } from '@/lib/dateInput';
import { isFilled, isClean, isValidPincode, isValidLocationLink, type FieldErrors } from '@/lib/validation';
import { CitySearch, Select } from '@/components/ui';

const categories = ['party', 'concert', 'wedding', 'corporate', 'birthday', 'festival', 'other'];



/**
 * Fired after an event is created or edited, so pages holding their own fetched copy
 * can reload it. Next's router.refresh() does not reach client-fetched state.
 */
export const EVENT_SAVED = 'event-saved';

/** The subset of an event this form reads when editing. */
export interface EventDraft {
    _id: string;
    name?: string;
    description?: string;
    category?: string;
    startDateTime?: string;
    endDateTime?: string;
    eventType?: 'public' | 'private';
    ticketType?: 'free' | 'paid';
    ticketPrice?: number;
    maxAttendees?: number;
    termsAndConditions?: string | null;
    ticketTiers?: { name?: string; price?: number; description?: string; maxQuantity?: number }[];
    images?: string[];
    friendsAndFamilyStay?: boolean;
    allowAlcohol?: boolean;
    payoutAccount?: string | null;
    venue?: { _id: string } | string | null;
    customVenue?: {
        isCustom?: boolean;
        name?: string;
        description?: string;
        address?: string;
        city?: string;
        state?: string;
        pincode?: string;
        capacity?: number;
        images?: string[];
        locationLink?: string;
    } | null;
}

/**
 * Seats a new tier starts with.
 *
 * Was 1, which is a tier that sells a single ticket and then reads "Sold out" -
 * so every organiser had to edit the field before their event worked, and anyone
 * who missed it published an event nobody could buy into. 100 is a plausible
 * opening number that still needs no thought for a small event.
 */
const DEFAULT_TIER_QUANTITY = 100;

// Inner component that uses useSearchParams
interface CreateEventFormProps {
    isOpen: boolean;
    /** Dismiss without creating. Must leave the user where they were. */
    onClose: () => void;
    /** Called after a successful create, before the modal is dismissed. */
    onCreated?: () => void;
    /**
     * Present = edit this event instead of creating one.
     *
     * Editing reuses this form rather than keeping its own: the event detail page had
     * a second three-step stepper with its own copy of the fields, its own validation
     * and its own tier editor, and the two had drifted - the edit one had no venue
     * step, no cover image, no payout account, and none of the per-field error
     * handling. Same fields, same rules, one implementation.
     */
    event?: EventDraft | null;
}

function CreateEventForm({ isOpen, onClose, onCreated, event = null }: CreateEventFormProps) {
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

    /**
     * Blank draft. Declared as a factory rather than a shared object because it
     * contains nested structures (ticketTiers, customVenue) - a single constant
     * would be mutated by the form and then "Clear all" would restore the mutated
     * version instead of a blank one.
     */
    const emptyForm = () => ({
        name: '',
        description: '',
        category: 'party',
        date: '',
        endDate: '',
        // Prefilled rather than blank. An empty time input renders as "--:--" and
        // Android's picker opens on the current clock time, so the value you got
        // depended on when you happened to open the form.
        startTime: '00:00',
        endTime: '00:00',
        venueId: '',
        venueName: '',
        eventType: 'public' as 'public' | 'private',
        ticketType: 'free' as 'free' | 'paid',
        ticketPrice: 0,
        // No maxAttendees: event capacity is summed from the tiers on submit.
        //
        // Every event has at least one tier: the tier name is what a ticket records
        // and what a door scanner admits, so "no tier" would leave a ticket with
        // nothing to check at the gate. Defaulted to General rather than blank so an
        // organiser who does not care about tiers is never blocked by the field.
        ticketTiers: [
            { name: 'General', price: 0, description: '', maxQuantity: DEFAULT_TIER_QUANTITY },
        ] as TicketTier[],
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
            images: [] as string[],
            locationLink: ''
        }
    });

    const isEditing = Boolean(event?._id);

    /**
     * The saved event as form values, or a blank draft when creating.
     *
     * Also what "Clear all" restores: when you are amending something that already
     * exists, clearing means going back to what is saved, not to empty.
     */
    const baseline = () => {
        if (!event) return emptyForm();
        const blank = emptyForm();
        // Dates are stored as one ISO instant each; the form splits them into a date
        // and a time field. Derived from the local parts so an evening event does not
        // shift a day when the UTC date differs from the local one.
        const localDate = (iso?: string) => {
            if (!iso) return '';
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return '';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const localTime = (iso?: string) => {
            if (!iso) return '';
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return '';
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };
        const venueId = typeof event.venue === 'string' ? event.venue : event.venue?._id ?? '';
        const tiers = (event.ticketTiers ?? []).map(t => ({
            name: t.name ?? '',
            price: t.price ?? 0,
            description: t.description ?? '',
            maxQuantity: (t.maxQuantity ?? DEFAULT_TIER_QUANTITY) as number | '',
        }));

        return {
            ...blank,
            name: event.name ?? '',
            description: event.description ?? '',
            category: event.category ?? blank.category,
            date: localDate(event.startDateTime),
            endDate: localDate(event.endDateTime),
            startTime: localTime(event.startDateTime),
            endTime: localTime(event.endDateTime),
            venueId,
            eventType: event.eventType ?? blank.eventType,
            ticketType: event.ticketType ?? blank.ticketType,
            ticketPrice: event.ticketPrice ?? 0,
            ticketTiers: tiers.length > 0 ? tiers : blank.ticketTiers,
            termsAndConditions: event.termsAndConditions ?? '',
            images: event.images ?? [],
            friendsAndFamilyStay: event.friendsAndFamilyStay ?? false,
            allowAlcohol: event.allowAlcohol ?? false,
            useCustomVenue: Boolean(event.customVenue?.isCustom),
            customVenue: {
                ...blank.customVenue,
                name: event.customVenue?.name ?? '',
                description: event.customVenue?.description ?? '',
                address: event.customVenue?.address ?? '',
                city: event.customVenue?.city ?? '',
                state: event.customVenue?.state ?? '',
                pincode: event.customVenue?.pincode ?? '',
                images: event.customVenue?.images ?? [],
                locationLink: event.customVenue?.locationLink ?? '',
            },
        };
    };

    const [formData, setFormData] = useState(emptyForm);
    const [tierErrors, setTierErrors] = useState<Record<number, string>>({});
    /** field name -> message, rendered under the offending input. */
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    /**
     * Update one field and clear its error. Leaving a red border on a field the user
     * has just corrected reads as the form still being broken.
     */
    const setField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
        setFormData(prev => ({ ...prev, [key]: value }));
        setFieldErrors(prev => {
            if (!prev[key as string]) return prev;
            const next = { ...prev };
            delete next[key as string];
            return next;
        });
    };

    /**
     * Update one custom-venue field and clear its error.
     *
     * Custom venue fields mirror the real Venue shape (name, description, street,
     * city, state, pincode, capacity, maps link) so a custom-venue event carries the
     * same data a listed venue would - that is what lets both render identically and
     * be filtered by city the same way.
     */
    const setCustomVenue = <K extends keyof typeof formData.customVenue>(
        key: K,
        value: (typeof formData.customVenue)[K]
    ) => {
        setFormData(prev => ({ ...prev, customVenue: { ...prev.customVenue, [key]: value } }));
        setFieldErrors(prev => {
            const errorKey = `customVenue.${String(key)}`;
            if (!prev[errorKey]) return prev;
            const next = { ...prev };
            delete next[errorKey];
            return next;
        });
    };

    /** Error text under a non-Input control (textarea, dropdown, time field). */
    const fieldError = (field: string) =>
        fieldErrors[field]
            ? <p role="alert" className="mt-2 text-sm text-red-400">{fieldErrors[field]}</p>
            : null;

    /** Border/ring classes matching <Input>'s error state, for raw inputs. */
    const controlClass = (field: string, extra = '') =>
        `w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${fieldErrors[field]
            ? 'border-red-500 focus:ring-red-500/50'
            : 'border-white/10 focus:ring-violet-500/50 focus:border-violet-500/50'
        } ${extra}`;
    const [venues, setVenues] = useState<{ _id: string; name: string }[]>([]);
    const [loadingVenues, setLoadingVenues] = useState(true);
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverImagePreview, setCoverImagePreview] = useState<string>('');
    const [isVenueDropdownOpen, setIsVenueDropdownOpen] = useState(false);
    const [venueSearchQuery, setVenueSearchQuery] = useState('');
    const filteredVenues = venues.filter(v => v.name.toLowerCase().includes(venueSearchQuery.toLowerCase()));

    /**
     * Which saved payout account this event's ticket revenue goes to.
     *
     * Replaces the inline "enter your bank details" form that used to live on the
     * last step and overwrote the single User.bankDetails record every time. Now the
     * organiser picks from saved accounts (default pre-selected) and can add one
     * without leaving the flow.
     */
    const [payoutAccountId, setPayoutAccountId] = useState<string | null>(null);
    /** Payout is always the final step. Derived so adding a step cannot desync it. */
    const totalSteps = 5;

    /**
     * Discard the whole draft and return to step 1.
     *
     * The form deliberately survives a close now, so this is the only way to start
     * over - without it an accidental first keystroke would follow the user around
     * until they reloaded the page.
     */
    const resetForm = () => {
        setFormData(baseline());
        if (coverImagePreview) URL.revokeObjectURL(coverImagePreview);
        setCoverImageFile(null);
        setCoverImagePreview('');
        setPayoutAccountId(event?.payoutAccount ?? null);
        setFieldErrors({});
        setTierErrors({});
        setStep(1);
    };

    // Load the event's values when an edit is opened. Keyed on the event id so
    // switching which event you are editing refills the form, while typing inside a
    // single session is never clobbered.
    useEffect(() => {
        if (!isOpen) return;
        setFieldErrors({});
        if (!event?._id) return;
        setFormData(baseline());
        setPayoutAccountId(event.payoutAccount ?? null);
        setStep(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, event?._id]);

    /** Live duplicate-name check, shared by updateTier and removeTier. */
    const duplicateNameErrors = (tiers: TicketTier[]): Record<number, string> => {
        const names = tiers.map(t => t.name.trim().toLowerCase());
        const errors: Record<number, string> = {};
        names.forEach((n, i) => {
            if (n && names.indexOf(n) !== i) errors[i] = 'Duplicate tier name';
        });
        return errors;
    };

    /**
     * Drop the location errors when the location choice changes.
     *
     * Switching between a listed venue and custom details makes the other branch's
     * errors meaningless - picking a venue must clear "Street address is required"
     * from the custom form you just abandoned, and vice versa.
     */
    const clearVenueErrors = () => {
        setFieldErrors(prev => {
            const next: FieldErrors = {};
            for (const [key, message] of Object.entries(prev)) {
                if (key !== 'venueId' && !key.startsWith('customVenue.')) next[key] = message;
            }
            return next;
        });
    };

    /** Drop every tier-keyed submit error. */
    const clearAllTierErrors = () => {
        setFieldErrors(prev => {
            const next: FieldErrors = {};
            for (const [key, message] of Object.entries(prev)) {
                if (!key.startsWith('tier-')) next[key] = message;
            }
            return next;
        });
    };

    // Ticket tier helpers
    const updateTier = (index: number, field: keyof TicketTier, value: string | number) => {
        // TS: value is stored as-is; '' is only ever passed for numeric fields.
        const tiers = [...formData.ticketTiers];
        tiers[index] = { ...tiers[index], [field]: value };
        setFormData({ ...formData, ticketTiers: tiers });

        // Clear this input's submit error as it is edited, the way setField does for
        // every other field. Without this a tier kept its red border and message
        // while you were fixing it, which reads as the form ignoring you.
        setFieldErrors(prev => {
            const key = `tier-${index}-${String(field)}`;
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });

        if (field === 'name') setTierErrors(duplicateNameErrors(tiers));
    };

    const addTier = () => {
        if (formData.ticketTiers.length >= 10) return;
        setFormData({
            ...formData,
            ticketTiers: [
                ...formData.ticketTiers,
                { name: '', price: 0, description: '', maxQuantity: DEFAULT_TIER_QUANTITY },
            ],
        });
    };

    const removeTier = (index: number) => {
        if (formData.ticketTiers.length <= 1) return;
        const tiers = formData.ticketTiers.filter((_, i) => i !== index);
        setFormData({ ...formData, ticketTiers: tiers });
        setTierErrors(duplicateNameErrors(tiers));
        // Submit errors are keyed by tier index, so dropping a tier leaves every
        // later error pointing at the wrong one - remove tier 1 and tier 2's
        // "name is required" would light up on what is now tier 1. Clear them all;
        // the next Next or submit re-derives them against the new list.
        clearAllTierErrors();
    };

    useEffect(() => {
        // Sign-in is still a redirect: there is nothing useful to show in the form
        // without an account. Returns to wherever they were, not to a create route,
        // since this is an overlay rather than a page now.
        if (!isLoading && !isAuthenticated) {
            onClose();
            router.replace(`/signin?redirect=${encodeURIComponent(window.location.pathname)}`);
        }
    }, [isLoading, isAuthenticated, router, onClose]);

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

    /**
     * Per-step rules, returning a field -> message map.
     *
     * These used to fire a toast and bail on the first failure, which meant a step
     * with three empty fields took three attempts to clear, and the message floated
     * in a corner with no indication of which field it meant. Now every offending
     * field is marked at once, red, with the reason underneath it.
     *
     * Steps are 1-based here (step state starts at 1); the StepperModal's 0-based
     * index is offset by 1 where it is wired below.
     */
    const collectStepErrors = (currentStep: number): FieldErrors => {
        const found: FieldErrors = {};

        if (currentStep === 1) {
            if (!isFilled(formData.name)) found.name = 'Event name is required';
            if (!isFilled(formData.description)) found.description = 'Describe what people are coming to';
        }

        if (currentStep === 2) {
            if (!formData.date) found.date = 'Start date is required';
            if (!formData.endDate) found.endDate = 'End date is required';
            else if (formData.date && formData.endDate < formData.date) {
                found.endDate = 'End date cannot be before the start date';
            }
            if (!formData.startTime) found.startTime = 'Start time is required';
            if (!formData.endTime) found.endTime = 'End time is required';
            // Same-day events must also run forwards in time.
            else if (
                formData.startTime && formData.date && formData.endDate &&
                formData.date === formData.endDate && formData.endTime <= formData.startTime
            ) {
                found.endTime = 'End time must be after the start time';
            }
            // No maxAttendees rule here any more - capacity comes from the tiers, and
            // each tier already has to be at least 1 (step 3).

            // An event needs a location: either a listed venue or a complete set of
            // custom venue details. Neither was previously required, so an event could
            // be created with `venue: null` and no `customVenue` - it then had nowhere
            // to happen, could not be filtered by city, and showed no address.
            if (formData.useCustomVenue) {
                // Identical rules to the venue creation form: a custom venue must be as
                // complete as a listed one, or events at it cannot be filtered by city
                // or shown with a real address.
                //
                // These run per-step rather than only on submit, so the red fields
                // appear on the step that owns them instead of after the final button.
                const cv = formData.customVenue;
                if (!isFilled(cv.name)) found['customVenue.name'] = 'Venue name is required';
                if (!isFilled(cv.address)) found['customVenue.address'] = 'Street address is required';
                if (!isFilled(cv.city)) found['customVenue.city'] = 'City is required';
                if (!isFilled(cv.state)) found['customVenue.state'] = 'State is required';
                if (!isFilled(cv.pincode)) found['customVenue.pincode'] = 'PIN code is required';
                else if (!isValidPincode(cv.pincode)) found['customVenue.pincode'] = 'Enter a valid 6-digit PIN code';
                // No capacity rule: the field is gone, and the tiers define how many
                // people the event admits.
                if (!isFilled(cv.locationLink)) found['customVenue.locationLink'] = 'A maps link is required';
                else if (!isValidLocationLink(cv.locationLink)) {
                    found['customVenue.locationLink'] = 'Enter a valid URL, e.g. https://maps.google.com/...';
                }
            } else if (!formData.venueId) {
                found.venueId = 'Pick a venue, or switch to entering your own venue details';
            }
        }

        // Tier names are checked on every event, free or paid: the name is what a
        // ticket records and what a door scanner is scoped to, so an unnamed tier
        // produces a ticket no gate can classify. Price is the only paid-only rule.
        if (currentStep === 3) {
            const tiers = formData.ticketTiers;
            const names = tiers.map(t => t.name.trim().toLowerCase());
            tiers.forEach((tier, i) => {
                if (!tier.name.trim()) found[`tier-${i}-name`] = 'Tier name is required';
                else if (names.indexOf(tier.name.trim().toLowerCase()) !== i) {
                    found[`tier-${i}-name`] = 'Tier names must be unique';
                }
                if (Number(tier.maxQuantity) < 1) found[`tier-${i}-maxQuantity`] = 'Must be at least 1';
                if (formData.ticketType === 'paid' && Number(tier.price) < 0) {
                    found[`tier-${i}-price`] = 'Price cannot be negative';
                }
            });
        }

        // Last step is the payout gate. PayoutAccountStep lets them add an account
        // inline, so this blocks without dead-ending.
        if (currentStep === totalSteps) {
            if (!payoutAccountId) found.payoutAccount = 'Choose or add a payout account';
        }

        return found;
    };

    const validateStep = (currentStep: number): boolean => {
        const found = collectStepErrors(currentStep);
        setFieldErrors(found);
        return isClean(found);
    };

    const handleSubmit = async () => {
        if (!user?._id) {
            showToast('Please sign in to create an event', 'error');
            return;
        }
        /*
         * Re-check every step on submit, not just the last: the user can reach the
         * end and then go back and empty a field. This replaces ~20 sequential
         * toast-and-bail checks - they surfaced one problem at a time, in a corner
         * of the screen, without pointing at the field they meant.
         */
        const found: FieldErrors = {};
        for (let s = 1; s <= totalSteps; s++) Object.assign(found, collectStepErrors(s));

        // Checks that only make sense once, at submit time.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Only when creating. An event that has already started is still editable -
        // rejecting its own saved date would make its terms and tiers uneditable.
        if (!isEditing && formData.date && new Date(formData.date) < today) {
            found.date = 'Event date cannot be in the past';
        }
        // Custom-venue and venue-selection rules are not repeated here: they live in
        // collectStepErrors(2), which the loop above already ran. They used to be
        // duplicated in both places, which is how the step check and the submit check
        // drift apart.

        if (!isClean(found)) {
            setFieldErrors(found);
            // Land them on the earliest step that has a problem so the red field is
            // actually on screen.
            const stepOf = (field: string) => {
                if (['name', 'description'].includes(field)) return 1;
                if (field.startsWith('customVenue.')) return 2;
                if (['date', 'endDate', 'startTime', 'endTime', 'venueId'].includes(field)) return 2;
                if (field.startsWith('tier-')) return 3;
                if (field === 'payoutAccount') return totalSteps;
                return 1;
            };
            setStep(Math.min(...Object.keys(found).map(stepOf)));
            return;
        }

        setIsSubmitting(true);
        try {
            // Upload image if selected. When editing without picking a new one, keep
            // whatever the event already had - an empty array would wipe the cover.
            let imageUrls: string[] = formData.images;
            if (coverImageFile) {
                showToast('Uploading image...', 'info');
                const uploadResult = await uploadApi.single(coverImageFile, 'events');
                imageUrls = [uploadResult.url];
            }

            // Combine date and time into DateTime strings
            const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
            const endDateStr = formData.endDate || formData.date;
            const endDateTime = new Date(`${endDateStr}T${formData.endTime}:00`);

            // Event capacity is the sum of what each tier admits, not a separate
            // number the organiser types. The two used to be independent fields, so an
            // event could claim room for 50 while its tiers could sell 300 - and the
            // purchase path caps against both, meaning whichever was smaller silently
            // won. Deriving it means they cannot disagree.
            const tierCapacity = formData.ticketTiers.reduce(
                (sum, t) => sum + (Number(t.maxQuantity) || 0),
                0
            );

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
                maxAttendees: tierCapacity,
                termsAndConditions: formData.termsAndConditions || null,
                payoutAccount: payoutAccountId,
                images: imageUrls,
                friendsAndFamilyStay: formData.friendsAndFamilyStay,
                allowAlcohol: formData.allowAlcohol,
                status: 'pending', // Events need venue and admin approval first
            };

            // Include ticket tiers for paid events
            // Always sent, for free events too: a free event still needs a named tier
            // so its tickets can be checked in at a tier-scoped door. A free tier is
            // simply priced at 0.
            eventData.ticketTiers = formData.ticketTiers.map(t => ({
                name: t.name.trim(),
                price: formData.ticketType === 'paid' ? t.price : 0,
                description: t.description.trim(),
                maxQuantity: Number(t.maxQuantity) || 1,
            }));

            if (formData.useCustomVenue) {
                eventData.customVenue = {
                    isCustom: true,
                    ...formData.customVenue
                };
            }

            if (isEditing && event) {
                // organizer and status are dropped: an edit must not reassign the
                // event, and must not silently re-submit an approved one for review
                // or approve a pending one.
                const { organizer, status, ...updates } = eventData;
                await eventsApi.update(event._id, updates);
                showToast('Event updated', 'success');
                clearRequestCache('/events');
                window.dispatchEvent(new CustomEvent(EVENT_SAVED, { detail: { eventId: event._id } }));
                onCreated?.();
                // Stay put. The organizer was looking at this event; bouncing them to
                // a list after a save loses their place.
                onClose();
                return;
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
            clearRequestCache('/events');
            window.dispatchEvent(new CustomEvent(EVENT_SAVED));
            // Success is the only path that navigates - the organizer wants to see
            // the event they just submitted. Close does not.
            // The draft survives a close, so it has to be cleared here or the next
            // "Create Event" would reopen the event that was just submitted.
            resetForm();
            onCreated?.();
            onClose();
            router.push('/dashboard/events');
        } catch (err) {
            const errorMessage = err instanceof Error
                ? err.message
                : `Failed to ${isEditing ? 'update' : 'create'} event`;
            showToast(errorMessage, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Auth check in flight. Nothing rendered rather than a page shell: this is an
    // overlay, and flashing a full-screen loader over the page the user is on would
    // be worse than a brief nothing.
    if (isLoading) return null;

    // The effect above handles the bounce to sign-in; render nothing meanwhile
    // rather than a full-page shell, since this is an overlay.
    if (!isAuthenticated) return null;

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
                                    label="Event Name *"
                                    placeholder="e.g., Neon Nights Festival"
                                    value={formData.name}
                                    onChange={(e) => setField('name', e.target.value)}
                                    error={fieldErrors.name}
                                />

                                <div>
                                    <label htmlFor="event-description" className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                                    <textarea
                                        id="event-description"
                                        placeholder="Describe your event..."
                                        value={formData.description}
                                        onChange={(e) => setField('description', e.target.value)}
                                        rows={4}
                                        aria-invalid={fieldErrors.description ? true : undefined}
                                        className={controlClass('description', 'resize-none')}
                                    />
                                    {fieldError('description')}
                                </div>

                                {/* Category: a dropdown on mobile, pills from md up.
                                    Seven pills wrapped to three rows on a phone and
                                    pushed the rest of the step below the fold; the
                                    dropdown collapses it to one row. On a pointer
                                    device the pills are one tap instead of two. */}
                                <div className="md:hidden">
                                    <Select
                                        label="Category"
                                        value={formData.category}
                                        onChange={(next) => setField('category', next)}
                                        options={categories.map(cat => ({
                                            value: cat,
                                            // Options are lowercase in the data; present them capitalised.
                                            label: cat.charAt(0).toUpperCase() + cat.slice(1),
                                        }))}
                                    />
                                </div>
                                <div className="hidden md:block">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setField('category', cat)}
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

                                {/* Dates read day-month-year.
                                    A native date input draws its own field order from the
                                    *browser's* language setting, not the page's - `lang`
                                    is already en-IN and Chrome still honours the browser
                                    locale - so the order cannot be forced from here. The
                                    hint states it explicitly, which is what a visitor on
                                    a US-locale browser needs in order to read the field
                                    correctly. */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Start Date *</label>
                                        <input
                                            type="date"
                                            value={formData.date}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setField('date', e.target.value)}
                                            {...openPickerOnClick}
                                            style={{ accentColor: '#8b5cf6' }}
                                            aria-invalid={fieldErrors.date ? true : undefined}
                                            aria-describedby="event-date-format"
                                            className={controlClass('date', 'min-h-[50px] appearance-none [color-scheme:dark]')}
                                        />
                                        {fieldError('date')}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">End Date *</label>
                                        <input
                                            type="date"
                                            value={formData.endDate}
                                            min={formData.date || new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setField('endDate', e.target.value)}
                                            {...openPickerOnClick}
                                            style={{ accentColor: '#8b5cf6' }}
                                            aria-invalid={fieldErrors.endDate ? true : undefined}
                                            aria-describedby="event-date-format"
                                            className={controlClass('endDate', 'min-h-[50px] appearance-none [color-scheme:dark]')}
                                        />
                                        {fieldError('endDate')}
                                    </div>
                                </div>
                                <p id="event-date-format" className="text-xs text-gray-400 -mt-2">
                                    Dates are day / month / year (dd/mm/yyyy).
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Start Time *</label>
                                        <input
                                            type="time"
                                            value={formData.startTime}
                                            onChange={(e) => setField('startTime', e.target.value)}
                                            style={{ accentColor: '#8b5cf6' }}
                                            aria-invalid={fieldErrors.startTime ? true : undefined}
                                            className={controlClass('startTime', 'min-h-[50px] appearance-none [color-scheme:dark]')}
                                        />
                                        {fieldError('startTime')}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">End Time *</label>
                                        <input
                                            type="time"
                                            value={formData.endTime}
                                            onChange={(e) => setField('endTime', e.target.value)}
                                            style={{ accentColor: '#8b5cf6' }}
                                            aria-invalid={fieldErrors.endTime ? true : undefined}
                                            className={controlClass('endTime', 'min-h-[50px] appearance-none [color-scheme:dark]')}
                                        />
                                        {fieldError('endTime')}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Venue (Optional)</label>
                                    <div className="relative mb-4">
                                        <div 
                                            // Red border when no venue is chosen and no
                                            // custom venue is being entered, matching
                                            // every other required field in the form.
                                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white flex justify-between items-center cursor-pointer ${fieldErrors.venueId ? 'border-red-500' : 'border-white/10'
                                                } ${loadingVenues || formData.useCustomVenue ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                        {fieldError('venueId')}

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
                                                                        clearVenueErrors();
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
                                                                    clearVenueErrors();
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

                                        {/* Same fields, labels and validation as the
                                            venue creation form, so a custom venue holds
                                            the same data a listed venue does. */}
                                        <Input
                                            label="Venue Name *"
                                            placeholder="e.g., My Backyard"
                                            value={formData.customVenue.name}
                                            onChange={(e) => setCustomVenue('name', e.target.value)}
                                            error={fieldErrors['customVenue.name']}
                                        />

                                        <div>
                                            <label htmlFor="custom-venue-description" className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                                            <textarea
                                                id="custom-venue-description"
                                                placeholder="Describe your venue..."
                                                value={formData.customVenue.description}
                                                onChange={(e) => setCustomVenue('description', e.target.value)}
                                                rows={3}
                                                className={controlClass('customVenue.description', 'resize-none')}
                                            />
                                        </div>

                                        <Input
                                            label="Street Address *"
                                            placeholder="Building, street, area"
                                            value={formData.customVenue.address}
                                            onChange={(e) => setCustomVenue('address', e.target.value)}
                                            error={fieldErrors['customVenue.address']}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Same lookup as the venue form - see
                                                the note there on why this is
                                                searched, not typed. Fills State too. */}
                                            <CitySearch
                                                label="City *"
                                                value={formData.customVenue.city}
                                                onSelect={(c) => { setCustomVenue('city', c.city); setCustomVenue('state', c.state); }}
                                                onClear={() => { setCustomVenue('city', ''); setCustomVenue('state', ''); }}
                                                error={fieldErrors['customVenue.city']}
                                            />
                                            <Input
                                                label="State *"
                                                placeholder="Filled from your city"
                                                value={formData.customVenue.state}
                                                onChange={(e) => setCustomVenue('state', e.target.value)}
                                                error={fieldErrors['customVenue.state']}
                                            />
                                        </div>

                                        {/* No capacity field. How many people the event
                                            admits is the sum of the per-tier attendee
                                            caps on the next step, so asking for a venue
                                            capacity here was a third number competing
                                            with those - and nothing reconciled it. */}
                                        <Input
                                            label="PIN Code *"
                                            placeholder="6-digit PIN code"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={formData.customVenue.pincode}
                                            onChange={(e) => setCustomVenue('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            error={fieldErrors['customVenue.pincode']}
                                        />

                                        <Input
                                            label="Maps Link *"
                                            placeholder="https://maps.google.com/..."
                                            value={formData.customVenue.locationLink}
                                            onChange={(e) => setCustomVenue('locationLink', e.target.value)}
                                            error={fieldErrors['customVenue.locationLink']}
                                            helperText="Guests use this to find the venue"
                                        />
                                    </div>
                                )}

                {/* No "Maximum Attendees" field here. Capacity is the sum of the
                    per-tier attendee caps on the next step, so asking for it twice let
                    the two disagree - an event could declare room for 50 while its
                    tiers sold 300, and nothing reconciled them. One number, derived
                    from the tiers. */}
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

                                {/* Shown for free events too - the tier name is required
                                    either way. Only the price is paid-only. */}
                                <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-medium text-gray-300">Ticket Tiers *</label>
                                            <span className="text-xs text-gray-500">{formData.ticketTiers.length}/10</span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Each tier gets its own door scanner link. Leave it as
                                            General if you only need one kind of entry.
                                        </p>

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
                                                <div className={formData.ticketType === 'paid' ? 'grid grid-cols-2 gap-3' : ''}>
                                                    <div>
                                                        <input
                                                            type="text"
                                                            placeholder="Tier name"
                                                            maxLength={50}
                                                            value={tier.name}
                                                            onChange={(e) => updateTier(index, 'name', e.target.value)}
                                                            className={`w-full px-3 py-2 rounded-lg bg-white/5 border text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${tierErrors[index] ? 'border-red-500' : 'border-white/10'}`}
                                                        />
                                                        {/* tierErrors is the live duplicate-name
                                                            check; fieldErrors is the submit/step
                                                            validation. Either can flag this input. */}
                                                        {(tierErrors[index] || fieldErrors[`tier-${index}-name`]) && (
                                                            <p role="alert" className="mt-1 text-xs text-red-400">
                                                                {tierErrors[index] || fieldErrors[`tier-${index}-name`]}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className={formData.ticketType === 'paid' ? '' : 'hidden'}>
                                                        <input
                                                            type="number"
                                                            placeholder="Price (₹)"
                                                            min={0}
                                                            value={tier.price || ''}
                                                            onChange={(e) => updateTier(index, 'price', Math.max(0, parseInt(e.target.value) || 0))}
                                                            onWheel={(e) => e.currentTarget.blur()}
                                                            aria-invalid={fieldErrors[`tier-${index}-price`] ? true : undefined}
                                                            className={`w-full px-3 py-2 rounded-lg bg-white/5 border text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${fieldErrors[`tier-${index}-price`]
                                                                ? 'border-red-500 focus:ring-red-500/50'
                                                                : 'border-white/10 focus:ring-violet-500/50'
                                                                }`}
                                                        />
                                                        {fieldErrors[`tier-${index}-price`] && (
                                                            <p role="alert" className="mt-1 text-xs text-red-400">{fieldErrors[`tier-${index}-price`]}</p>
                                                        )}
                                                    </div>
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
                                                    {/* "Max Quantity" described a stock
                                                        count; this is the number of people
                                                        this tier admits, and their sum is
                                                        the event's capacity. */}
                                                    <label className="text-xs text-gray-400">Max attendees for this tier</label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={tier.maxQuantity || ''}
                                                        onChange={(e) => updateTier(index, 'maxQuantity', e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                        aria-invalid={fieldErrors[`tier-${index}-maxQuantity`] ? true : undefined}
                                                        className={`w-full px-3 py-2 rounded-lg bg-white/5 border text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${fieldErrors[`tier-${index}-maxQuantity`]
                                                            ? 'border-red-500 focus:ring-red-500/50'
                                                            : 'border-white/10 focus:ring-violet-500/50'
                                                            }`}
                                                    />
                                                    {fieldErrors[`tier-${index}-maxQuantity`] && (
                                                        <p role="alert" className="mt-1 text-xs text-red-400">{fieldErrors[`tier-${index}-maxQuantity`]}</p>
                                                    )}
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

                                {/* Event Cover Image */}
                                <div>
                                    <label htmlFor="cover-image-upload" className="block text-sm font-medium text-gray-300 mb-1">
                                        Event Cover Image (Optional)
                                    </label>
                                    {/* The 2MB cap was only discoverable by exceeding it -
                                        the limit lived in the change handler and surfaced
                                        as a toast after picking a file. Stating the size
                                        up front means nobody picks a 6MB photo first.
                                        Dimensions matter too: this image is cropped to a
                                        wide hero on the event page and to a shorter strip
                                        on cards, so anything portrait loses its subject. */}
                                    <p id="cover-image-help" className="text-xs text-gray-400 mb-2">
                                        Landscape, 1200 × 675 px or larger (16:9). JPG or PNG, up to 2MB.
                                    </p>
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
                                            aria-describedby="cover-image-help"
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

                </>
            ),
        },
        // Final step: where ticket revenue goes. Also the creation gate - an event
        // that sells tickets needs a destination for the money.
        {
            label: 'Payout Account',
            content: (
                <PayoutAccountStep
                    subject="event"
                    value={payoutAccountId}
                    onChange={(next) => {
                        setPayoutAccountId(next);
                        setFieldErrors(prev => {
                            if (!prev.payoutAccount) return prev;
                            const rest = { ...prev };
                            delete rest.payoutAccount;
                            return rest;
                        });
                    }}
                    error={fieldErrors.payoutAccount}
                />
            ),
        },
    ];

    return (
        // No page chrome: this is an overlay now, so it renders over whatever the
        // user was already looking at. Closing therefore leaves them there instead
        // of navigating anywhere.
        // step state is 1-based, the modal is 0-based -> offset by 1.
        <StepperModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Event' : 'Create Event'}
            size="lg"
            steps={steps}
            step={step - 1}
            onStepChange={(next) => setStep(next + 1)}
            canAdvance={(fromStep) => validateStep(fromStep + 1)}
            onReset={resetForm}
            onFinish={handleSubmit}
            finishLabel={isEditing ? 'Save changes' : 'Create Event'}
            isFinishing={isSubmitting}
        />
    );
}

/**
 * Event creation, as an overlay.
 *
 * Was a dedicated route whose modal close button did `router.push('/dashboard/events')`
 * - the same destination as a successful create - so cancelling looked identical to
 * succeeding and dumped the user somewhere they had not asked to go. As a modal,
 * Close simply dismisses.
 *
 * Suspense is required because the form reads useSearchParams (venue prefill).
 */
export default function CreateEventModal({ isOpen, onClose, onCreated, event }: CreateEventFormProps) {
    /*
     * Deliberately no `if (!isOpen) return null` here.
     *
     * The form's state lives inside CreateEventForm, so unmounting it on close threw
     * away everything typed - closing by mistake meant starting the whole event over.
     * Keeping it mounted means a half-filled form is still there when you reopen,
     * matching how venue creation already behaved. The inner <Modal> renders nothing
     * while closed, so there is no visual or focus cost to staying mounted, and
     * "Clear all" in the footer is the explicit way to discard.
     */
    return (
        <Suspense fallback={null}>
            <CreateEventForm isOpen={isOpen} onClose={onClose} onCreated={onCreated} event={event} />
        </Suspense>
    );
}
