'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button, Input, PasswordStrengthIndicator } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { authApi } from '@/lib/api';
import { SlideUp } from '@/components/animations';

/**
 * Change password for a signed-in user.
 *
 * The settings page has linked here for a while but the page never existed, so
 * "Change Password" 404'd. The matching POST /api/auth/change-password endpoint
 * was missing too and was added alongside this.
 */
export default function ChangePasswordPage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [form, setForm] = useState({ current: '', next: '', confirm: '' });
    const [show, setShow] = useState({ current: false, next: false, confirm: false });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const mismatch = form.confirm.length > 0 && form.next !== form.confirm;
    const canSubmit =
        form.current.length > 0 && form.next.length > 0 && form.next === form.confirm && !isSaving;

    const eye = (visible: boolean) => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {visible ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            ) : (
                <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </>
            )}
        </svg>
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (form.next !== form.confirm) {
            setError('New passwords do not match.');
            return;
        }

        setIsSaving(true);
        try {
            await authApi.changePassword({
                currentPassword: form.current,
                newPassword: form.next,
            });
            showToast('Password changed successfully', 'success');
            setForm({ current: '', next: '', confirm: '' });
            router.push('/dashboard/settings');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not change your password.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 max-w-xl">
                <SlideUp>
                    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-300">
                        <Link href="/dashboard/settings" className="hover:text-white transition-colors">
                            ← Settings
                        </Link>
                    </nav>

                    <h1 className="text-3xl font-bold text-white mb-2">Change Password</h1>
                    <p className="text-gray-300 mb-8">
                        You&apos;ll stay signed in on this device. We&apos;ll email you a confirmation.
                    </p>
                </SlideUp>

                <form
                    onSubmit={handleSubmit}
                    className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 space-y-5"
                >
                    {error && (
                        <div className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <Input
                        label="Current Password"
                        type={show.current ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={form.current}
                        onChange={(e) => setForm({ ...form, current: e.target.value })}
                        required
                        autoComplete="current-password"
                        rightIcon={
                            <button
                                type="button"
                                onClick={() => setShow({ ...show, current: !show.current })}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                {eye(show.current)}
                            </button>
                        }
                    />

                    <div>
                        <Input
                            label="New Password"
                            type={show.next ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={form.next}
                            onChange={(e) => setForm({ ...form, next: e.target.value })}
                            required
                            autoComplete="new-password"
                            rightIcon={
                                <button
                                    type="button"
                                    onClick={() => setShow({ ...show, next: !show.next })}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    {eye(show.next)}
                                </button>
                            }
                        />
                        <PasswordStrengthIndicator password={form.next} />
                    </div>

                    <div>
                        <Input
                            label="Confirm New Password"
                            type={show.confirm ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={form.confirm}
                            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                            required
                            autoComplete="new-password"
                            rightIcon={
                                <button
                                    type="button"
                                    onClick={() => setShow({ ...show, confirm: !show.confirm })}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    {eye(show.confirm)}
                                </button>
                            }
                        />
                        {mismatch && (
                            <p className="mt-2 text-xs text-red-400">Passwords do not match</p>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full sm:w-auto justify-center"
                            isLoading={isSaving}
                            disabled={!canSubmit}
                        >
                            Update Password
                        </Button>
                        <Link href="/dashboard/settings" className="w-full sm:w-auto">
                            <Button type="button" variant="ghost" className="w-full justify-center">
                                Cancel
                            </Button>
                        </Link>
                    </div>

                    <p className="text-xs text-gray-300 pt-2 border-t border-white/[0.05]">
                        Forgotten your current password?{' '}
                        <Link href="/forgot-password" className="text-violet-400 hover:text-violet-300">
                            Reset it by email
                        </Link>{' '}
                        instead.
                    </p>
                </form>
            </div>
        </DashboardLayout>
    );
}
