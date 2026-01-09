'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/components/ui';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { authApi } from '@/lib/api';

// Inner component that uses useSearchParams
function SignInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/dashboard';
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showResendVerification, setShowResendVerification] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setShowResendVerification(false);
        setResendSuccess(false);
        setIsLoading(true);

        try {
            await login(formData.email, formData.password);
            // Redirect to the original page they were trying to access, or dashboard
            router.push(redirectTo);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Login failed';

            // Check if error is due to unverified email
            if (errorMessage === 'EMAIL_NOT_VERIFIED') {
                setError('Your email is not verified. Please check your inbox for the verification code.');
                setShowResendVerification(true);
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setResendLoading(true);
        setError('');
        setResendSuccess(false);

        try {
            await authApi.resendOTP({ email: formData.email });
            setResendSuccess(true);
            setError('');

            // Redirect to signup page for OTP verification
            setTimeout(() => {
                router.push('/signup?email=' + encodeURIComponent(formData.email) + '&verify=true');
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resend verification email');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen flex items-center justify-center px-4 pt-20">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
                        <p className="text-gray-400">Sign in to your FIRA account</p>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8">
                        {error && (
                            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {resendSuccess && (
                            <div className="mb-6 px-4 py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm">
                                Verification code sent! Redirecting to verification page...
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
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
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-white/[0.1] bg-white/[0.05] text-violet-500 focus:ring-violet-500/50 focus:ring-offset-0"
                                    />
                                    <span className="text-gray-400">Remember me</span>
                                </label>
                                <Link href="/forgot-password" className="text-violet-400 hover:text-violet-300 transition-colors">
                                    Forgot password?
                                </Link>
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                className="w-full"
                                isLoading={isLoading}
                            >
                                Sign In
                            </Button>

                            {/* Resend Verification Button */}
                            {showResendVerification && (
                                <div className="pt-4 border-t border-white/[0.05]">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="lg"
                                        className="w-full"
                                        onClick={handleResendVerification}
                                        isLoading={resendLoading}
                                    >
                                        Resend Verification Email
                                    </Button>
                                </div>
                            )}
                        </form>

                        <div className="mt-6 text-center text-sm text-gray-400">
                            Don&apos;t have an account?{' '}
                            <Link href="/signup" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
                                Sign Up
                            </Link>
                        </div>
                    </div>


                </div>
            </main>
        </>
    );
}

// Wrapper with Suspense for useSearchParams
export default function SignInPage() {
    return (
        <Suspense fallback={
            <>
                <PartyBackground />
                <Navbar />
                <main className="relative z-20 min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </main>
            </>
        }>
            <SignInContent />
        </Suspense>
    );
}
