'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Modal, PasswordStrengthIndicator } from '@/components/ui';
import { FadeIn, SlideUp } from '@/components/animations';
import { useToast } from '@/components/ui/Toast';
import { usersApi, authApi } from '@/lib/api';
import { isVenueOwner } from '@/lib/types';
import BankDetailsForm from '@/components/dashboard/BankDetailsForm';

type BankDetails = { accountName: string; accountNumber: string; ifscCode: string; bankName: string };

export default function SettingsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
    });

    // 16.3/17.3: Change Password lives inline as an expandable settings section
    // (desktop-suitable) instead of routing to a flushed-left standalone page.
    const [pwOpen, setPwOpen] = useState(false);
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
    const [pwSaving, setPwSaving] = useState(false);
    const [pwError, setPwError] = useState('');
    const pwMismatch = pwForm.confirm.length > 0 && pwForm.next !== pwForm.confirm;
    const canChangePassword =
        pwForm.current.length > 0 && pwForm.next.length > 0 && pwForm.next === pwForm.confirm && !pwSaving;

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError('');
        if (pwForm.next !== pwForm.confirm) {
            setPwError('New passwords do not match.');
            return;
        }
        setPwSaving(true);
        try {
            await authApi.changePassword({ currentPassword: pwForm.current, newPassword: pwForm.next });
            showToast('Password changed successfully', 'success');
            setPwForm({ current: '', next: '', confirm: '' });
            setPwOpen(false);
        } catch (err) {
            setPwError(err instanceof Error ? err.message : 'Could not change your password.');
        } finally {
            setPwSaving(false);
        }
    };

    // 16.4/17.4: Delete Account — in-app confirmation modal → DELETE /api/users/me.
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            await usersApi.deleteAccount();
            showToast('Your account has been deleted', 'success');
            // Clear session and leave the app, mirroring the logout flow.
            localStorage.removeItem('fira_token');
            localStorage.removeItem('fira_user');
            router.push('/');
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to delete account', 'error');
            setIsDeleting(false);
        }
    };

    // Bank details (owners only) — the canonical place to view/edit payout
    // details. Prefilled from User.bankDetails; edits re-save via the form.
    const owner = isVenueOwner(user);
    const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
    useEffect(() => {
        if (!owner || !user?._id) return;
        let cancelled = false;
        usersApi.getProfile(user._id)
            .then((profile: any) => {
                if (!cancelled && profile?.bankDetails?.accountName) {
                    setBankDetails(profile.bankDetails);
                }
            })
            .catch(() => { /* no saved details yet */ });
        return () => { cancelled = true; };
    }, [owner, user?._id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleUpdateProfile = async () => {
        if (!user?._id) return;
        setIsUpdating(true);
        try {
            await usersApi.updateProfile(user._id, formData);
            showToast('Profile updated successfully', 'success');
        } catch (error) {
            console.error('Failed to update profile:', error);
            showToast('Failed to update profile', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="p-4 md:p-8 max-w-4xl mx-auto">
                <SlideUp>
                    <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                    <p className="text-gray-300 mb-8">Manage your account settings and preferences</p>
                </SlideUp>

                {/* Profile Settings */}
                <FadeIn delay={0.1}>
                    <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Profile Information
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                                <Input
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Your name"
                                    className="bg-black/40"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                                <Input
                                    value={user?.email || ''}
                                    disabled
                                    className="bg-black/40 opacity-50 cursor-not-allowed"
                                />
                                <p className="text-xs text-gray-300 mt-1">Email cannot be changed</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                                <Input
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    placeholder="Your phone number"
                                    className="bg-black/40"
                                />
                            </div>
                            <Button
                                onClick={handleUpdateProfile}
                                disabled={isUpdating}
                                className="!bg-violet-500 hover:!bg-violet-600 text-white mt-4"
                            >
                                {isUpdating ? 'Updating...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </FadeIn>

                {/* Bank Details — owners only (payout settlement) */}
                {owner && (
                    <FadeIn delay={0.15}>
                        <div className="mb-6">
                            <BankDetailsForm
                                existingDetails={bankDetails}
                                onSaved={(details) => setBankDetails(details)}
                            />
                        </div>
                    </FadeIn>
                )}

                {/* Account Settings */}
                <FadeIn delay={0.2}>
                    <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Account & Security
                        </h2>

                        <div className="space-y-4">
                            {/* 16.3/17.3: Expandable Change Password section. The header
                                toggles an inline panel; on desktop the fields sit in a
                                two-column grid so they are not flushed left. */}
                            <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setPwOpen((v) => !v)}
                                    aria-expanded={pwOpen}
                                    className="w-full flex items-center justify-between p-4 hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                        <span className="text-white">Change Password</span>
                                    </div>
                                    <svg
                                        className={`w-5 h-5 text-gray-300 transition-transform ${pwOpen ? 'rotate-90' : ''}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>

                                {pwOpen && (
                                    <form onSubmit={handleChangePassword} className="p-4 pt-0 space-y-4">
                                        {pwError && (
                                            <div className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                                                {pwError}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
                                                <Input
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={pwForm.current}
                                                    onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                                                    autoComplete="current-password"
                                                    className="bg-black/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                                                <Input
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={pwForm.next}
                                                    onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                                                    autoComplete="new-password"
                                                    className="bg-black/40"
                                                />
                                                <PasswordStrengthIndicator password={pwForm.next} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                                                <Input
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={pwForm.confirm}
                                                    onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                                                    autoComplete="new-password"
                                                    className="bg-black/40"
                                                />
                                                {pwMismatch && (
                                                    <p className="mt-2 text-xs text-red-400">Passwords do not match</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Button
                                                type="submit"
                                                className="!bg-violet-500 hover:!bg-violet-600 text-white"
                                                isLoading={pwSaving}
                                                disabled={!canChangePassword}
                                            >
                                                Update Password
                                            </Button>
                                            <Link href="/forgot-password" className="text-sm text-violet-400 hover:text-violet-300">
                                                Forgotten your current password?
                                            </Link>
                                        </div>
                                    </form>
                                )}
                            </div>

                            {/* NOTIFICATION PREFERENCES REMOVED - the page it
                                linked to (/dashboard/settings/notifications) was
                                never built, so this always 404'd. Push on/off
                                now lives on the Notifications page itself. */}
                        </div>
                    </div>
                </FadeIn>

                {/* Legal & Policies */}
                <FadeIn delay={0.3}>
                    <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Legal & Policies
                        </h2>

                        <div className="space-y-4">
                            <Link
                                href="/terms"
                                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="text-white">Terms & Conditions</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </Link>

                            <Link
                                href="/privacy"
                                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    <span className="text-white">Privacy Policy</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </Link>

                            <Link
                                href="/help"
                                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-white">Help & Support</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </Link>
                        </div>
                    </div>
                </FadeIn>

                {/* Danger Zone */}
                <FadeIn delay={0.4}>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                        <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Danger Zone
                        </h2>
                        <p className="text-gray-300 text-sm mb-4">
                            Once you delete your account, there is no going back. Please be certain.
                        </p>
                        <Button
                            variant="ghost"
                            onClick={() => { setDeleteConfirm(''); setShowDeleteModal(true); }}
                            className="border border-red-500/50 text-red-400 hover:bg-red-500/20"
                        >
                            Delete Account
                        </Button>
                    </div>
                </FadeIn>

                {/* 16.4/17.4: In-app confirmation modal (shared <Modal>) → DELETE /api/users/me.
                    Requires typing DELETE to guard against accidental clicks. */}
                <Modal
                    isOpen={showDeleteModal}
                    onClose={() => { if (!isDeleting) setShowDeleteModal(false); }}
                    title="Delete Account"
                    size="md"
                >
                    <div className="space-y-4">
                        <p className="text-gray-300 text-sm">
                            This permanently deletes your account and its associated data. This action
                            cannot be undone. Type <span className="font-semibold text-red-400">DELETE</span> to confirm.
                        </p>
                        <Input
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder="DELETE"
                            className="bg-black/40"
                            autoComplete="off"
                        />
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="ghost"
                                onClick={handleDeleteAccount}
                                isLoading={isDeleting}
                                disabled={deleteConfirm !== 'DELETE' || isDeleting}
                                className="border border-red-500/50 text-red-400 hover:bg-red-500/20 justify-center"
                            >
                                Delete My Account
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                className="justify-center"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </DashboardLayout>
    );
}
