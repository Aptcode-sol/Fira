'use client';

import { useState } from 'react';
import { paymentsApi } from '@/lib/api';
import { formatInr } from '@/lib/formatInr';
import type { AppliedDiscount } from '@/lib/discount';

interface DiscountCodeInputProps {
  eventId: string;
  /** The order's total payable (ticket + platform fee + GST) the code is priced against. */
  amount: number;
  onApplied: (discount: AppliedDiscount) => void;
  onRemoved: () => void;
  appliedCode: string | null;
  /**
   * What the applied code is worth on the CURRENT order. Passed in rather than
   * remembered from Apply time so the "You save" line follows tier and quantity
   * changes instead of quoting the order the code was applied to.
   */
  appliedSavings?: number;
}

export default function DiscountCodeInput({
  eventId,
  amount,
  onApplied,
  onRemoved,
  appliedCode,
  appliedSavings = 0,
}: DiscountCodeInputProps) {
  const [code, setCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setIsApplying(true);
    setError(null);

    try {
      const result = await paymentsApi.applyDiscount({
        code: trimmed,
        eventId,
        amount,
      });
      onApplied({
        code: (result.code || trimmed).toUpperCase(),
        type: result.discountType,
        value: result.discountValue,
      });
    } catch (err: any) {
      const message = err?.message || 'Invalid discount code';
      setError(message);
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemove = () => {
    onRemoved();
    setCode('');
    setError(null);
  };

  return (
    <div className="space-y-2">
      <label htmlFor="discount-code" className="text-sm text-gray-300">Discount Code</label>
      <div className="flex gap-2">
        {/* min-w-0 is what stops this row overflowing its container.
            A bare `flex-1` sets flex-basis to 0 but leaves `min-width: auto`, and an
            <input>'s automatic minimum is its intrinsic size (~20 characters). So the
            field refused to shrink below roughly 170px, and field + gap + button
            exceeded the modal width - the Apply button hung past the right edge. It
            looked fine on iOS and broke on Android only because the wider default font
            pushed the button over the line first. */}
        <input
          id="discount-code"
          type="text"
          value={appliedCode ?? code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!appliedCode) handleApply();
            }
          }}
          placeholder="Enter code"
          autoCapitalize="characters"
          autoComplete="off"
          disabled={!!appliedCode || isApplying}
          aria-invalid={!!error}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
        />
        {appliedCode ? (
          <button
            type="button"
            onClick={handleRemove}
            className="flex-shrink-0 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium whitespace-nowrap hover:bg-red-500/30 transition-colors"
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={!code.trim() || isApplying}
            className="flex-shrink-0 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm font-medium whitespace-nowrap hover:bg-violet-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? 'Applying...' : 'Apply'}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      {appliedCode && (
        <p className="text-xs text-green-400" aria-live="polite">
          Code applied! You save {formatInr(appliedSavings)}
        </p>
      )}
    </div>
  );
}
