'use client';

import { useState } from 'react';
import { paymentsApi } from '@/lib/api';

interface DiscountCodeInputProps {
  eventId: string;
  subtotal: number;
  onApplied: (discount: { code: string; amount: number }) => void;
  onRemoved: () => void;
  appliedCode: string | null;
}

export default function DiscountCodeInput({
  eventId,
  subtotal,
  onApplied,
  onRemoved,
  appliedCode,
}: DiscountCodeInputProps) {
  const [code, setCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setIsApplying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await paymentsApi.applyDiscount({
        code: trimmed,
        eventId,
        subtotal,
      });
      onApplied({ code: trimmed.toUpperCase(), amount: result.discountAmount });
      setSuccessMessage(
        `Code applied! You save ₹${result.discountAmount.toFixed(2)}`
      );
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
    setSuccessMessage(null);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-300">Discount Code</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="Enter code"
          disabled={!!appliedCode || isApplying}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
        />
        {appliedCode ? (
          <button
            type="button"
            onClick={handleRemove}
            className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={!code.trim() || isApplying}
            className="px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm font-medium hover:bg-violet-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? 'Applying...' : 'Apply'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {successMessage && <p className="text-xs text-green-400">{successMessage}</p>}
    </div>
  );
}
