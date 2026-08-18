'use client';

interface BillingCardProps {
  ticketPrice: number;
  quantity: number;
  platformFeePercentage: number;
  discountAmount?: number;
  discountCode?: string;
}

function formatINR(amount: number): string {
  return `₹${(amount / 1).toFixed(2)}`;
}

export function calculateBilling(
  ticketPrice: number,
  quantity: number,
  platformFeePercentage: number,
  discountAmount: number = 0
) {
  const subtotal = ticketPrice * quantity;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const platformFee = Math.round(discountedSubtotal * platformFeePercentage / 100);
  const gstAmount = Math.round(platformFee * 0.18);
  const totalAmount = discountedSubtotal + platformFee + gstAmount;

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
        <span>{formatINR(ticketPrice)}</span>
      </div>

      <div className="flex justify-between text-sm text-gray-300">
        <span>Quantity</span>
        <span>×{quantity}</span>
      </div>

      <div className="flex justify-between text-sm text-gray-300">
        <span>Subtotal</span>
        <span>{formatINR(subtotal)}</span>
      </div>

      {discountAmount > 0 && (
        <div className="flex justify-between text-sm text-green-400">
          <span>Discount{discountCode ? ` (${discountCode})` : ''}</span>
          <span>-{formatINR(discountAmount)}</span>
        </div>
      )}

      <div className="flex justify-between text-sm text-gray-300">
        <span>Platform fee ({platformFeePercentage}%)</span>
        <span>{formatINR(platformFee)}</span>
      </div>

      <div className="flex justify-between text-sm text-gray-300">
        <span>GST (18% on platform fee)</span>
        <span>{formatINR(gstAmount)}</span>
      </div>

      <div className="border-t border-white/10 pt-3 mt-3 flex justify-between">
        <span className="text-white font-bold">Total Payable</span>
        <span className="text-white font-bold text-lg">{formatINR(totalAmount)}</span>
      </div>
    </div>
  );
}
