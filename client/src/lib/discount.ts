import { roundMoney } from './formatInr';

export type DiscountType = 'percentage' | 'flat';

/** A validated code as the checkout holds it: its terms, not a frozen amount. */
export interface AppliedDiscount {
    code: string;
    type: DiscountType;
    value: number;
}

/**
 * The rupee value of a code against `baseAmount` - the order's total payable
 * (ticket subtotal + platform fee + GST). Mirror of
 * server/services/discountService.js `computeDiscountAmount`.
 *
 * The checkout keeps the code's type and value and re-prices it here on every
 * tier or quantity change. Storing the amount the server quoted at Apply time is
 * what left a 20% code showing ₹39.80 off (20% of ₹199) after the buyer switched
 * to the ₹99 tier.
 */
export function computeDiscountAmount(type: DiscountType, value: number, baseAmount: number): number {
    const base = Math.max(0, Number(baseAmount) || 0);
    if (type === 'percentage') {
        return roundMoney(Math.min(base, (base * value) / 100));
    }
    return roundMoney(Math.min(value, base));
}
