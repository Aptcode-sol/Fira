'use client';

interface BillingCardProps {
  ticketPrice: number;
  quantity: number;
  platformFeePercentage: number;
  discountAmount?: number;
  discountCode?: string;
}

import { formatInr, roundMoney } from '@/lib/formatInr';

/**
 * Line-by-line mirror of paymentService.calculateBilling on the server.
 *
 * Rounding is to paise (two decimals), at each step and in this order - the
 * server rounds the same way, and this is the number the buyer is shown before
 * they are charged. Rounding to whole rupees (what this used to do) quietly
 * turned a 3% fee on ₹999 into ₹30 instead of ₹29.97.
 */
export function calculateBilling(
  ticketPrice: number,
  quantity: number,
  platformFeePercentage: number,
  discountAmount: number = 0
) {
  const subtotal = roundMoney(ticketPrice * quantity);
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - discountAmount));
  const platformFee = roundMoney(discountedSubtotal * platformFeePercentage / 100);
  const gstAmount = roundMoney(platformFee * 0.18);
  const totalAmount = roundMoney(discountedSubtotal + platformFee + gstAmount);

  return { subtotal, discountedSubtotal, platformFee, gstAmount, totalAmount };
}

export default function BillingCard({
  ticketPrice,
  quantity,
  platformFeePercentage,
  discountAmount = 0,
  discountCode,
}: BillingCardProps) {
  // ponytail: skip render for free events per Req 9.6
  if (ticketPrice === 0) return null;

  const { subtotal, discountedSubtotal, platformFee, gstAmount, totalAmount } =
    calculateBilling(ticketPrice, quantity, platformFeePercentage, discountAmount);

  return (
    <div className="rounded-xl border border-white/10 bg-black/60 backdrop-blur-sm p-5 space-y-3">
      <h3 className="text-white font-semibold text-lg mb-4">Billing Summary</h3>

      <div className="flex justify-between text-sm text-gray-300">
        <span>Ticket price</span>
        <span>{formatInr(ticketPrice)}</span>
      </div>

      <div className="flex justify-between text-sm text-gray-300">
        <span>Quantity</span>
        <span>×{quantity}</span>
      </div>

      <div className="flex justify-between text-sm text-gray-300">
        <span>Subtotal</span>
        <span>{formatInr(subtotal)}</span>
      </div>

      {discountAmount > 0 && (
        <div className="flex justify-between text-sm text-green-400">
          <span>Discount{discountCode ? ` (${discountCode})` : ''}</span>
          <span>-{formatInr(discountAmount)}</span>
        </div>
      )}

      {/* The rupee amount, not the rate. The fee itself is charged and has to be
          itemised, but our commission percentage is commercial information and
          publishing it on every checkout put it in front of competitors too. */}
      <div className="flex justify-between text-sm text-gray-300">
        <span>Platform fee</span>
        <span>{formatInr(platformFee)}</span>
      </div>

      {/* GST keeps its rate: it is a statutory tax, not our margin, and the buyer is
          entitled to see how the tax on their invoice was arrived at. */}
      <div className="flex justify-between text-sm text-gray-300">
        <span>GST (18%)</span>
        <span>{formatInr(gstAmount)}</span>
      </div>

      <div className="border-t border-white/10 pt-3 mt-3 flex justify-between">
        <span className="text-white font-bold">Total Payable</span>
        <span className="text-white font-bold text-lg">{formatInr(totalAmount)}</span>
      </div>
    </div>
  );
}
