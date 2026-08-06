'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@/components/ui';
import { ticketsApi } from '@/lib/api';

interface RefundEligibility {
    eligible: boolean;
    reason: string;
    refundAmount: number;
    originalAmount: number;
    refundPercentage: number;
    policy: string;
    eventDate: string;
}

interface CancellationModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: string;
    eventName: string;
    userId: string;
    onSuccess: () => void;
}

export function CancellationModal({
    isOpen,
    onClose,
    ticketId,
    eventName,
    userId,
    onSuccess,
}: CancellationModalProps) {
    const [loading, setLoading] = useState(false);
    const [checkingEligibility, setCheckingEligibility] = useState(true);
    const [eligibility, setEligibility] = useState<RefundEligibility | null>(null);
    const [error, setError] = useState('');
    const [reason, setReason] = useState('');
    const [success, setSuccess] = useState(false);
    const [refundResult, setRefundResult] = useState<any>(null);

    useEffect(() => {
        if (isOpen && ticketId) {
            checkEligibility();
        }
    }, [isOpen, ticketId]);

    const checkEligibility = async () => {
        setCheckingEligibility(true);
        setError('');
        try {
            const data = await ticketsApi.checkRefundEligibility(ticketId);
            setEligibility(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to check refund eligibility');
        } finally {
            setCheckingEligibility(false);
        }
    };

    const handleCancel = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await ticketsApi.cancel(ticketId, userId, reason || 'User requested cancellation');
            setRefundResult(result);
            setSuccess(true);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to cancel ticket');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setSuccess(false);
            setRefundResult(null);
            setReason('');
            setError('');
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Cancel Ticket" size="md">
            {/* Success State */}
            {success && refundResult && (
                <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Ticket Cancelled</h3>
                    {refundResult.refund ? (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mt-4">
                            <p className="text-green-400 text-sm mb-2">Refund Initiated</p>
                            <p className="text-2xl font-bold text-green-400">₹{refundResult.refund.amount}</p>
                            <p className="text-xs text-gray-400 mt-2">
                                {refundResult.refundEligibility?.policy}
                            </p>
                        </div>
                    ) : (
                        <p className="text-gray-400">
                            {refundResult.refundEligibility?.policy || 'Your ticket has been cancelled.'}
                        </p>
                    )}
                </div>
            )}

            {/* Loading Eligibility */}
            {!success && checkingEligibility && (
                <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-400">Checking refund eligibility...</p>
                </div>
            )}

            {/* Main Content */}
            {!success && !checkingEligibility && (
                <div className="space-y-6">
                    {/* Event Info */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Event</p>
                        <p className="text-white font-medium">{eventName}</p>
                    </div>

                    {/* Refund Policy Info */}
                    {eligibility && (
                        <div className={`rounded-xl p-4 border ${eligibility.eligible
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-red-500/10 border-red-500/30'
                            }`}>
                            <div className="flex items-start gap-3">
                                {eligibility.eligible ? (
                                    <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                )}
                                <div className="flex-1">
                                    <p className={`font-medium ${eligibility.eligible ? 'text-green-400' : 'text-red-400'}`}>
                                        {eligibility.eligible ? 'Eligible for Refund' : 'Not Eligible for Refund'}
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">{eligibility.policy}</p>

                                    {eligibility.eligible && eligibility.refundAmount > 0 && (
                                        <div className="mt-3 pt-3 border-t border-white/10">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400 text-sm">Original Amount</span>
                                                <span className="text-white">₹{eligibility.originalAmount}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-gray-400 text-sm">
                                                    Refund ({eligibility.refundPercentage}%)
                                                </span>
                                                <span className="text-green-400 font-semibold text-lg">
                                                    ₹{eligibility.refundAmount}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reason Input */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">
                            Reason for cancellation (optional)
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Let us know why you're cancelling..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500 resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Warning */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-sm text-amber-200">
                                This action cannot be undone. Once cancelled, your ticket will no longer be valid for entry.
                            </p>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Keep Ticket
                        </Button>
                        {/* Stays the standard white primary button. The red
                            hover was the only thing turning it red - the copy
                            and the warning above already make the consequence
                            clear without recolouring the control. */}
                        <Button
                            variant="primary"
                            className="flex-1"
                            onClick={handleCancel}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Cancelling...
                                </span>
                            ) : (
                                'Cancel Ticket'
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
