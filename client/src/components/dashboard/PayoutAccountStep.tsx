'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { useBankAccounts, maskAccountNumber } from '@/hooks/useBankAccounts';
import BankAccountForm from './BankAccountForm';

interface PayoutAccountStepProps {
    /** Currently chosen account id, or null while accounts are loading. */
    value: string | null;
    onChange: (accountId: string | null) => void;
    /** Message shown when the step is submitted with nothing selected. */
    error?: string;
    /** What the earnings are for, used in the copy. */
    subject: 'event' | 'venue';
}

/**
 * Choose where this listing's earnings go: pick a saved account, or add one.
 *
 * The default account is auto-selected, so the common case is read-and-continue.
 * Choosing a different one here does not change the account-level default - that is
 * managed in Settings.
 *
 * This step is also the creation gate: with no saved account there is nothing to
 * select, so the form cannot be completed until one is added. That is deliberate -
 * a listing that earns money with nowhere to send it is a support ticket later.
 */
export default function PayoutAccountStep({ value, onChange, error, subject }: PayoutAccountStepProps) {
    const { accounts, defaultAccount, isLoading, add } = useBankAccounts();
    const [isAdding, setIsAdding] = useState(false);

    // Pre-select the default once the list arrives, without clobbering a choice the
    // user has already made.
    useEffect(() => {
        if (isLoading || value) return;
        if (defaultAccount) onChange(defaultAccount._id);
    }, [isLoading, value, defaultAccount, onChange]);

    const handleAdd = async (details: Parameters<typeof add>[0]) => {
        const result = await add(details);
        if (result.ok) {
            // Select the account they just added - it is why they added it. The list
            // is server-ordered, so the newest is last.
            setIsAdding(false);
            onChange(null);
        }
        return result;
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (accounts.length === 0 || isAdding) {
        return (
            <div className="space-y-4">
                <div>
                    <h4 className="text-white font-medium mb-1">
                        {accounts.length === 0 ? 'Add a payout account' : 'Add another account'}
                    </h4>
                    <p className="text-sm text-gray-400">
                        {accounts.length === 0
                            ? `Your ${subject} earnings are sent here. You need one before you can publish.`
                            : 'This will be saved to your account for future listings.'}
                    </p>
                </div>
                <BankAccountForm
                    onSubmit={handleAdd}
                    onCancel={accounts.length > 0 ? () => setIsAdding(false) : undefined}
                    showDefaultToggle={accounts.length > 0}
                    submitLabel="Save and use this account"
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h4 className="text-white font-medium mb-1">Where should earnings go?</h4>
                <p className="text-sm text-gray-400">
                    Your default is selected. Pick another if this {subject} should pay out elsewhere.
                </p>
            </div>

            <ul className="space-y-2" role="radiogroup" aria-label="Payout account">
                {accounts.map(account => {
                    const selected = value === account._id;
                    return (
                        <li key={account._id}>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => onChange(account._id)}
                                className={`w-full text-left rounded-xl border p-4 transition-colors ${selected
                                    ? 'border-violet-500 bg-violet-500/[0.08]'
                                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <span
                                        className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${selected ? 'border-violet-500' : 'border-white/30'
                                            }`}
                                    >
                                        {selected && <span className="w-2 h-2 rounded-full bg-violet-500" />}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-white font-medium truncate">{account.accountName}</span>
                                            {account.isDefault && (
                                                <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-300 text-[10px] font-semibold uppercase tracking-wide">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-300 mt-0.5">{account.bankName}</p>
                                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                                            {maskAccountNumber(account.accountNumber)} · {account.ifscCode}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>

            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

            <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
                + Use a different account
            </Button>
        </div>
    );
}
