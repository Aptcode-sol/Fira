'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Button, Input, OTPInput, PasswordStrengthIndicator } from '@/components/ui';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';

export default function SignUpPage() {
    const router = useRouter();
    const [step, setStep] = useState<'register' | 'verify'>('register');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [otp, setOtp] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [otpExpiry, setOtpExpiry] = useState(600); // 10 minutes in seconds

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        city: '',
    });

    // Major Indian cities for selection
    const cities = [
        'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
        'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
        'Chandigarh', 'Goa', 'Kochi', 'Indore', 'Nagpur'
    ];

    // Countdown timer for OTP expiry
    useEffect(() => {
        if (step === 'verify' && otpExpiry > 0) {
            const timer = setInterval(() => {
                setOtpExpiry((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [step, otpExpiry]);

    // Countdown timer for resend cooldown
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

        setIsLoading(true);

        try {
            const response = await authApi.register({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                city: formData.city,
            }) as { message?: string };

            // Move to OTP verification step
            setStep('verify');
            setOtpExpiry(600); // Reset to 10 minutes
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
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

            // Store token and user data
            localStorage.setItem('fira_token', response.token);
            localStorage.setItem('fira_user', JSON.stringify(response.user));

            // Redirect to dashboard
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed');
            setOtp(''); // Clear OTP on error
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
            setOtpExpiry(600); // Reset expiry to 10 minutes
            setOtp(''); // Clear current OTP
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resend code');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen flex items-center justify-center px-4 py-24">
                <div className="w-full max-w-md">
                    {step === 'register' ? (
                        <>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-bold text-white mb-2">Create account</h1>
                                <p className="text-gray-400">Join FIRA and start organizing amazing events</p>
                            </div>

                            {/* Form Card */}
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
                                        {/* Password Match Indicator */}
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

                                    {/* City Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">City</label>
                                        <div className="relative">
                                            <select
                                                value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                required
                                                className="w-full px-4 py-3 pl-11 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 appearance-none cursor-pointer"
                                            >
                                                <option value="" className="bg-[#1a1a1a]">Select your city</option>
                                                {cities.map((city) => (
                                                    <option key={city} value={city} className="bg-[#1a1a1a]">{city}</option>
                                                ))}
                                            </select>
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                        <p className="mt-1.5 text-xs text-gray-500">We'll show you events and venues near you</p>
                                    </div>


                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="lg"
                                        className="w-full"
                                        isLoading={isLoading}
                                    >
                                        Create Account
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
                                    <Link href="/signin" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
                                        Sign In
                                    </Link>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* OTP Verification Step */}
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

                                    {/* Expiry Timer */}
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

                                    {/* Resend OTP */}
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
