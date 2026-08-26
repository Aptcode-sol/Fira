'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { paymentsApi } from '@/lib/api';

type PaymentTab = 'transactions' | 'earnings';

interface Payment {
    _id: string;
    type: string;
    description: string;
    amount: number;
    createdAt: string;
    status: string;
    referenceType?: string;
}

export default function PaymentsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [activeTab, setActiveTab] = useState<PaymentTab>('transactions');
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        const fetchPayments = async () => {
            if (!user?._id) return;
            try {
                setLoading(true);
                const data = await paymentsApi.getUserPayments(user._id) as Payment[];
                setPayments(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load payments');
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated && user?._id) {
            fetchPayments();
        }
    }, [isAuthenticated, user?._id]);

    if (isLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'ticket':
                return (
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                    </div>
                );
            case 'booking':
                return (
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                        </svg>
                    </div>
                );
            case 'refund':
                return (
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                    </div>
                );
            case 'earning':
            case 'payout':
                return (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
        }
    };

    const totalEarnings = payments
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

    const totalSpent = Math.abs(
        payments.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
    );

    // 17.2: Transactions and Earnings are distinct, disjoint views of the same
    // ledger — not the same list twice. Transactions = money the user PAID
    // (outflows, amount < 0); Earnings = money owed/settled to them as an owner
    // (inflows, amount > 0). The underlying numbers/computation are owned by
    // platform-flow-fixes; this only wires which slice each tab displays.
    const filteredPayments = activeTab === 'transactions'
        ? payments.filter(p => p.amount < 0)
        : payments.filter(p => p.amount > 0);

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Payments</h1>
                    <p className="text-gray-300">Track your transactions and earnings</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5">
                        <div className="text-sm text-gray-300 mb-1">Total Spent</div>
                        <div className="text-2xl font-bold text-white">₹{totalSpent.toLocaleString()}</div>
                    </div>
                    <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5">
                        <div className="text-sm text-gray-300 mb-1">Total Earnings</div>
                        <div className="text-2xl font-bold text-emerald-400">₹{totalEarnings.toLocaleString()}</div>
                    </div>
                    <div className="bg-gradient-to-r from-violet-500/20 to-pink-500/20 backdrop-blur-sm border border-violet-500/20 rounded-2xl p-5">
                        <div className="text-sm text-violet-300 mb-1">Net Balance</div>
                        <div className="text-2xl font-bold text-white">₹{(totalEarnings - totalSpent).toLocaleString()}</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-8">
                    {(['transactions', 'earnings'] as PaymentTab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2.5 rounded-full text-sm font-medium capitalize transition-all duration-200 ${activeTab === tab
                                ? 'bg-white text-black shadow-lg shadow-white/10'
                                : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.08]'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="text-center py-16">
                        <p className="text-red-400 mb-4">{error}</p>
                        <Button onClick={() => window.location.reload()}>Try Again</Button>
                    </div>
                )}

                {/* Transactions List */}
                {!loading && !error && (
                    <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                        <div className="divide-y divide-white/[0.05]">
                            {filteredPayments.map((payment) => (
                                <div key={payment._id} className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                                    {getTypeIcon(payment.referenceType || payment.type)}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{payment.description}</p>
                                        <p className="text-xs text-gray-300">{formatDate(payment.createdAt)}</p>
                                    </div>
                                    <div className={`text-right font-semibold ${payment.amount > 0 ? 'text-emerald-400' : 'text-white'}`}>
                                        {payment.amount > 0 ? '+' : ''}₹{Math.abs(payment.amount).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && filteredPayments.length === 0 && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-white mb-2">No {activeTab} yet</h3>
                        <p className="text-gray-300">Your payment history will appear here.</p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
