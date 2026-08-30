/**
 * Venue pricing, resolved in one place.
 *
 * A venue is priced per day. Venues created before `pricePerDay` existed only
 * carry the old `basePrice` ("charged per booking"), so reads fall back to it -
 * which for a single-day booking is the same number it always was. Every display
 * and every total goes through here so the fallback cannot be applied
 * inconsistently, and so `pricePerHour` is dead everywhere at once.
 */

interface VenueLikePricing {
    pricing?: {
        pricePerDay?: number | null;
        basePrice?: number | null;
        currency?: string;
    } | null;
}

/** The venue's per-day rate. 0 when unpriced, so callers can render "-" safely. */
export function venueDayRate(venue: VenueLikePricing | null | undefined): number {
    const pricing = venue?.pricing;
    if (!pricing) return 0;
    return pricing.pricePerDay ?? pricing.basePrice ?? 0;
}

/**
 * Nights are irrelevant for a venue: booking 5th-5th is one day, 5th-6th is two.
 * Inclusive of both end dates, and never less than 1 so a same-day booking bills
 * for the day it uses.
 */
export function billableDays(startDate: string, endDate?: string | null): number {
    if (!startDate) return 1;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;

    // Compare calendar dates, not timestamps, so a time-of-day difference cannot
    // add or drop a day.
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(end) - startOfDay(start)) / 86_400_000);
    return Math.max(1, diffDays + 1);
}

/** What the guest owes before the platform's advance percentage is applied. */
export function venueBookingTotal(
    venue: VenueLikePricing | null | undefined,
    startDate: string,
    endDate?: string | null
): number {
    return venueDayRate(venue) * billableDays(startDate, endDate);
}

/**
 * Share of the booking total taken as a non-refundable advance at checkout.
 * Mirrors `Math.round(booking.totalAmount * 0.10)` in bookingService.
 */
export const BOOKING_ADVANCE_RATE = 0.1;

/** Fallback platform fee percentage, matching the server's `?? 5`. */
export const DEFAULT_PLATFORM_FEE_PERCENTAGE = 5;

/** GST rate charged on the platform fee, matching paymentService. */
const GST_ON_FEE_RATE = 0.18;

export interface AdvanceBreakdown {
    /** 10% of the booking total - the advance itself. */
    advance: number;
    /** Platform fee charged on the advance. */
    platformFee: number;
    platformFeePercentage: number;
    /** GST on the platform fee. */
    gstAmount: number;
    /** What the gateway actually charges today. */
    payableNow: number;
    /** Settled with the venue owner directly, after the advance. */
    remaining: number;
}

/**
 * What the guest pays at checkout for a venue booking, itemised.
 *
 * This exists because the booking modal used to show only the bare 10% advance
 * while the server routed that advance through `calculateBilling`, adding a
 * platform fee and GST on top. A ₹166 booking displayed "Required 10% Advance ₹17"
 * and Razorpay then asked for ₹18 - the gateway is the first place the guest saw
 * the real number, which is the worst possible place to learn it.
 *
 * Every line here mirrors the server:
 *   advance     = round(total × 0.10)
 *   platformFee = round(advance × feePct / 100)
 *   gst         = round(platformFee × 0.18)
 *   payableNow  = advance + platformFee + gst
 *
 * Rounding happens at each step, in the same order, because rounding the sum
 * instead of the parts can differ by a rupee - and a rupee is the entire bug.
 */
export function bookingAdvance(
    bookingTotal: number,
    platformFeePercentage: number = DEFAULT_PLATFORM_FEE_PERCENTAGE
): AdvanceBreakdown {
    const advance = Math.round(bookingTotal * BOOKING_ADVANCE_RATE);
    const platformFee = Math.round((advance * platformFeePercentage) / 100);
    const gstAmount = Math.round(platformFee * GST_ON_FEE_RATE);

    return {
        advance,
        platformFee,
        platformFeePercentage,
        gstAmount,
        payableNow: advance + platformFee + gstAmount,
        remaining: bookingTotal - advance,
    };
}
