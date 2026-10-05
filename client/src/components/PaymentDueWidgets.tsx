'use client';

/**
 * Floating "Pay Now" widget(s) on the venue page (Req 8, 9).
 *
 * For an authenticated customer it fetches their bookings and keeps only those
 * at THIS venue with an installment schedule and a still-pending balance
 * (Req 8.1). It renders nothing when none qualify; stacks 1–2 cards; and for 3+
 * shows a single small swipeable scroll-snap container with dot indicators so
 * more than two never pile up the screen (Req 8.4, 8.5, Property 8).
 *
 * "Pay Now" runs the same Razorpay checkout the deposit flow uses — initiate →
 * window.Razorpay → verify — then refreshes the list so a paid booking drops out
 * (Req 8.6). Fixed bottom-right, lifted above the mobile bottom nav via the same
 * safe-area convention, z-40 so it always sits below the z-50 nav (Req 8.2, 8.3,
 * 9.2, 9.3).
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { bookingsApi } from '@/lib/api';
import { formatInr } from '@/lib/formatInr';
import { daysUntil } from '@/lib/paymentSchedule';
import type { Booking } from '@/lib/types';
import { widgetLayout } from './paymentDueLayout';

interface PaymentDueWidgetsProps {
    venueId: string;
    userId?: string | null;
    venueName?: string;
}

/** Reuse the deposit flow's loader: inject the Razorpay script once, resolve on load. */
function loadRazorpay(): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && (window as { Razorpay?: unknown }).Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

/** A booking's venue can be an id string or a populated object — normalize to id. */
function venueIdOf(venue: Booking['venue']): string {
    return typeof venue === 'string' ? venue : venue?._id ?? '';
}

/** Installment + pending balance at this venue (Req 8.1). */
function isBalanceDueHere(booking: Booking, venueId: string): boolean {
    const s = booking.paymentSchedule;
    return (
        !!s &&
        s.type === 'installment' &&
        s.balanceStatus === 'pending' &&
        // Only once the deposit is actually paid - an abandoned checkout has
        // no balance to settle.
        booking.paymentStatus === 'paid' &&
        booking.status !== 'cancelled' &&
        venueIdOf(booking.venue) === venueId
    );
}

export default function PaymentDueWidgets({ venueId, userId, venueName }: PaymentDueWidgetsProps) {
    const [qualifying, setQualifying] = useState<Booking[]>([]);
    const [payingId, setPayingId] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const refresh = useCallback(async () => {
        if (!userId) {
            setQualifying([]);
            return;
        }
        try {
            const bookings = (await bookingsApi.getUserBookings(userId)) as Booking[];
            const list = Array.isArray(bookings) ? bookings.filter((b) => isBalanceDueHere(b, venueId)) : [];
            setQualifying(list);
        } catch {
            // A failed fetch just means no widget — the page's primary flow is unaffected.
            setQualifying([]);
        }
    }, [userId, venueId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const handlePayNow = useCallback(
        async (booking: Booking) => {
            if (!userId || payingId) return;
            setPayingId(booking._id);
            try {
                const init = await bookingsApi.initiateBalancePayment(booking._id, userId);
                const loaded = await loadRazorpay();
                if (!loaded) {
                    setPayingId(null);
                    return;
                }
                const options = {
                    key: init.keyId,
                    amount: init.amount,
                    currency: init.currency,
                    name: 'Firaa Venues',
                    description: `Balance for ${init.booking?.venueName || venueName || 'venue'}`,
                    order_id: init.gatewayOrderId,
                    handler: async (response: {
                        razorpay_order_id: string;
                        razorpay_payment_id: string;
                        razorpay_signature: string;
                    }) => {
                        try {
                            await bookingsApi.verifyBalancePayment(booking._id, {
                                gatewayOrderId: response.razorpay_order_id,
                                gatewayPaymentId: response.razorpay_payment_id,
                                gatewaySignature: response.razorpay_signature,
                            });
                            await refresh();
                        } finally {
                            setPayingId(null);
                        }
                    },
                    theme: { color: '#8b5cf6' },
                    modal: {
                        ondismiss: () => setPayingId(null),
                    },
                };
                const rzp = new (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay(
                    options
                );
                rzp.open();
            } catch {
                setPayingId(null);
            }
        },
        [userId, payingId, venueName, refresh]
    );

    // Single source of truth for the layout decision (Property 8).
    const layout = widgetLayout(qualifying.length);
    if (layout === 'none') return null;
    const isSwipeable = layout === 'swipeable';

    // Fixed bottom-right, lifted above the ~5rem mobile bottom nav + safe area on
    // mobile, reset to bottom-6 on desktop. z-40 keeps it below the z-50 nav.
    const positionClasses =
        'fixed right-4 md:right-6 bottom-[calc(5rem+env(safe-area-inset-bottom)+0.5rem)] md:bottom-6 z-40';

    if (!isSwipeable) {
        return (
            <div className={`${positionClasses} flex flex-col gap-3`}>
                {qualifying.map((b) => (
                    <PaymentDueCard
                        key={b._id}
                        booking={b}
                        venueName={venueName}
                        loading={payingId === b._id}
                        disabled={!!payingId}
                        onPay={() => handlePayNow(b)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className={positionClasses}>
            <div
                className="flex w-[17rem] max-w-[90vw] snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onScroll={(e) => {
                    const el = e.currentTarget;
                    const idx = Math.round(el.scrollLeft / (el.clientWidth || 1));
                    if (idx !== activeIndex) setActiveIndex(idx);
                }}
            >
                {qualifying.map((b) => (
                    <div key={b._id} className="w-full shrink-0 snap-center">
                        <PaymentDueCard
                            booking={b}
                            venueName={venueName}
                            loading={payingId === b._id}
                            disabled={!!payingId}
                            onPay={() => handlePayNow(b)}
                        />
                    </div>
                ))}
            </div>
            <div className="mt-2 flex justify-center gap-1.5">
                {qualifying.map((b, i) => (
                    <span
                        key={b._id}
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            i === activeIndex ? 'bg-violet-400' : 'bg-white/25'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}

interface PaymentDueCardProps {
    booking: Booking;
    venueName?: string;
    loading: boolean;
    disabled: boolean;
    onPay: () => void;
}

/** One dark, rounded, violet-accented card: days left + amount due + Pay Now (Req 8.7, 9.1). */
function PaymentDueCard({ booking, venueName, loading, disabled, onPay }: PaymentDueCardProps) {
    const s = booking.paymentSchedule;
    const days = daysUntil(s?.balanceDueAt);
    const amount = s?.balanceAmount ?? 0;
    const label = venueName || (typeof booking.venue === 'object' ? booking.venue?.name : '') || 'Balance due';

    return (
        <div className="w-full rounded-2xl border border-white/10 bg-[#0d0d0d] p-4 shadow-xl shadow-black/40">
            <p className="truncate text-sm font-medium text-white">{label}</p>
            <p className="mt-1 text-xs text-violet-400">
                {days} {days === 1 ? 'day' : 'days'} left
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
                {formatInr(amount)} <span className="text-xs font-normal text-white/50">due</span>
            </p>
            <Button
                variant="violet"
                size="sm"
                isLoading={loading}
                disabled={disabled && !loading}
                onClick={onPay}
                className="mt-3 w-full"
            >
                Pay Now
            </Button>
        </div>
    );
}
