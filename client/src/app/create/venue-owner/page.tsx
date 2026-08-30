'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Input, Select } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { authApi, uploadApi } from '@/lib/api';
import { isVenueOwner, User } from '@/lib/types';

const govIdTypes = [
    { value: 'aadhar', label: 'Aadhaar' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'driving_license', label: 'Driving License' },
    { value: 'passport', label: 'Passport' },
    { value: 'voter_id', label: 'Voter ID' },
];

const steps = [
    { num: 1, title: 'Business' },
    { num: 2, title: 'Identity' },
    { num: 3, title: 'Payouts' },
];

export default function BecomeVenueOwnerPage() {
    const router = useRouter();
    const { user, isLoading, setSession } = useAuth();
    const { showToast } = useToast();

    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        businessName: '',
        businessPhone: '',
        govIdType: 'aadhar',
        govIdNumber: '',
        bankAccountName: '',
        bankAccountNumber: '',
        bankIfscCode: '',
        bankName: '',
    });

    const [govIdDoc, setGovIdDoc] = useState<File | null>(null);
    const [govIdDocName, setGovIdDocName] = useState('');

    // Scroll to top on each step, matching the creator apply flow.
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep]);

    // Must be signed in to upgrade an account. Send them through the unified
    // sign-in and return here afterwards.
    useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/signin?redirect=/create/venue-owner');
        }
    }, [user, isLoading, router]);

    if (isLoading || !user) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500" />
            </div>
        );
    }

    // Already a venue owner - this is an upgrade, not a re-application. Send them
    // to their workspace rather than showing the form again.
    if (isVenueOwner(user)) {
        return (
            <>
                <PartyBackground />
                <Navbar />
                <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12 text-center">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
                                <svg className="w-10 h-10 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                You&apos;re a <span className="text-violet-400">Venue Owner</span>!
                            </h1>
                            <p className="text-gray-300 text-lg mb-8 max-w-md mx-auto">
                                Your account already has venue owner access. Manage your venues and bookings from your dashboard.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button
                                    onClick={() => router.push('/venue-portal/dashboard')}
                                    className="bg-white text-black hover:bg-gray-200 font-bold px-8"
                                >
                                    Go to Venue Dashboard
                                </Button>
                                <Button variant="secondary" onClick={() => router.push('/dashboard')}>
                                    Back to FIRA
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </>
        );
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            showToast('Document exceeds 5MB limit', 'error');
            return;
        }
        setGovIdDoc(file);
        setGovIdDocName(file.name);
    };

    const validateStep = (step: number): string | null => {
        if (step === 1) {
            if (!formData.businessName.trim()) return 'Business name is required';
            if (!formData.businessPhone.trim()) return 'Business phone is required';
        }
        return null;
    };

    const goNext = () => {
        const stepError = validateStep(currentStep);
        if (stepError) {
            setError(stepError);
            showToast(stepError, 'error');
            return;
        }
        setError('');
        setCurrentStep(s => Math.min(s + 1, steps.length));
    };

    const handleSubmit = async () => {
        // Business step is the only hard requirement server-side; enforce it here
        // too so a user who jumped steps still gets a clear message.
        const stepError = validateStep(1);
        if (stepError) {
            setError(stepError);
            showToast(stepError, 'error');
            setCurrentStep(1);
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            let govIdDocument = '';
            if (govIdDoc) {
                const result = await uploadApi.single(govIdDoc, 'gov-ids');
                govIdDocument = result.url;
            }

            const response = await authApi.becomeVenueOwner({
                businessName: formData.businessName,
                businessPhone: formData.businessPhone,
                govIdType: formData.govIdType || undefined,
                govIdNumber: formData.govIdNumber || undefined,
                govIdDocument: govIdDocument || undefined,
                bankAccountName: formData.bankAccountName || undefined,
                bankAccountNumber: formData.bankAccountNumber || undefined,
                bankIfscCode: formData.bankIfscCode || undefined,
                bankName: formData.bankName || undefined,
            });

            // Merge the returned role fields onto the existing user so nothing
            // else on the account (avatar, city, etc.) is dropped, and refresh
            // the session token. This makes isVenueOwner(user) true immediately.
            const updated = { ...user, ...(response.user as Partial<User>) } as User;
            setSession(updated, response.token);

            showToast(response.message || 'Welcome aboard!', 'success');
            router.push('/venue-portal/dashboard');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to complete registration';
            setError(message);
            showToast(message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                            Become a <span className="text-violet-400">Venue Owner</span>
                        </h1>
                        <p className="text-gray-300">List your space and take bookings from event organisers across India</p>
                    </div>

                    {/* Steps */}
                    <div className="flex justify-center gap-2 mb-8">
                        {steps.map((step) => (
                            <button
                                key={step.num}
                                onClick={() => setCurrentStep(step.num)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${currentStep === step.num
                                    ? 'bg-violet-500 text-white'
                                    : currentStep > step.num
                                        ? 'bg-violet-500/20 text-violet-400'
                                        : 'bg-white/5 text-gray-300'
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
                        {/* Step 1: Business */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Business / Venue Name *</label>
                                    <Input
                                        name="businessName"
                                        value={formData.businessName}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Skyline Banquets"
                                        className="bg-black/40"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Business Phone *</label>
                                    <Input
                                        name="businessPhone"
                                        value={formData.businessPhone}
                                        onChange={handleInputChange}
                                        placeholder="e.g., +91 98765 43210"
                                        className="bg-black/40"
                                    />
                                </div>
                                <p className="text-xs text-gray-300">
                                    This is how event organisers and the FIRA team reach your business. Identity and payout
                                    details on the next steps are optional now - you can complete them before your first payout.
                                </p>
                            </div>
                        )}

                        {/* Step 2: Identity */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <p className="text-gray-300 text-sm">Verify your identity to unlock payouts (optional now, required before your first payout).</p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">ID Type</label>
                                    <Select
                                        value={formData.govIdType}
                                        onChange={(val) => setFormData(prev => ({ ...prev, govIdType: val }))}
                                        options={govIdTypes}
                                        placeholder="Select ID type"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">ID Number</label>
                                    <Input
                                        name="govIdNumber"
                                        value={formData.govIdNumber}
                                        onChange={handleInputChange}
                                        placeholder="Enter your ID number"
                                        className="bg-black/40"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Upload Document</label>
                                    <div className="relative rounded-xl border border-dashed border-white/20 bg-black/40 px-4 py-6 text-center">
                                        {govIdDocName ? (
                                            <p className="text-sm text-violet-400 break-all">{govIdDocName}</p>
                                        ) : (
                                            <div className="flex flex-col items-center text-gray-300">
                                                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <span className="text-sm">Photo of your ID, up to 5MB</span>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleDocChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Payouts */}
                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <p className="text-gray-300 text-sm mb-2">Where should we send your booking payouts? (optional now)</p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Account Holder Name</label>
                                    <Input name="bankAccountName" value={formData.bankAccountName} onChange={handleInputChange} placeholder="Name on the account" className="bg-black/40" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Account Number</label>
                                    <Input name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleInputChange} placeholder="Bank account number" className="bg-black/40" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">IFSC Code</label>
                                    <Input name="bankIfscCode" value={formData.bankIfscCode} onChange={handleInputChange} placeholder="e.g., HDFC0001234" className="bg-black/40" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Bank Name</label>
                                    <Input name="bankName" value={formData.bankName} onChange={handleInputChange} placeholder="e.g., HDFC Bank" className="bg-black/40" />
                                </div>
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
                            <Button
                                variant="ghost"
                                onClick={() => setCurrentStep(s => Math.max(s - 1, 1))}
                                disabled={currentStep === 1 || isSubmitting}
                            >
                                Back
                            </Button>

                            {currentStep < steps.length ? (
                                <Button onClick={goNext} disabled={isSubmitting}>
                                    Continue
                                </Button>
                            ) : (
                                <Button onClick={handleSubmit} isLoading={isSubmitting}>
                                    Become a Venue Owner
                                </Button>
                            )}
                        </div>
                    </div>

                    <p className="text-center text-xs text-gray-300 mt-6">
                        You keep your existing FIRA account - this just adds venue owner access.
                    </p>
                </div>
            </main>
        </>
    );
}
