'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Input, Select } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { brandsApi, uploadApi } from '@/lib/api';

const brandTypes = [
    { value: 'brand', label: 'Brand' },
    { value: 'band', label: 'Band / Artist' },
    { value: 'organizer', label: 'Event Organizer' },
];

export default function CreateBrandPage() {
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        type: 'brand',
        bio: '',
        address: '',
        instagram: '',
        twitter: '',
        facebook: '',
        website: '',
        spotify: '',
        youtube: '',
    });

    const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
    const [profilePreview, setProfilePreview] = useState('');
    const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState('');

    const [members, setMembers] = useState<{ name: string; role: string }[]>([]);
    const [newMember, setNewMember] = useState({ name: '', role: '' });

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/signin?redirect=/create/brand');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
            </div>
        );
    }

    const { showToast } = useToast();
    if (!user) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const MAX_SIZE = 2 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                showToast('Profile photo exceeds 2MB limit', 'error');
                return;
            }
            setProfilePhoto(file);
            setProfilePreview(URL.createObjectURL(file));
        }
    };

    const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const MAX_SIZE = 2 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                showToast('Cover photo exceeds 2MB limit', 'error');
                return;
            }
            setCoverPhoto(file);
            setCoverPreview(URL.createObjectURL(file));
        }
    };

    const addMember = () => {
        if (newMember.name && newMember.role) {
            setMembers(prev => [...prev, newMember]);
            setNewMember({ name: '', role: '' });
        }
    };

    const removeMember = (index: number) => {
        setMembers(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.type) {
            setError('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            let profilePhotoUrl = '';
            let coverPhotoUrl = '';

            // Upload photos
            if (profilePhoto) {
                const result = await uploadApi.single(profilePhoto, 'brands');
                profilePhotoUrl = result.url;
            }
            if (coverPhoto) {
                const result = await uploadApi.single(coverPhoto, 'brands');
                coverPhotoUrl = result.url;
            }

            const brandData = {
                userId: user._id,
                name: formData.name,
                type: formData.type,
                bio: formData.bio,
                address: formData.address,
                profilePhoto: profilePhotoUrl || undefined,
                coverPhoto: coverPhotoUrl || undefined,
                socialLinks: {
                    instagram: formData.instagram || null,
                    twitter: formData.twitter || null,
                    facebook: formData.facebook || null,
                    website: formData.website || null,
                    spotify: formData.spotify || null,
                    youtube: formData.youtube || null,
                },
                members: members.length > 0 ? members : undefined,
            };

            await brandsApi.create(brandData);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to create brand profile');
        } finally {
            setIsSubmitting(false);
        }
    };

    const steps = [
        { num: 1, title: 'Basic Info' },
        { num: 2, title: 'Photos' },
        { num: 3, title: 'Social Links' },
        { num: 4, title: 'Team' },
    ];

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                            Create Your <span className="text-cyan-400">Brand</span>
                        </h1>
                        <p className="text-gray-400">Build your presence and connect with your audience</p>
                    </div>

                    {/* Steps */}
                    <div className="flex justify-center gap-2 mb-8">
                        {steps.map((step) => (
                            <button
                                key={step.num}
                                onClick={() => setCurrentStep(step.num)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${currentStep === step.num
                                    ? 'bg-cyan-500 text-white'
                                    : currentStep > step.num
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'bg-white/5 text-gray-500'
                                    }`}
                            >
                                <span className="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center text-xs">
                                    {currentStep > step.num ? '✓' : step.num}
                                </span>
                                <span className="hidden md:inline">{step.title}</span>
                            </button>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6 text-center">
                            {error}
                        </div>
                    )}

                    {/* Form Container */}
                    <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8">
                        {/* Step 1: Basic Info */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Brand Name *</label>
                                    <Input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        placeholder="Your brand name"
                                        className="bg-black/40"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Type *</label>
                                    <Select
                                        value={formData.type}
                                        onChange={(val) => setFormData(prev => ({ ...prev, type: val }))}
                                        options={brandTypes}
                                        placeholder="Select type"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                                    <textarea
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleInputChange}
                                        placeholder="Tell us about your brand..."
                                        rows={4}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                                    <Input
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        placeholder="City, Country"
                                        className="bg-black/40"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Photos */}
                        {currentStep === 2 && (
                            <div className="space-y-8">
                                {/* Cover Photo */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">Cover Photo</label>
                                    <div className="relative h-40 rounded-xl overflow-hidden border border-dashed border-white/20 bg-black/40">
                                        {coverPreview ? (
                                            <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span className="text-sm">1200 x 400 recommended</span>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleCoverPhotoChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                {/* Profile Photo */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">Profile Photo</label>
                                    <div className="flex items-center gap-6">
                                        <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-dashed border-white/20 bg-black/40">
                                            {profilePreview ? (
                                                <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-500">
                                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleProfilePhotoChange}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                        </div>
                                        <div className="text-gray-400 text-sm">
                                            <p>Click to upload</p>
                                            <p className="text-gray-500">Square image works best</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Social Links */}
                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <p className="text-gray-400 text-sm mb-4">Add your social media links (optional)</p>

                                {[
                                    { name: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
                                    { name: 'twitter', label: 'Twitter/X', placeholder: 'https://x.com/...' },
                                    { name: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
                                    { name: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' },
                                    { name: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/...' },
                                    { name: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/...' },
                                ].map((field) => (
                                    <div key={field.name}>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">{field.label}</label>
                                        <Input
                                            name={field.name}
                                            value={(formData as any)[field.name]}
                                            onChange={handleInputChange}
                                            placeholder={field.placeholder}
                                            className="bg-black/40"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Step 4: Team Members */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <p className="text-gray-400 text-sm">Add team members or band members (optional)</p>

                                {/* Added Members */}
                                {members.length > 0 && (
                                    <div className="space-y-2">
                                        {members.map((member, index) => (
                                            <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                                                <div>
                                                    <div className="font-medium text-white">{member.name}</div>
                                                    <div className="text-sm text-gray-400">{member.role}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeMember(index)}
                                                    className="text-red-400 hover:text-red-300"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add New Member */}
                                <div className="flex gap-3">
                                    <Input
                                        value={newMember.name}
                                        onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Name"
                                        className="bg-black/40 flex-1"
                                    />
                                    <Input
                                        value={newMember.role}
                                        onChange={(e) => setNewMember(prev => ({ ...prev, role: e.target.value }))}
                                        placeholder="Role"
                                        className="bg-black/40 flex-1"
                                    />
                                    <Button type="button" onClick={addMember} variant="ghost" className="px-4">
                                        Add
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
                            {currentStep > 1 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setCurrentStep(prev => prev - 1)}
                                >
                                    Back
                                </Button>
                            ) : (
                                <div />
                            )}

                            {currentStep < 4 ? (
                                <Button
                                    type="button"
                                    onClick={() => setCurrentStep(prev => prev + 1)}
                                    className="bg-cyan-500 hover:bg-cyan-600"
                                >
                                    Continue
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="bg-cyan-500 hover:bg-cyan-600"
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Brand'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
