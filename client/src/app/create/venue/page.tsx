'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { venuesApi, uploadApi } from '@/lib/api';

const amenitiesList = ['Parking', 'WiFi', 'AC', 'Sound System', 'Lighting', 'Stage', 'Kitchen', 'Bar', 'Security', 'Projector', 'Restrooms', 'Wheelchair Access'];

export default function CreateVenuePage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
    });
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace('/signin?redirect=/create/venue');
        }
    }, [isLoading, isAuthenticated, router]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length + imageFiles.length > 5) {
            showToast('Maximum 5 images allowed', 'error');
            return;
        }
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB per image
        const filtered = files.filter(f => {
            if (f.size > MAX_SIZE) {
                showToast(`Image ${f.name} exceeds 2MB limit`, 'error');
                return false;
            }
            return true;
        });
        const newFiles = [...imageFiles, ...filtered];
        const newPreviews = newFiles.map(f => URL.createObjectURL(f));
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
    };

    const removeImage = (index: number) => {
        const newFiles = imageFiles.filter((_, i) => i !== index);
        const newPreviews = imagePreviews.filter((_, i) => i !== index);
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
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
            showToast('Please sign in to list a venue', 'error');
            return;
        }
        if (!formData.name || !formData.description || !formData.street || !formData.city || !formData.state || !formData.pincode) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        if (!formData.locationLink) {
            showToast('Please add a location link', 'error');
            return;
        }
        if (!formData.basePrice) {
            showToast('Please set a base price', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            // Upload images if any
            let imageUrls: string[] = [];
            if (imageFiles.length > 0) {
                showToast('Uploading images...', 'info');
                const uploadResult = await uploadApi.multiple(imageFiles, 'venues');
                imageUrls = uploadResult.images.map(img => img.url);
            }

            const venueData = {
                owner: user._id,
                name: formData.name,
                description: formData.description,
                images: imageUrls,
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
                location: {
                    type: 'Point',
                    coordinates: [77.2090, 28.6139], // Default Delhi coordinates - can be enhanced with geocoding
                },
                status: 'pending',
            };

            await venuesApi.create(venueData);
            showToast('Venue submitted for review!', 'success');
            router.push('/dashboard/venues');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create venue';
            showToast(errorMessage, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">List Your Venue</h1>
                        <p className="text-gray-400">Share your space with event organizers</p>
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${step >= s ? 'bg-violet-500 text-white' : 'bg-white/10 text-gray-500'}`}>
                                    {s}
                                </div>
                                {s < 4 && <div className={`w-12 h-0.5 ${step > s ? 'bg-violet-500' : 'bg-white/10'}`} />}
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
                                    label="Venue Name *"
                                    placeholder="Enter venue name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                                    <textarea
                                        placeholder="Describe your venue, its features, and what makes it special..."
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
                                    <Button onClick={() => setStep(2)}>Next</Button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Location & Address */}
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
                                    <Button onClick={() => setStep(3)}>Next</Button>
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
                                        <p className="mt-1 text-xs text-gray-500">Optional hourly rate</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Venue Rules (Optional)</label>
                                    <textarea
                                        placeholder="Enter rules, one per line..."
                                        value={formData.rules}
                                        onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Location Link (Mandatory)</label>
                                    <Input
                                        placeholder="https://maps.google.com/..."
                                        value={formData.locationLink}
                                        onChange={(e) => setFormData({ ...formData, locationLink: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="flex justify-between">
                                    <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                                    <Button onClick={() => setStep(4)}>Next</Button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Images */}
                        {step === 4 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-4">Venue Images</h2>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Upload Images (Max 5)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageSelect}
                                        className="hidden"
                                        id="venue-images-upload"
                                        disabled={imageFiles.length >= 5}
                                    />
                                    <label
                                        htmlFor="venue-images-upload"
                                        className={`flex items-center justify-center gap-2 w-full px-4 py-6 rounded-xl bg-white/5 border border-dashed border-white/20 text-gray-400 hover:bg-white/10 hover:border-violet-500/50 cursor-pointer transition-all ${imageFiles.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span>Click to select images ({imageFiles.length}/5)</span>
                                    </label>
                                    <p className="mt-1.5 text-xs text-gray-500">Images will upload when you submit</p>
                                </div>

                                {imagePreviews.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {imagePreviews.map((preview, index) => (
                                            <div key={index} className="relative group">
                                                <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-xl" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex justify-between pt-4">
                                    <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
                                    <Button onClick={handleSubmit} isLoading={isSubmitting}>Submit Venue</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
