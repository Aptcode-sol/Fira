'use client';

import { useCallback, useEffect, useState } from 'react';
import { usersApi, type BankAccount } from '@/lib/api';

/**
 * The signed-in user's saved payout accounts, plus the operations on them.
 *
 * One hook so settings (manage) and the creation forms (pick one) read the same
 * list and cannot disagree about which account is the default.
 */
export function useBankAccounts() {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);

    const load = useCallback(async () => {
        try {
            setIsLoading(true);
            const { accounts: list } = await usersApi.listBankAccounts();
            setAccounts(list || []);
        } catch {
            // A failed read leaves the list empty; callers show their own empty state
            // rather than a scary error for something the user can simply retry.
            setAccounts([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /**
     * Add an account. Resolves to a field-level error from the server (rather than
     * throwing) so the caller can mark the offending input.
     */
    const add = async (details: {
        accountName: string;
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        makeDefault?: boolean;
    }): Promise<{ ok: true } | { ok: false; error: string; field?: string }> => {
        setIsMutating(true);
        try {
            const { accounts: list } = await usersApi.addBankAccount(details);
            setAccounts(list || []);
            return { ok: true };
        } catch (err: unknown) {
            const e = err as { message?: string; field?: string };
            return { ok: false, error: e?.message || 'Could not save this account', field: e?.field };
        } finally {
            setIsMutating(false);
        }
    };

    const setDefault = async (accountId: string) => {
        setIsMutating(true);
        try {
            const { accounts: list } = await usersApi.setDefaultBankAccount(accountId);
            setAccounts(list || []);
        } finally {
            setIsMutating(false);
        }
    };

    const remove = async (accountId: string) => {
        setIsMutating(true);
        try {
            const { accounts: list } = await usersApi.deleteBankAccount(accountId);
            setAccounts(list || []);
        } finally {
            setIsMutating(false);
        }
    };

    const defaultAccount = accounts.find(a => a.isDefault) || accounts[0] || null;

    return { accounts, defaultAccount, isLoading, isMutating, reload: load, add, setDefault, remove };
}

/** Show only the last four digits; the rest is never needed on screen. */
export function maskAccountNumber(value: string): string {
    if (!value || value.length < 4) return '••••';
    return '••••••' + value.slice(-4);
}
