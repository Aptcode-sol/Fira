'use client';

import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useBankAccounts, maskAccountNumber } from '@/hooks/useBankAccounts';
import BankAccountForm from './BankAccountForm';

/**
 * Manage payout accounts in Settings: list, mark a default, delete, add.
 *
 * Replaces the single-account BankDetailsForm here. The default is what venue and
 * event creation pre-select, and it is the account payouts fall back to - so it is
 * shown explicitly rather than implied by list order.
 */
export default function BankAccountsSection() {
    const { showToast } = useToast();
    const { accounts, isLoading, isMutating, add, setDefault, remove } = useBankAccounts();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<string | null>(null);

    const handleAdd = async (details: Parameters<typeof add>[0]) => {
        const result = await add(details);
        if (result.ok) {
            setIsAddOpen(false);
            showToast('Payout account saved', 'success');
        }
        // On failure the form marks its own field; nothing to announce here.
        return result;
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        await remove(pendingDelete);
        setPendingDelete(null);
        showToast('Payout account removed', 'success');
    };

    return (
        <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-1">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Payout Accounts
                </h2>
                {accounts.length > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => setIsAddOpen(true)}>
                        Add account
                    </Button>
                )}
            </div>
            <p className="text-sm text-gray-400 mb-6">
                Where your event and venue earnings are sent. The default is pre-selected when you
                create a listing, and you can pick a different one there.
            </p>

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            ) : accounts.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-300 mb-1">No payout account yet</p>
                    <p className="text-sm text-gray-400 mb-4">
                        You need one before you can list an event or a venue.
                    </p>
                    <Button onClick={() => setIsAddOpen(true)}>Add payout account</Button>
                </div>
            ) : (
                <ul className="space-y-3">
                    {accounts.map(account => (
                        <li
                            key={account._id}
                            className={`rounded-xl border p-4 ${account.isDefault
                                ? 'border-violet-500/40 bg-violet-500/[0.06]'
                                : 'border-white/10 bg-white/[0.02]'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-white font-medium truncate">{account.accountName}</span>
                                        {account.isDefault && (
                                            <span className="px-2 py-0.5 rounded-full bg-violet-500 text-white text-[10px] font-semibold uppercase tracking-wide">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-300 mt-1">{account.bankName}</p>
                                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                                        {maskAccountNumber(account.accountNumber)} · {account.ifscCode}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    {!account.isDefault && (
                                        <button
                                            type="button"
                                            onClick={() => setDefault(account._id)}
                                            disabled={isMutating}
                                            className="text-xs text-violet-400 hover:text-violet-300 disabled:text-gray-500"
                                        >
                                            Make default
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setPendingDelete(account._id)}
                                        disabled={isMutating}
                                        className="text-xs text-red-400 hover:text-red-300 disabled:text-gray-500"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add payout account" size="md">
                <AddAccountBody onSubmit={handleAdd} onCancel={() => setIsAddOpen(false)} isFirst={accounts.length === 0} />
            </Modal>

            {/* Deleting is permanent, so it asks. Past payouts keep their own copy of
                the details they were sent to, so history is not affected. */}
            <Modal isOpen={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="Delete this account?" size="sm">
                <p className="text-sm text-gray-300">
                    This removes the account from your saved payout options. Payouts already sent are
                    unaffected. If it was your default, the next account becomes the default.
                </p>
                <div className="flex gap-3 pt-5">
                    <Button variant="secondary" className="flex-1" onClick={() => setPendingDelete(null)}>
                        Keep it
                    </Button>
                    <Button className="flex-1 bg-red-600 hover:bg-red-500" onClick={confirmDelete} disabled={isMutating}>
                        Delete
                    </Button>
                </div>
            </Modal>
        </div>
    );
}

/** Split out so the form is only mounted while the modal is open (fresh state). */
function AddAccountBody({
    onSubmit,
    onCancel,
    isFirst,
}: {
    onSubmit: React.ComponentProps<typeof BankAccountForm>['onSubmit'];
    onCancel: () => void;
    isFirst: boolean;
}) {
    return (
        <BankAccountForm
            onSubmit={onSubmit}
            onCancel={onCancel}
            // The first account is the default by definition, so the toggle would be
            // a checkbox you cannot meaningfully uncheck.
            showDefaultToggle={!isFirst}
        />
    );
}
