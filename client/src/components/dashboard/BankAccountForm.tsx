'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import type { FieldErrors } from '@/lib/validation';
import { isClean } from '@/lib/validation';

/** Mirrors server/utils/bankDetailsValidator.js - keep the two in step. */
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;

export interface NewBankAccount {
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    makeDefault?: boolean;
}

interface BankAccountFormProps {
    onSubmit: (details: NewBankAccount) => Promise<{ ok: true } | { ok: false; error: string; field?: string }>;
    onCancel?: () => void;
    /** Offer the "make default" checkbox. Hidden when this is the first account. */
    showDefaultToggle?: boolean;
    submitLabel?: string;
}

/**
 * Add-a-payout-account form. Used both in Settings and inline in the creation
 * flows, so there is one set of rules and one set of messages.
 *
 * Every failure is a field-level message, never a toast: the whole point is to say
 * which box is wrong and why.
 */
export default function BankAccountForm({
    onSubmit,
    onCancel,
    showDefaultToggle = true,
    submitLabel = 'Save account',
}: BankAccountFormProps) {
    const [form, setForm] = useState({
        accountName: '',
        accountNumber: '',
        confirmAccountNumber: '',
        ifscCode: '',
        bankName: '',
        makeDefault: false,
    });
    const [errors, setErrors] = useState<FieldErrors>({});
    const [isSaving, setIsSaving] = useState(false);

    const set = (key: keyof typeof form, value: string | boolean) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const validate = (): FieldErrors => {
        const found: FieldErrors = {};

        if (!form.accountName.trim()) found.accountName = 'Account holder name is required';
        else if (form.accountName.trim().length > 120) found.accountName = 'Must be 120 characters or fewer';

        if (!form.accountNumber) found.accountNumber = 'Account number is required';
        else if (!ACCOUNT_NUMBER_REGEX.test(form.accountNumber)) found.accountNumber = 'Must be 9-18 digits';

        // Typed twice on purpose: a mistyped account number sends money to a
        // stranger and there is no undo.
        if (form.accountNumber && form.accountNumber !== form.confirmAccountNumber) {
            found.confirmAccountNumber = 'Account numbers do not match';
        }

        if (!form.ifscCode) found.ifscCode = 'IFSC code is required';
        else if (!IFSC_REGEX.test(form.ifscCode.toUpperCase())) found.ifscCode = 'Invalid IFSC, e.g. SBIN0001234';

        if (!form.bankName.trim()) found.bankName = 'Bank name is required';
        else if (form.bankName.trim().length > 100) found.bankName = 'Must be 100 characters or fewer';

        return found;
    };

    const handleSubmit = async () => {
        const found = validate();
        if (!isClean(found)) {
            setErrors(found);
            return;
        }

        setIsSaving(true);
        const result = await onSubmit({
            accountName: form.accountName.trim(),
            accountNumber: form.accountNumber,
            ifscCode: form.ifscCode.toUpperCase(),
            bankName: form.bankName.trim(),
            makeDefault: form.makeDefault,
        });
        setIsSaving(false);

        // The server returns { error, field } so its rejection lands on the same
        // input the client rules would have marked.
        if (!result.ok) {
            setErrors({ [result.field || 'accountNumber']: result.error });
        }
    };

    return (
        <div className="space-y-4">
            <Input
                label="Account Holder Name"
                placeholder="Full name as per bank records"
                maxLength={120}
                value={form.accountName}
                onChange={(e) => set('accountName', e.target.value)}
                error={errors.accountName}
            />
            <Input
                label="Account Number"
                placeholder="9-18 digits"
                inputMode="numeric"
                maxLength={18}
                value={form.accountNumber}
                onChange={(e) => set('accountNumber', e.target.value.replace(/\D/g, ''))}
                error={errors.accountNumber}
            />
            <Input
                label="Confirm Account Number"
                placeholder="Re-enter the account number"
                inputMode="numeric"
                maxLength={18}
                value={form.confirmAccountNumber}
                onChange={(e) => set('confirmAccountNumber', e.target.value.replace(/\D/g, ''))}
                error={errors.confirmAccountNumber}
            />
            <Input
                label="IFSC Code"
                placeholder="e.g. SBIN0001234"
                maxLength={11}
                value={form.ifscCode}
                // Uppercased as they type - IFSC codes are uppercase and the regex
                // expects it, so silently normalising beats rejecting valid input.
                onChange={(e) => set('ifscCode', e.target.value.toUpperCase())}
                error={errors.ifscCode}
            />
            <Input
                label="Bank Name"
                placeholder="e.g. State Bank of India"
                maxLength={100}
                value={form.bankName}
                onChange={(e) => set('bankName', e.target.value)}
                error={errors.bankName}
            />

            {showDefaultToggle && (
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.makeDefault}
                        onChange={(e) => set('makeDefault', e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500"
                    />
                    Make this my default payout account
                </label>
            )}

            <div className="flex gap-3 pt-1">
                <Button onClick={handleSubmit} disabled={isSaving}>
                    {isSaving ? 'Saving...' : submitLabel}
                </Button>
                {onCancel && (
                    <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
                        Cancel
                    </Button>
                )}
            </div>
        </div>
    );
}
