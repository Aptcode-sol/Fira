'use client';

import { useState, useEffect } from 'react';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { usersApi } from '@/lib/api';

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;

interface BankDetails {
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
}

interface BankDetailsFormProps {
    /** Existing bank details from user profile (null if not set) */
    existingDetails: BankDetails | null;
    /** Whether creator has pending/processing payouts without bank details */
    hasPendingPayouts?: boolean;
    /** Callback after successful save */
    onSaved?: (details: BankDetails) => void;
}

interface FormErrors {
    accountName?: string;
    accountNumber?: string;
    confirmAccountNumber?: string;
    ifscCode?: string;
    bankName?: string;
}

export default function BankDetailsForm({ existingDetails, hasPendingPayouts, onSaved }: BankDetailsFormProps) {
    const { showToast } = useToast();
    const [isEditing, setIsEditing] = useState(!existingDetails);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [formData, setFormData] = useState({
        accountName: '',
        accountNumber: '',
        confirmAccountNumber: '',
        ifscCode: '',
        bankName: '',
    });

    useEffect(() => {
        if (existingDetails) {
            setFormData({
                accountName: existingDetails.accountName || '',
                accountNumber: '', // Don't prefill account number for security
                confirmAccountNumber: '',
                ifscCode: existingDetails.ifscCode || '',
                bankName: existingDetails.bankName || '',
            });
        }
    }, [existingDetails]);

    const maskAccountNumber = (num: string) => {
        if (!num || num.length < 4) return '••••';
        return '••••••' + num.slice(-4);
    };

    const validate = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.accountName.trim()) {
            newErrors.accountName = 'Account holder name is required';
        } else if (formData.accountName.trim().length > 120) {
            newErrors.accountName = 'Account holder name must be 120 characters or less';
        }

        if (!formData.accountNumber) {
            newErrors.accountNumber = 'Account number is required';
        } else if (!ACCOUNT_NUMBER_REGEX.test(formData.accountNumber)) {
            newErrors.accountNumber = 'Account number must be 9-18 digits';
        }

        if (formData.accountNumber !== formData.confirmAccountNumber) {
            newErrors.confirmAccountNumber = 'Account numbers do not match';
        }

        if (!formData.ifscCode) {
            newErrors.ifscCode = 'IFSC code is required';
        } else if (!IFSC_REGEX.test(formData.ifscCode.toUpperCase())) {
            newErrors.ifscCode = 'Invalid IFSC format (e.g. SBIN0001234)';
        }

        if (!formData.bankName.trim()) {
            newErrors.bankName = 'Bank name is required';
        } else if (formData.bankName.trim().length > 100) {
            newErrors.bankName = 'Bank name must be 100 characters or less';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Force IFSC to uppercase
        const finalValue = name === 'ifscCode' ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
        // Clear field error on change
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSave = async () => {
        if (!validate()) return;

        setIsSaving(true);
        try {
            const payload = {
                accountName: formData.accountName.trim(),
                accountNumber: formData.accountNumber,
                ifscCode: formData.ifscCode.toUpperCase(),
                bankName: formData.bankName.trim(),
            };
            await usersApi.updateBankDetails(payload);
            showToast('Bank details saved successfully', 'success');
            setIsEditing(false);
            onSaved?.(payload);
        } catch (error: any) {
            const msg = error?.message || 'Failed to save bank details';
            showToast(msg, 'error');
            // Show field-specific error from server if available
            if (error?.field) {
                setErrors(prev => ({ ...prev, [error.field]: msg }));
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = () => {
        setFormData(prev => ({
            ...prev,
            accountNumber: '',
            confirmAccountNumber: '',
        }));
        setErrors({});
        setIsEditing(true);
    };

    return (
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Bank Details
            </h2>
            <p className="text-sm text-gray-400 mb-6">Required for receiving event revenue payouts</p>

            {/* Payout prompt */}
            {hasPendingPayouts && !existingDetails && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <p className="text-amber-200 font-medium text-sm">Bank details required for payouts</p>
                            <p className="text-amber-300/70 text-xs mt-1">You have pending or processing payouts. Please fill in your bank details to receive payments.</p>
                        </div>
                    </div>
                </div>
            )}

            {isEditing ? (
                <div className="space-y-4">
                    {/* Account Holder Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Account Holder Name</label>
                        <Input
                            name="accountName"
                            value={formData.accountName}
                            onChange={handleChange}
                            placeholder="Full name as per bank records"
                            maxLength={120}
                            className="bg-black/40"
                        />
                        {errors.accountName && <p className="text-red-400 text-xs mt-1">{errors.accountName}</p>}
                    </div>

                    {/* Account Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Account Number</label>
                        <Input
                            name="accountNumber"
                            value={formData.accountNumber}
                            onChange={handleChange}
                            placeholder="9-18 digit account number"
                            maxLength={18}
                            className="bg-black/40"
                        />
                        {errors.accountNumber && <p className="text-red-400 text-xs mt-1">{errors.accountNumber}</p>}
                    </div>

                    {/* Confirm Account Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Account Number</label>
                        <Input
                            name="confirmAccountNumber"
                            value={formData.confirmAccountNumber}
                            onChange={handleChange}
                            placeholder="Re-enter account number"
                            maxLength={18}
                            className="bg-black/40"
                        />
                        {errors.confirmAccountNumber && <p className="text-red-400 text-xs mt-1">{errors.confirmAccountNumber}</p>}
                    </div>

                    {/* IFSC Code */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">IFSC Code</label>
                        <Input
                            name="ifscCode"
                            value={formData.ifscCode}
                            onChange={handleChange}
                            placeholder="e.g. SBIN0001234"
                            maxLength={11}
                            className="bg-black/40"
                        />
                        {errors.ifscCode && <p className="text-red-400 text-xs mt-1">{errors.ifscCode}</p>}
                    </div>

                    {/* Bank Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Bank Name</label>
                        <Input
                            name="bankName"
                            value={formData.bankName}
                            onChange={handleChange}
                            placeholder="e.g. State Bank of India"
                            maxLength={100}
                            className="bg-black/40"
                        />
                        {errors.bankName && <p className="text-red-400 text-xs mt-1">{errors.bankName}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Bank Details'}
                        </Button>
                        {existingDetails && (
                            <Button variant="ghost" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                /* Saved view — masked account number */
                <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                        <span className="text-sm text-gray-400">Account Holder</span>
                        <span className="text-sm text-white">{existingDetails?.accountName}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                        <span className="text-sm text-gray-400">Account Number</span>
                        <span className="text-sm text-white font-mono">{maskAccountNumber(existingDetails?.accountNumber || '')}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/[0.05]">
                        <span className="text-sm text-gray-400">IFSC Code</span>
                        <span className="text-sm text-white font-mono">{existingDetails?.ifscCode}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-400">Bank Name</span>
                        <span className="text-sm text-white">{existingDetails?.bankName}</span>
                    </div>
                    <div className="pt-3">
                        <Button variant="secondary" onClick={handleEdit}>
                            Edit Bank Details
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
