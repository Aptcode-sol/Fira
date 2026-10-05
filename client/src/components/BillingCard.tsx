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
 *
 * The discount comes off the total payable (ticket + platform fee + GST), never
 * more than it. Fee and GST are always on the full ticket subtotal.
 */
export function calculateBilling(
  ticketPrice: number,
  quantity: number,
  platformFeePercentage: number,
  discountAmount: number = 0
) {
  const subtotal = roundMoney(ticketPrice * quantity);
  const platformFee = roundMoney(subtotal * platformFeePercentage / 100);
  const gstAmount = roundMoney(platformFee * 0.18);
  const grossTotal = roundMoney(subtotal + platformFee + gstAmount);
  const appliedDiscount = roundMoney(Math.min(Math.max(0, discountAmount || 0), grossTotal));
  const totalAmount = roundMoney(grossTotal - appliedDiscount);

  return { subtotal, platformFee, gstAmount, grossTotal, discountAmount: appliedDiscount, totalAmount };
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

  const bill = calculateBilling(ticketPrice, quantity, platformFeePercentage, discountAmount);

  return (
    <div className="rounded-xl border border-white/10 bg-black/60 backdrop-blur-sm p-5 space-y-3">
      <h3 className="text-white font-semibold text-lg mb-4">Billing Summary</h3>

      <div className="flex justify-between gap-3 text-sm text-gray-300">
        <span>Ticket price</span>
        <span className="whitespace-nowrap">{formatInr(ticketPrice)}</span>
      </div>

      <div className="flex justify-between gap-3 text-sm text-gray-300">
        <span>Quantity</span>
        <span className="whitespace-nowrap">×{quantity}</span>
      </div>

      <div className="flex justify-between gap-3 text-sm text-gray-300">
        <span>Subtotal</span>
        <span className="whitespace-nowrap">{formatInr(bill.subtotal)}</span>
      </div>

      {/* The rupee amount, not the rate. The fee itself is charged and has to be
          itemised, but our commission percentage is commercial information and
          publishing it on every checkout put it in front of competitors too. */}
      <div className="flex justify-between gap-3 text-sm text-gray-300">
        <span>Platform fee</span>
        <span className="whitespace-nowrap">{formatInr(bill.platformFee)}</span>
      </div>

      {/* GST keeps its rate: it is a statutory tax, not our margin, and the buyer is
          entitled to see how the tax on their invoice was arrived at. */}
      <div className="flex justify-between gap-3 text-sm text-gray-300">
        <span>GST (18%)</span>
        <span className="whitespace-nowrap">{formatInr(bill.gstAmount)}</span>
      </div>

      {/* Discount sits after fee + GST because that is what it comes off. */}
      {bill.discountAmount > 0 && (
        <>
          <div className="border-t border-white/10 pt-3 flex justify-between gap-3 text-sm text-gray-300">
            <span>Total before discount</span>
            <span className="whitespace-nowrap">{formatInr(bill.grossTotal)}</span>
          </div>
          <div className="flex justify-between gap-3 text-sm text-green-400">
            <span className="min-w-0 break-words">Discount{discountCode ? ` (${discountCode})` : ''}</span>
            <span className="whitespace-nowrap">-{formatInr(bill.discountAmount)}</span>
          </div>
        </>
      )}

      <div className="border-t border-white/10 pt-3 mt-3 flex justify-between gap-3">
        <span className="text-white font-bold">Total Payable</span>
        <span className="text-white font-bold text-lg whitespace-nowrap">{formatInr(bill.totalAmount)}</span>
      </div>
    </div>
  );
}
