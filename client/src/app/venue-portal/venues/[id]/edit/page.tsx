'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { venuesApi, uploadApi } from '@/lib/api';
import VenueDashboardLayout from '@/components/venue-portal/VenueDashboardLayout';
import { SlideUp, FadeIn } from '@/components/animations';

const amenitiesList = ['Parking', 'WiFi', 'AC', 'Sound System', 'Lighting', 'Stage', 'Kitchen', 'Bar', 'Security', 'Projector', 'Restrooms', 'Wheelchair Access'];

export default function VenuePortalEditVenuePage() {
    const router = useRouter();
    const params = useParams();
    const venueId = params.id as string;
    const { isAuthenticated, isLoading, user } = useAuth();
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [isFetching, setIsFetching] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingImages, setExistingImages] = useState<string[]>([]); // already-uploaded URLs
    const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        capacityMin: 1,
        capacityMax: 100,
        basePrice: 0,
        pricePerHour: 0,
        amenities: [] as string[],
        rules: '',
        street: '',
        city: '',
        state: '',
        pincode: '',
        locationLink: '',
        freeCancellationHours: 48,
        partialRefundPercentage: 50,
        noCancellationHours: 24,
    });

    // Auth guard
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/venue-portal/signin');
        }
        if (!isLoading && isAuthenticated && user?.role !== 'venue_owner') {
            router.push('/dashboard');
        }
    }, [isLoading, isAuthenticated, user, router]);

    // Load existing venue data
    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'venue_owner' || !venueId) return;

        const fetchVenue = async () => {
            setIsFetching(true);
            try {
                const venue = await venuesApi.getById(venueId) as any;
                setFormData({
                    name: venue.name || '',
                    description: venue.description || '',
                    capacityMin: venue.capacity?.min || 1,
                    capacityMax: venue.capacity?.max || 100,
                    basePrice: venue.pricing?.basePrice || 0,
                    pricePerHour: venue.pricing?.pricePerHour || 0,
                    amenities: venue.amenities || [],
                    rules: Array.isArray(venue.rules) ? venue.rules.join('\n') : (venue.rules || ''),
                    street: venue.address?.street || '',
                    city: venue.address?.city || '',
                    state: venue.address?.state || '',
                    pincode: venue.address?.pincode || '',
                    locationLink: venue.locationLink || '',
                    freeCancellationHours: venue.cancellationPolicy?.freeCancellationHours ?? 48,
                    partialRefundPercentage: venue.cancellationPolicy?.partialRefundPercentage ?? 50,
                    noCancellationHours: venue.cancellationPolicy?.noCancellationHours ?? 24,
                });
                setExistingImages(venue.images || []);
            } catch (err) {
                console.error('Failed to fetch venue:', err);
                showToast('Failed to load venue data', 'error');
                router.push('/venue-portal/venues');
            } finally {
                setIsFetching(false);
            }
        };

        fetchVenue();
    }, [isAuthenticated, user, venueId]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const totalCount = existingImages.length + newImageFiles.length + files.length;
        if (totalCount > 5) {
            showToast('Maximum 5 images allowed', 'error');
            return;
        }
        const MAX_SIZE = 2 * 1024 * 1024;
        const filtered = files.filter(f => {
            if (f.size > MAX_SIZE) {
                showToast(`Image ${f.name} exceeds 2MB limit`, 'error');
                return false;
            }
            return true;
        });
        const updatedFiles = [...newImageFiles, ...filtered];
        const updatedPreviews = updatedFiles.map(f => URL.createObjectURL(f));
        setNewImageFiles(updatedFiles);
        setNewImagePreviews(updatedPreviews);
    };

    const removeExistingImage = (index: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeNewImage = (index: number) => {
        setNewImageFiles(prev => prev.filter((_, i) => i !== index));
        setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const toggleAmenity = (amenity: string) => {
        setFormData(prev => ({
            ...prev,
            amenities: prev.amenities.includes(amenity)
                ? prev.amenities.filter(a => a !== amenity)
                : [...prev.amenities, amenity]
        }));
    };

    const handleSubmit = async () => {
        if (!user?._id) {
            showToast('Please sign in', 'error');
            return;
        }
        if (!formData.name || !formData.description || !formData.street || !formData.city || !formData.state || !formData.pincode) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        if (!formData.basePrice) {
            showToast('Please set a base price', 'error');
            return;
        }
        if (formData.noCancellationHours >= formData.freeCancellationHours) {
            showToast('No-cancellation hours must be less than free cancellation hours', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            let newUploadedUrls: string[] = [];
            if (newImageFiles.length > 0) {
                showToast('Uploading new images...', 'info');
                const uploadResult = await uploadApi.multiple(newImageFiles, 'venues');
                newUploadedUrls = uploadResult.images.map(img => img.url);
            }

            const venueData = {
                name: formData.name,
                description: formData.description,
                images: [...existingImages, ...newUploadedUrls],
                capacity: {
                    min: formData.capacityMin,
                    max: formData.capacityMax,
                },
                pricing: {
                    basePrice: formData.basePrice,
                    pricePerHour: formData.pricePerHour || null,
                    currency: 'INR',
                },
                amenities: formData.amenities,
                rules: formData.rules.split('\n').filter(r => r.trim()),
                address: {
                    street: formData.street,
                    city: formData.city,
                    state: formData.state,
                    pincode: formData.pincode,
                    country: 'India',
                },
                locationLink: formData.locationLink,
                cancellationPolicy: {
                    freeCancellationHours: formData.freeCancellationHours,
                    partialRefundPercentage: formData.partialRefundPercentage,
                    noCancellationHours: formData.noCancellationHours,
                },
            };

            await venuesApi.update(venueId, venueData);
            showToast('Venue updated successfully!', 'success');
            router.push('/venue-portal/venues');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update venue';
            showToast(errorMessage, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalImages = existingImages.length + newImageFiles.length;

    if (isLoading || isFetching) {
        return (
            <VenueDashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </VenueDashboardLayout>
        );
    }

    if (!isAuthenticated || user?.role !== 'venue_owner') {
        return null;
    }

    return (
        <VenueDashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="flex items-center gap-3 mb-8">
                        <button
                            onClick={() => router.push('/venue-portal/venues')}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Edit Venue</h1>
                            <p className="text-gray-300 text-sm mt-0.5">Update your venue details</p>
                        </div>
                    </div>
                </SlideUp>

                {/* Progress Steps */}
                <FadeIn delay={0.1}>
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex items-center">
                                <button
                                    onClick={() => setStep(s)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${step >= s ? 'bg-violet-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                                >
                                    {s}
                                </button>
                                {s < 4 && <div className={`w-12 h-0.5 ${step > s ? 'bg-violet-500' : 'bg-white/10'}`} />}
                            </div>
                        ))}
                    </div>
                </FadeIn>

                {/* Form Card */}
                <FadeIn delay={0.2}>
                    <div className="max-w-2xl mx-auto bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 md:p-8">

                        {/* Step 1: Basic Info */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>

                                <Input
                                    label="Venue Name *"
                                    placeholder="Enter venue name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                                    <textarea
                                        placeholder="Describe your venue..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">Amenities</label>
                                    <div className="flex flex-wrap gap-2">
                                        {amenitiesList.map((amenity) => (
                                            <button
                                                key={amenity}
                                                type="button"
                                                onClick={() => toggleAmenity(amenity)}
                                                className={`px-3 py-1.5 rounded-full text-sm transition-all ${formData.amenities.includes(amenity)
                                                    ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300'
                                                    : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                {amenity}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button variant="violet" onClick={() => setStep(2)}>Next</Button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Location */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Location & Address</h2>

                                <Input
                                    label="Street Address *"
                                    placeholder="Enter street address"
                                    value={formData.street}
                                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="City *"
                                        placeholder="City"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    />
                                    <Input
                                        label="State *"
                                        placeholder="State"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                    />
                                </div>

                                <Input
                                    label="Pincode *"
                                    placeholder="Enter pincode"
                                    value={formData.pincode}
                                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                />

                                <div className="flex justify-between">
                                    <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                                    <Button variant="violet" onClick={() => setStep(3)}>Next</Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Capacity & Pricing */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Capacity & Pricing</h2>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Min Capacity</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={formData.capacityMin}
                                            onChange={(e) => setFormData({ ...formData, capacityMin: parseInt(e.target.value) })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Max Capacity *</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={formData.capacityMax}
                                            onChange={(e) => setFormData({ ...formData, capacityMax: parseInt(e.target.value) })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Base Price (₹) *</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={formData.basePrice}
                                            onChange={(e) => setFormData({ ...formData, basePrice: parseInt(e.target.value) })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Price Per Hour (₹)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={formData.pricePerHour}
                                            onChange={(e) => setFormData({ ...formData, pricePerHour: parseInt(e.target.value) })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        />
                                        <p className="mt-1 text-xs text-gray-300">Optional</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Venue Rules</label>
                                    <textarea
                                        placeholder="Enter rules, one per line..."
                                        value={formData.rules}
                                        onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Location Link</label>
                                    <Input
                                        placeholder="https://maps.google.com/..."
                                        value={formData.locationLink}
                                        onChange={(e) => setFormData({ ...formData, locationLink: e.target.value })}
                                    />
                                </div>

                                {/* Cancellation Policy */}
                                <div className="border-t border-white/10 pt-6">
                                    <h3 className="text-lg font-medium text-white mb-1">Cancellation Policy</h3>
                                    <p className="text-sm text-gray-400 mb-4">Define how cancellations are handled for advance bookings</p>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Free Cancellation Hours (1–720)</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={720}
                                                value={formData.freeCancellationHours}
                                                onChange={(e) => setFormData({ ...formData, freeCancellationHours: Math.max(1, Math.min(720, parseInt(e.target.value) || 1)) })}
                                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                            />
                                            <p className="mt-1 text-xs text-gray-400">Hours before booking start for full refund</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Partial Refund Percentage (0–100)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={formData.partialRefundPercentage}
                                                onChange={(e) => setFormData({ ...formData, partialRefundPercentage: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                            />
                                            <p className="mt-1 text-xs text-gray-400">Refund percentage for cancellations within the partial window</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">No Cancellation Hours (0–720)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                max={720}
                                                value={formData.noCancellationHours}
                                                onChange={(e) => setFormData({ ...formData, noCancellationHours: Math.max(0, Math.min(720, parseInt(e.target.value) || 0)) })}
                                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                            />
                                            <p className="mt-1 text-xs text-gray-400">Hours before booking start within which cancellation is not allowed</p>
                                        </div>

                                        {formData.noCancellationHours >= formData.freeCancellationHours && (
                                            <p className="text-sm text-red-400">No-cancellation hours must be less than free cancellation hours</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                                    <Button variant="violet" onClick={() => setStep(4)}>Next</Button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Images */}
                        {step === 4 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Venue Images</h2>

                                {/* Existing Images */}
                                {existingImages.length > 0 && (
                                    <div>
                                        <p className="text-sm text-gray-300 mb-2">Current Images</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {existingImages.map((url, index) => (
                                                <div key={index} className="relative group">
                                                    <img src={url} alt={`Venue ${index + 1}`} className="w-full h-32 object-cover rounded-xl" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeExistingImage(index)}
                                                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Upload New Images */}
                                {totalImages < 5 && (
                                    <div>
                                        <p className="text-sm text-gray-300 mb-2">Add New Images ({totalImages}/5 total)</p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageSelect}
                                            className="hidden"
                                            id="venue-edit-images-upload"
                                            disabled={totalImages >= 5}
                                        />
                                        <label
                                            htmlFor="venue-edit-images-upload"
                                            className="flex items-center justify-center gap-2 w-full px-4 py-6 rounded-xl bg-white/5 border border-dashed border-white/20 text-gray-400 hover:bg-white/10 hover:border-violet-500/50 cursor-pointer transition-all"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>Click to add images</span>
                                        </label>
                                    </div>
                                )}

                                {/* New Image Previews */}
                                {newImagePreviews.length > 0 && (
                                    <div>
                                        <p className="text-sm text-gray-300 mb-2">New Images to Upload</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {newImagePreviews.map((preview, index) => (
                                                <div key={index} className="relative group">
                                                    <img src={preview} alt={`New ${index + 1}`} className="w-full h-32 object-cover rounded-xl opacity-80 ring-2 ring-violet-500/50" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeNewImage(index)}
                                                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                                                    >
                                                        ×
                                                    </button>
                                                    <span className="absolute bottom-2 left-2 text-xs bg-violet-500 text-white px-1.5 py-0.5 rounded">New</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between pt-4">
                                    <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
                                    <Button variant="violet" onClick={handleSubmit} isLoading={isSubmitting}>
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </FadeIn>
            </div>
        </VenueDashboardLayout>
    );
}
