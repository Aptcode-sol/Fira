'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CitySearch, Input, MultiSelect, StepperModal } from '@/components/ui';
import type { StepperStep } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

import { venuesApi, uploadApi, clearRequestCache } from '@/lib/api';
import { isValidLocationLink, isValidPincode, isFilled, isClean, type FieldErrors } from '@/lib/validation';
import PayoutAccountStep from '@/components/dashboard/PayoutAccountStep';

const AMENITIES = [
    'Parking', 'WiFi', 'AC', 'Sound System', 'Lighting', 'Stage',
    'Kitchen', 'Bar', 'Security', 'Projector', 'Restrooms', 'Wheelchair Access',
];

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Fired after a venue is created or edited.
 *
 * The pages that show venues are client components holding their own fetched copy,
 * so Next's router.refresh() alone will not update them. They listen for this and
 * refetch.
 */
export const VENUE_SAVED = 'venue-saved';

/** Blank draft. Declared once so "Clear all" and the initial state cannot drift. */
const EMPTY_FORM = {
    name: '',
    description: '',
    amenities: [] as string[],
    street: '',
    city: '',
    state: '',
    pincode: '',
    locationLink: '',
    capacityMax: 100,
    pricePerDay: 0,
    rules: '',
    freeCancellationHours: 48,
    partialRefundPercentage: 50,
    noCancellationHours: 24,
};

/** The subset of a venue this form reads when editing. */
export interface VenueDraft {
    _id: string;
    name?: string;
    description?: string;
    amenities?: string[];
    address?: { street?: string; city?: string; state?: string; pincode?: string };
    locationLink?: string;
    capacity?: { min?: number; max?: number };
    pricing?: { pricePerDay?: number | null; basePrice?: number | null };
    rules?: string[];
    cancellationPolicy?: {
        freeCancellationHours?: number;
        partialRefundPercentage?: number;
        noCancellationHours?: number;
    };
    payoutAccount?: string | null;
    images?: string[];
}

interface CreateVenueModalProps {
    isOpen: boolean;
    onClose: () => void;
    /**
     * Present = edit an existing venue instead of creating one.
     *
     * Editing reuses this form rather than having its own: the fields, validation
     * and layout are identical, and the app previously had three separate venue
     * forms (create route, an edit route, and an inline edit mode on the detail
     * page) that had already drifted apart - the edit ones still wrote
     * basePrice/pricePerHour and a min-guests field.
     */
    venue?: VenueDraft | null;
}

/**
 * Venue creation, in the same stepper modal event creation uses.
 *
 * It used to be a full route inside the venue-portal shell, which meant a second
 * layout, a second stepper implementation and a sidebar wrapped around a form. As a
 * modal it shares the responsive, scroll-locked, focus-trapped container with event
 * creation, so the two flows differ only in their fields.
 *
 * Validation is per-field: each step returns a field -> message map, the offending
 * inputs go red with the reason underneath, and Next refuses to advance. No toasts
 * for validation - a toast can only say one thing at a time and does not point at
 * the field it is talking about.
 */
export default function CreateVenueModal({ isOpen, onClose, venue = null }: CreateVenueModalProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();
    const isEditing = Boolean(venue?._id);

    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});

    const [form, setForm] = useState(EMPTY_FORM);

    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    /** Photos already saved on the venue. Editable when editing, empty when creating. */
    const [savedImages, setSavedImages] = useState<string[]>([]);
    /** Which saved payout account this venue's earnings go to. */
    const [payoutAccountId, setPayoutAccountId] = useState<string | null>(null);

    /** The values "Clear all" restores: the saved venue when editing, else blank. */
    const baseline = (): typeof EMPTY_FORM => {
        if (!venue) return EMPTY_FORM;
        return {
            name: venue.name ?? '',
            description: venue.description ?? '',
            amenities: venue.amenities ?? [],
            street: venue.address?.street ?? '',
            city: venue.address?.city ?? '',
            state: venue.address?.state ?? '',
            pincode: venue.address?.pincode ?? '',
            locationLink: venue.locationLink ?? '',
            capacityMax: venue.capacity?.max ?? 100,
            // Falls back to the legacy flat fee for venues saved before pricePerDay.
            pricePerDay: venue.pricing?.pricePerDay ?? venue.pricing?.basePrice ?? 0,
            rules: (venue.rules ?? []).join('\n'),
            freeCancellationHours: venue.cancellationPolicy?.freeCancellationHours ?? 48,
            partialRefundPercentage: venue.cancellationPolicy?.partialRefundPercentage ?? 50,
            noCancellationHours: venue.cancellationPolicy?.noCancellationHours ?? 24,
        };
    };

    /**
     * Which venue the form currently holds - null meaning "a new venue".
     *
     * The modal is mounted once app-wide and only hidden on close, which is what
     * makes an accidental close non-destructive. The flip side is that the form has
     * to notice when it is reopened pointing at something else, or editing a venue
     * and then pressing "Add venue" would open a prefilled duplicate of it.
     */
    const loadedVenueId = useRef<string | null>(null);

    // Load whichever venue this open is for. Reopening the *same* target keeps what
    // was typed, so a mis-tap on the backdrop loses nothing.
    useEffect(() => {
        if (!isOpen) return;
        setErrors({});
        const id = venue?._id ?? null;
        if (id === loadedVenueId.current) return;
        loadedVenueId.current = id;
        setForm(baseline());
        setSavedImages(venue?.images ?? []);
        setPayoutAccountId(venue?.payoutAccount ?? null);
        // The effect below revokes the previous object URLs when this list changes.
        setImageFiles([]);
        setImagePreviews([]);
        setStep(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, venue?._id]);

    /**
     * Discard changes. Creating goes back to blank; editing goes back to what is
     * currently saved, which is what "clear" means when you are amending something
     * that already exists.
     */
    const resetForm = () => {
        setForm(baseline());
        imagePreviews.forEach(url => URL.revokeObjectURL(url));
        setImageFiles([]);
        setImagePreviews([]);
        setSavedImages(venue?.images ?? []);
        setPayoutAccountId(venue?.payoutAccount ?? null);
        setErrors({});
        setStep(0);
    };

    // Object URLs are leaked memory until revoked.
    useEffect(() => () => imagePreviews.forEach(url => URL.revokeObjectURL(url)), [imagePreviews]);

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        // Clear a field's error as soon as the user edits it; keeping a stale red
        // border on a field they have just fixed reads as the form being broken.
        setErrors(prev => {
            if (!prev[key as string]) return prev;
            const next = { ...prev };
            delete next[key as string];
            return next;
        });
    };

    /** Per-step rules. Index matches the `steps` array below. */
    const validateStep = (index: number): FieldErrors => {
        const found: FieldErrors = {};

        if (index === 0) {
            if (!isFilled(form.name)) found.name = 'Venue name is required';
            if (!isFilled(form.description)) found.description = 'Tell guests what this space is like';
        }

        if (index === 1) {
            if (!isFilled(form.street)) found.street = 'Street address is required';
            if (!isFilled(form.city)) found.city = 'City is required';
            if (!isFilled(form.state)) found.state = 'State is required';
            if (!isFilled(form.pincode)) found.pincode = 'PIN code is required';
            else if (!isValidPincode(form.pincode)) found.pincode = 'Enter a valid 6-digit PIN code';
            if (!isFilled(form.locationLink)) found.locationLink = 'A maps link is required';
            else if (!isValidLocationLink(form.locationLink)) found.locationLink = 'Enter a valid URL, e.g. https://maps.google.com/...';
        }

        if (index === 2) {
            if (!form.capacityMax || form.capacityMax < 1) found.capacityMax = 'Enter how many guests fit';
            if (!form.pricePerDay || form.pricePerDay <= 0) found.pricePerDay = 'Set a day rate above 0';
        }

        if (index === 4) {
            if (form.freeCancellationHours < 0) found.freeCancellationHours = 'Cannot be negative';
            if (form.noCancellationHours < 0) found.noCancellationHours = 'Cannot be negative';
            if (form.noCancellationHours >= form.freeCancellationHours) {
                found.noCancellationHours = 'Must be fewer hours than free cancellation';
            }
            if (form.partialRefundPercentage < 0 || form.partialRefundPercentage > 100) {
                found.partialRefundPercentage = 'Must be between 0 and 100';
            }
        }

        if (index === 5) {
            // The creation gate: a venue that takes bookings needs somewhere to be
            // paid. PayoutAccountStep offers adding one inline, so this is reachable
            // rather than a dead end.
            if (!payoutAccountId) found.payoutAccount = 'Choose or add a payout account';
        }

        return found;
    };

    const canAdvance = (fromStep: number) => {
        const found = validateStep(fromStep);
        setErrors(found);
        return isClean(found);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files || []);
        // Photos already on the venue count toward the cap too, otherwise editing
        // could push a venue past MAX_IMAGES one upload at a time.
        const room = MAX_IMAGES - savedImages.length - imageFiles.length;

        // Field-level messages here too, rather than one toast per rejected file.
        if (picked.length > room) {
            setErrors(prev => ({ ...prev, images: `You can add up to ${MAX_IMAGES} photos` }));
            // Reset input so same file can be selected again
            e.target.value = '';
            return;
        }
        const oversized = picked.find(f => f.size > MAX_IMAGE_BYTES);
        if (oversized) {
            setErrors(prev => ({ ...prev, images: `${oversized.name} is over 2MB` }));
            // Reset input so same file can be selected again
            e.target.value = '';
            return;
        }

        setErrors(prev => {
            const next = { ...prev };
            delete next.images;
            return next;
        });
        const files = [...imageFiles, ...picked];
        setImageFiles(files);
        setImagePreviews(files.map(f => URL.createObjectURL(f)));
        // Reset input so same file can be selected again after removal
        e.target.value = '';
    };

    const removeImage = (index: number) => {
        const files = imageFiles.filter((_, i) => i !== index);
        setImageFiles(files);
        setImagePreviews(files.map(f => URL.createObjectURL(f)));
    };

    /**
     * Drop a saved photo. Only the venue's image list changes here - the file stays
     * in storage. Deleting the upload as well would make the removal irreversible
     * before the owner has even pressed Save changes.
     */
    const removeSavedImage = (index: number) => {
        setSavedImages(prev => prev.filter((_, i) => i !== index));
    };

    /**
     * Reorder saved photos. The first one is the venue's cover everywhere it is
     * listed, so ordering is the point of this control.
     *
     * ponytail: arrow buttons, not drag-and-drop. Native HTML5 drag does not fire on
     * touch, so the previous drag-only implementation could not reorder on a phone at
     * all - and buttons come with keyboard support for free.
     */
    const moveSavedImage = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= savedImages.length) return;
        setSavedImages(prev => {
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const handleSubmit = async () => {
        // Re-check every step, not just the last: someone can reach the end and then
        // go back and empty a field.
        const all: FieldErrors = {};
        for (let i = 0; i < 6; i++) Object.assign(all, validateStep(i));
        if (!isClean(all)) {
            setErrors(all);
            // Send them to the first step that actually has a problem.
            for (let i = 0; i < 6; i++) {
                if (!isClean(validateStep(i))) { setStep(i); break; }
            }
            return;
        }
        if (!user?._id) return;

        setIsSubmitting(true);
        try {
            // Newly picked files are appended to the saved photos in whatever order
            // the owner arranged them, so editing without touching photos keeps them.
            let images: string[] = savedImages;
            if (imageFiles.length > 0) {
                const uploaded = await uploadApi.multiple(imageFiles, 'venues');
                images = [...images, ...uploaded.images.map(img => img.url)];
            }

            const payload = {
                name: form.name.trim(),
                description: form.description.trim(),
                images,
                // min defaults to 1: no minimum headcount unless the owner sets one
                // later. The server schema defaults it too, this is just explicit.
                capacity: { min: 1, max: form.capacityMax },
                pricing: {
                    pricePerDay: form.pricePerDay,
                    // Mirrored so anything still reading the legacy field (SEO
                    // schema, admin lists, the venue portal list) keeps working
                    // without a migration. pricePerDay is authoritative.
                    basePrice: form.pricePerDay,
                    currency: 'INR',
                },
                amenities: form.amenities,
                rules: form.rules.split('\n').map(r => r.trim()).filter(Boolean),
                address: {
                    street: form.street.trim(),
                    city: form.city.trim(),
                    state: form.state.trim(),
                    pincode: form.pincode.trim(),
                    country: 'India',
                },
                locationLink: form.locationLink.trim(),
                cancellationPolicy: {
                    freeCancellationHours: form.freeCancellationHours,
                    partialRefundPercentage: form.partialRefundPercentage,
                    noCancellationHours: form.noCancellationHours,
                },
                payoutAccount: payoutAccountId,
            };

            if (isEditing && venue) {
                // No status here: editing must not silently re-submit an approved
                // venue for review, and it must not approve a pending one either.
                await venuesApi.update(venue._id, payload);
                showToast('Venue updated', 'success');
                onClose();
                // Stay put. The owner was looking at this venue; bouncing them to a
                // list after a save loses their place. The pages showing it hold their
                // own fetched copy, so tell them to reload it - and clear the API's
                // dedup cache first or they would refetch the pre-save response.
                clearRequestCache('/venues');
                window.dispatchEvent(new CustomEvent(VENUE_SAVED, { detail: { venueId: venue._id } }));
                router.refresh();
            } else {
                await venuesApi.create({ ...payload, owner: user._id, status: 'pending' });
                // A toast is right here: the outcome is not attached to any one field.
                showToast('Venue submitted for review', 'success');
                clearRequestCache('/venues');
                window.dispatchEvent(new CustomEvent(VENUE_SAVED));
                // The draft survives a close, so clear it on success or the next "Add
                // venue" would reopen the venue that was just submitted.
                resetForm();
                onClose();
                router.push('/venue-portal/venues');
            }
        } catch (err) {
            showToast(
                err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} venue`,
                'error'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Textarea styling that mirrors <Input>, including its error state. */
    const textarea = (field: string) =>
        `w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all resize-none ${errors[field]
            ? 'border-red-500 focus:ring-red-500/50'
            : 'border-white/10 focus:ring-violet-500/50 focus:border-violet-500/50'
        }`;

    const fieldError = (field: string) =>
        errors[field] ? <p role="alert" className="mt-2 text-sm text-red-400">{errors[field]}</p> : null;

    const steps: StepperStep[] = [
        {
            label: 'Basic Information',
            content: (
                <>
                    <Input
                        label="Venue Name *"
                        placeholder="Enter venue name"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        error={errors.name}
                    />
                    <div>
                        <label htmlFor="venue-description" className="block text-sm font-medium text-gray-300 mb-2">
                            Description *
                        </label>
                        <textarea
                            id="venue-description"
                            rows={4}
                            value={form.description}
                            onChange={(e) => set('description', e.target.value)}
                            placeholder="Describe your venue, its features, and what makes it special..."
                            aria-invalid={errors.description ? true : undefined}
                            className={textarea('description')}
                        />
                        {fieldError('description')}
                    </div>
                    {/* Amenities as a multi-select: twelve toggle pills wrapped to five
                        rows on a phone and pushed everything else below the fold. */}
                    <MultiSelect
                        label="Amenities"
                        placeholder="Select amenities"
                        options={AMENITIES.map(a => ({ value: a, label: a }))}
                        value={form.amenities}
                        onChange={(next) => set('amenities', next)}
                        searchable
                        searchPlaceholder="Search amenities..."
                    />
                </>
            ),
        },
        {
            label: 'Location',
            content: (
                <>
                    <Input
                        label="Street Address *"
                        placeholder="Building, street, area"
                        value={form.street}
                        onChange={(e) => set('street', e.target.value)}
                        error={errors.street}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        {/* Searched, not typed: the city filters and the
                            /venues/in/<city> pages match on the slug the server
                            derives from this string, so a free-typed city would
                            hide the venue from the very listings it belongs in. */}
                        <CitySearch
                            label="City *"
                            value={form.city}
                            // A suggestion carries its state, so State is filled
                            // rather than asked. Still editable below, because the
                            // owner is the authority on their own address.
                            onSelect={(c) => { set('city', c.city); set('state', c.state); }}
                            onClear={() => { set('city', ''); set('state', ''); }}
                            error={errors.city}
                        />
                        <Input
                            label="State *"
                            placeholder="Filled from your city"
                            value={form.state}
                            onChange={(e) => set('state', e.target.value)}
                            error={errors.state}
                        />
                    </div>
                    <Input
                        label="PIN Code *"
                        placeholder="6-digit PIN code"
                        inputMode="numeric"
                        maxLength={6}
                        value={form.pincode}
                        // Strip non-digits as they type: a PIN code has no other
                        // valid characters, so silently dropping them beats an error.
                        onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                        error={errors.pincode}
                    />
                    <Input
                        label="Maps Link *"
                        placeholder="https://maps.google.com/..."
                        value={form.locationLink}
                        onChange={(e) => set('locationLink', e.target.value)}
                        error={errors.locationLink}
                        helperText="Guests use this to find the venue"
                    />
                </>
            ),
        },
        {
            label: 'Capacity & Pricing',
            content: (
                <>
                    {/* Max capacity only. A minimum-guest field was required here and
                        defaulted to 1, which is what almost every owner left it at -
                        a step that changed nothing. It still exists on the venue for
                        owners who genuinely bill a minimum headcount, and can be set
                        when editing the venue. */}
                    <Input
                        label="Maximum Guests *"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={form.capacityMax}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            set('capacityMax', val === '' ? 0 : parseInt(val));
                        }}
                        error={errors.capacityMax}
                        helperText="The most people this space can hold"
                    />
                    {/* One rate, not a flat fee plus an hourly add-on. Two numbers
                        meant owners had to reason about how they combined, and guests
                        could not compare venues at a glance. */}
                    <Input
                        label="Price Per Day (₹) *"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={form.pricePerDay}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            set('pricePerDay', val === '' ? 0 : parseInt(val));
                        }}
                        error={errors.pricePerDay}
                        helperText="A booking is charged this much for each day it covers"
                    />
                </>
            ),
        },
        {
            label: 'Photos & Rules',
            content: (
                <>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Venue Photos <span className="text-violet-400">(Multiple • Landscape)</span>
                        </label>
                        <p className="text-xs text-gray-400 mb-3">
                            Upload up to <span className="text-white">{MAX_IMAGES} landscape images</span> (16:9 ratio). Recommended: 1200 × 675 px. JPG or PNG, up to 2MB each. First image becomes the cover.
                        </p>
                        {/* Current photos, when editing. The first is the cover, so the
                            arrows are the useful control here, not just delete. */}
                        {savedImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                {savedImages.map((src, index) => (
                                    <div key={src} className="relative rounded-xl overflow-hidden aspect-video">
                                        <img src={src} alt="" className="w-full h-full object-cover" />
                                        {index === 0 && (
                                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-violet-500 text-white text-[10px] font-medium">
                                                Cover
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeSavedImage(index)}
                                            aria-label={`Remove photo ${index + 1}`}
                                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center shadow-lg"
                                        >
                                            ×
                                        </button>
                                        <div className="absolute bottom-1 inset-x-1 flex justify-between">
                                            <button
                                                type="button"
                                                onClick={() => moveSavedImage(index, -1)}
                                                disabled={index === 0}
                                                aria-label={`Move photo ${index + 1} earlier`}
                                                className="w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-black disabled:opacity-30"
                                            >
                                                ‹
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveSavedImage(index, 1)}
                                                disabled={index === savedImages.length - 1}
                                                aria-label={`Move photo ${index + 1} later`}
                                                className="w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-black disabled:opacity-30"
                                            >
                                                ›
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <label className="flex flex-col items-center justify-center h-32 rounded-xl border border-dashed border-white/20 bg-black/40 cursor-pointer hover:border-violet-500/50 transition-colors">
                            <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-sm text-gray-400">
                                {savedImages.length + imageFiles.length > 0 ? 'Add more photos' : 'Click to upload venue photos'}
                            </span>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageSelect}
                                className="hidden"
                            />
                        </label>
                        {fieldError('images')}
                        {imagePreviews.length > 0 && (
                            <div className="grid grid-cols-3 gap-3 mt-3">
                                {imagePreviews.map((src, index) => (
                                    <div key={src} className="relative rounded-xl overflow-hidden aspect-video">
                                        <img src={src} alt="" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            aria-label="Remove photo"
                                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center shadow-lg"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <label htmlFor="venue-rules" className="block text-sm font-medium text-gray-300 mb-2">
                            House Rules
                        </label>
                        <textarea
                            id="venue-rules"
                            rows={4}
                            value={form.rules}
                            onChange={(e) => set('rules', e.target.value)}
                            placeholder={'One rule per line\nNo smoking indoors\nMusic off by 11pm'}
                            className={textarea('rules')}
                        />
                    </div>
                </>
            ),
        },
        {
            label: 'Cancellation Policy',
            content: (
                <>
                    <Input
                        label="Free Cancellation Until (hours before) *"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={form.freeCancellationHours}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            set('freeCancellationHours', val === '' ? 0 : parseInt(val));
                        }}
                        error={errors.freeCancellationHours}
                    />
                    <Input
                        label="Partial Refund (%) *"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={form.partialRefundPercentage}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            const num = val === '' ? 0 : Math.min(100, parseInt(val));
                            set('partialRefundPercentage', num);
                        }}
                        error={errors.partialRefundPercentage}
                        helperText="Refunded between the two windows below"
                    />
                    <Input
                        label="No Cancellation Within (hours before) *"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={form.noCancellationHours}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            set('noCancellationHours', val === '' ? 0 : parseInt(val));
                        }}
                        error={errors.noCancellationHours}
                    />
                </>
            ),
        },
        {
            label: 'Payout Account',
            content: (
                <PayoutAccountStep
                    subject="venue"
                    value={payoutAccountId}
                    onChange={(next) => {
                        setPayoutAccountId(next);
                        setErrors(prev => {
                            if (!prev.payoutAccount) return prev;
                            const rest = { ...prev };
                            delete rest.payoutAccount;
                            return rest;
                        });
                    }}
                    error={errors.payoutAccount}
                />
            ),
        },
    ];

    return (
        <StepperModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Venue' : 'List Your Venue'}
            steps={steps}
            step={step}
            onStepChange={setStep}
            canAdvance={canAdvance}
            onReset={resetForm}
            onFinish={handleSubmit}
            finishLabel={isEditing ? 'Save changes' : 'Submit for review'}
            isFinishing={isSubmitting}
            size="lg"
        />
    );
}
