'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Button, Input, OTPInput, PasswordStrengthIndicator, Select } from '@/components/ui';
import VenuePortalLandingNavbar from '@/components/venue-portal/VenuePortalLandingNavbar';
import PartyBackground from '@/components/PartyBackground';
import { uploadApi } from '@/lib/api';

export default function VenueOwnerSignUpPage() {
    const router = useRouter();
    const [step, setStep] = useState<'register' | 'verify'>('register');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [otp, setOtp] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [otpExpiry, setOtpExpiry] = useState(600);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        businessName: '',
        businessPhone: '',
        govIdType: '',
        govIdNumber: '',
        bankAccountName: '',
        bankAccountNumber: '',
        bankIfscCode: '',
        bankName: '',
    });
    const [govIdFile, setGovIdFile] = useState<File | null>(null);
    const [govIdPreview, setGovIdPreview] = useState('');
    const [uploadingId, setUploadingId] = useState(false);

    useEffect(() => {
        if (step === 'verify' && otpExpiry > 0) {
            const timer = setInterval(() => {
                setOtpExpiry((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [step, otpExpiry]);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setInterval(() => {
                setResendCooldown((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [resendCooldown]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Validate required gov ID fields for venue owners
        if (!formData.govIdType || !formData.govIdNumber) {
            setError('Government ID type and number are required');
            return;
        }

        setIsLoading(true);

        try {
            // Upload gov ID document if provided
            let govIdDocumentUrl = '';
            if (govIdFile) {
                setUploadingId(true);
                const uploadResult = await uploadApi.single(govIdFile, 'documents');
                govIdDocumentUrl = uploadResult.url;
                setUploadingId(false);
            }

            await authApi.registerVenueOwner({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                businessName: formData.businessName,
                businessPhone: formData.businessPhone,
                govIdType: formData.govIdType,
                govIdNumber: formData.govIdNumber,
                govIdDocument: govIdDocumentUrl,
                bankAccountName: formData.bankAccountName,
                bankAccountNumber: formData.bankAccountNumber,
                bankIfscCode: formData.bankIfscCode,
                bankName: formData.bankName,
            });

            setStep('verify');
            setOtpExpiry(600);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
            setUploadingId(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (otp.length !== 4) {
            setError('Please enter the 4-digit verification code');
            return;
        }

        setIsLoading(true);

        try {
            const response = await authApi.verifyOTP({
                email: formData.email,
                code: otp,
            });

            localStorage.setItem('fira_token', response.token);
            localStorage.setItem('fira_user', JSON.stringify(response.user));

            router.push('/venue-portal/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed');
            setOtp('');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (resendCooldown > 0) return;
        setError('');
        setIsLoading(true);

        try {
            const response = await authApi.resendOTP({ email: formData.email });
            setResendCooldown(response.cooldownSeconds);
            setOtpExpiry(600);
            setOtp('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resend code');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <PartyBackground />
            <VenuePortalLandingNavbar />

            <main className="relative z-20 min-h-screen flex items-center justify-center px-4 py-24">
                <div className="w-full max-w-md">
                    {step === 'register' ? (
                        <>
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-500/20 text-white text-sm mb-4">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                    </svg>
                                    Venue Owner Account
                                </div>
                                <h1 className="text-3xl font-bold text-white mb-2">List Your Venue</h1>
                                <p className="text-gray-400">Create a venue owner account to list and manage your venues on FIRA</p>
                            </div>

                            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8">
                                {error && (
                                    <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleRegister} className="space-y-5">
                                    <Input
                                        label="Full Name"
                                        type="text"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        leftIcon={
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        }
                                    />

                                    <Input
                                        label="Business Name (Optional)"
                                        type="text"
                                        placeholder="Your Venue Name"
                                        value={formData.businessName}
                                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                        leftIcon={
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                            </svg>
                                        }
                                    />

                                    <Input
                                        label="Email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                        leftIcon={
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                            </svg>
                                        }
                                    />

                                    <Input
                                        label="Business Phone (Optional)"
                                        type="tel"
                                        placeholder="+91 98765 43210"
                                        value={formData.businessPhone}
                                        onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                                        leftIcon={
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                        }
                                    />

                                    {/* Government ID Section */}
                                    <div className="pt-4 border-t border-white/10">
                                        <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                            </svg>
                                            Government ID Verification *
                                        </h3>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    ID Type *
                                                </label>
                                                <Select
                                                    value={formData.govIdType}
                                                    onChange={(val) => setFormData({ ...formData, govIdType: val })}
                                                    options={[
                                                        { value: 'aadhar', label: 'Aadhar Card' },
                                                        { value: 'pan', label: 'PAN Card' },
                                                        { value: 'driving_license', label: 'Driving License' },
                                                        { value: 'passport', label: 'Passport' },
                                                        { value: 'voter_id', label: 'Voter ID' },
                                                    ]}
                                                    placeholder="Select ID type"
                                                />
                                            </div>

                                            <Input
                                                label="ID Number"
                                                type="text"
                                                placeholder="Enter your ID number"
                                                value={formData.govIdNumber}
                                                onChange={(e) => setFormData({ ...formData, govIdNumber: e.target.value })}
                                                required
                                                leftIcon={
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                    </svg>
                                                }
                                            />

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Upload ID Document (Optional)
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                if (file.size > 5 * 1024 * 1024) {
                                                                    setError('File size must be less than 5MB');
                                                                    return;
                                                                }
                                                                setGovIdFile(file);
                                                                if (file.type.startsWith('image/')) {
                                                                    setGovIdPreview(URL.createObjectURL(file));
                                                                } else {
                                                                    setGovIdPreview(file.name);
                                                                }
                                                            }
                                                        }}
                                                        className="hidden"
                                                        id="govIdUpload"
                                                    />
                                                    <label
                                                        htmlFor="govIdUpload"
                                                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors"
                                                    >
                                                        {govIdPreview ? (
                                                            <span className="text-green-400 text-sm truncate">{govIdFile?.name || 'File selected'}</span>
                                                        ) : (
                                                            <>
                                                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                                </svg>
                                                                <span className="text-gray-400 text-sm">Click to upload ID document</span>
                                                            </>
                                                        )}
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bank Details Section */}
                                    <div className="pt-4 border-t border-white/10">
                                        <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                            </svg>
                                            Bank Details (for payouts)
                                        </h3>

                                        <div className="space-y-4">
                                            <Input
                                                label="Account Holder Name"
                                                type="text"
                                                placeholder="Name as on bank account"
                                                value={formData.bankAccountName}
                                                onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                                                leftIcon={
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                }
                                            />

                                            <Input
                                                label="Account Number"
                                                type="text"
                                                placeholder="Enter account number"
                                                value={formData.bankAccountNumber}
                                                onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                                                leftIcon={
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                    </svg>
                                                }
                                            />

                                            <Input
                                                label="IFSC Code"
                                                type="text"
                                                placeholder="e.g., SBIN0001234"
                                                value={formData.bankIfscCode}
                                                onChange={(e) => setFormData({ ...formData, bankIfscCode: e.target.value.toUpperCase() })}
                                                leftIcon={
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                }
                                            />

                                            <Input
                                                label="Bank Name"
                                                type="text"
                                                placeholder="e.g., State Bank of India"
                                                value={formData.bankName}
                                                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                                leftIcon={
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                                                    </svg>
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <Input
                                            label="Password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            leftIcon={
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            }
                                            rightIcon={
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="text-gray-400 hover:text-white transition-colors"
                                                >
                                                    {showPassword ? (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            }
                                        />
                                        <PasswordStrengthIndicator password={formData.password} />
                                    </div>

                                    <div className="relative">
                                        <Input
                                            label="Confirm Password"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            required
                                            leftIcon={
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            }
                                            rightIcon={
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="text-gray-400 hover:text-white transition-colors"
                                                >
                                                    {showConfirmPassword ? (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            }
                                        />
                                        {formData.confirmPassword && (
                                            <div className="mt-2 flex items-center gap-2 text-xs text-white">
                                                <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${formData.password === formData.confirmPassword
                                                    ? 'bg-white/20 border border-white/50'
                                                    : 'bg-white/5 border border-white/20'
                                                    }`}>
                                                    {formData.password === formData.confirmPassword && (
                                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className={formData.password === formData.confirmPassword ? 'text-white' : 'text-white/50'}>
                                                    {formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="lg"
                                        className="w-full"
                                        isLoading={isLoading}
                                    >
                                        Create Venue Owner Account
                                    </Button>
                                </form>

                                <p className="mt-6 text-center text-sm text-gray-500">
                                    By creating an account, you agree to our{' '}
                                    <Link href="/terms" className="text-violet-400 hover:text-violet-300">
                                        Terms
                                    </Link>{' '}
                                    and{' '}
                                    <Link href="/privacy" className="text-violet-400 hover:text-violet-300">
                                        Privacy Policy
                                    </Link>
                                </p>

                                <div className="mt-6 text-center text-sm text-gray-400">
                                    Already have an account?{' '}
                                    <Link href="/venue-portal/signin" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
                                        Sign In
                                    </Link>
                                </div>

                                <div className="mt-4 text-center text-sm text-gray-500">
                                    Looking to attend events?{' '}
                                    <Link href="/signup" className="text-violet-400 hover:text-violet-300 transition-colors">
                                        Create a regular account
                                    </Link>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-bold text-white mb-2">Verify your email</h1>
                                <p className="text-gray-400">
                                    We've sent a 4-digit code to<br />
                                    <span className="text-white font-medium">{formData.email}</span>
                                </p>
                            </div>

                            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8">
                                {error && (
                                    <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleVerifyOTP} className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-4 text-center">
                                            Enter verification code
                                        </label>
                                        <OTPInput
                                            length={4}
                                            value={otp}
                                            onChange={setOtp}
                                            disabled={isLoading}
                                            error={!!error}
                                        />
                                    </div>

                                    <div className="text-center">
                                        {otpExpiry > 0 ? (
                                            <p className="text-sm text-gray-400">
                                                Code expires in{' '}
                                                <span className="text-violet-400 font-medium">
                                                    {formatTime(otpExpiry)}
                                                </span>
                                            </p>
                                        ) : (
                                            <p className="text-sm text-red-400">
                                                Code has expired. Please request a new one.
                                            </p>
                                        )}
                                    </div>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="lg"
                                        className="w-full"
                                        isLoading={isLoading}
                                        disabled={otp.length !== 4 || otpExpiry === 0}
                                    >
                                        Verify Email
                                    </Button>

                                    <div className="text-center">
                                        <button
                                            type="button"
                                            onClick={handleResendOTP}
                                            disabled={resendCooldown > 0 || isLoading}
                                            className="text-sm text-violet-400 hover:text-violet-300 transition-colors disabled:text-gray-500 disabled:cursor-not-allowed"
                                        >
                                            {resendCooldown > 0
                                                ? `Resend code in ${resendCooldown}s`
                                                : 'Resend verification code'}
                                        </button>
                                    </div>

                                    <div className="text-center pt-4 border-t border-white/[0.05]">
                                        <button
                                            type="button"
                                            onClick={() => setStep('register')}
                                            className="text-sm text-gray-400 hover:text-white transition-colors"
                                        >
                                            ← Change email address
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
