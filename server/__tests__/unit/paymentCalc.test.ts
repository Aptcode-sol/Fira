import { describe, it, expect } from 'vitest';

// Import the service directly — calculateBilling is a pure function, no DB needed
const paymentService = require('../../services/paymentService');

describe('paymentService.calculateBilling', () => {
  it('calculates billing correctly without discount', () => {
    const result = paymentService.calculateBilling(500, 2, 5);

    expect(result.subtotal).toBe(1000);
    expect(result.discountAmount).toBe(0);
    expect(result.discountedSubtotal).toBe(1000);
    expect(result.platformFee).toBe(50); // 1000 * 5 / 100
    expect(result.gstAmount).toBe(9); // 50 * 0.18 = 9.00 exactly
    expect(result.totalAmount).toBe(1059); // 1000 + 50 + 9
    expect(result.platformFeePercentage).toBe(5);
  });

  it('calculates billing with a flat discount', () => {
    const result = paymentService.calculateBilling(500, 2, 5, 200);

    expect(result.subtotal).toBe(1000);
    expect(result.discountAmount).toBe(200);
    expect(result.discountedSubtotal).toBe(800);
    expect(result.platformFee).toBe(40); // 800 * 5 / 100
    expect(result.gstAmount).toBe(7.2); // 40 * 0.18, kept to paise
    expect(result.totalAmount).toBe(847.2); // 800 + 40 + 7.2
  });

  it('caps discountedSubtotal at zero when discount exceeds subtotal', () => {
    const result = paymentService.calculateBilling(100, 1, 5, 500);

    expect(result.subtotal).toBe(100);
    expect(result.discountedSubtotal).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.gstAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('handles zero ticket price', () => {
    const result = paymentService.calculateBilling(0, 3, 5);

    expect(result.subtotal).toBe(0);
    expect(result.discountedSubtotal).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.gstAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('keeps the paise instead of rounding to whole rupees', () => {
    // The regression this guards: 999 * 3 / 100 = 29.97 was billed as ₹30.
    const result = paymentService.calculateBilling(333, 3, 3);

    expect(result.subtotal).toBe(999);
    expect(result.platformFee).toBe(29.97);
    expect(result.gstAmount).toBe(5.39); // 29.97 * 0.18 = 5.3946 → 5.39
    expect(result.totalAmount).toBe(1034.36); // 999 + 29.97 + 5.39
  });

  it('rounds a half-paise up rather than down (binary-float half case)', () => {
    // 1.005 * 100 is 100.49999999999999 in floating point; a naive
    // Math.round(n * 100) would give 1.00 and lose the paise.
    const result = paymentService.calculateBilling(20.1, 1, 5);

    expect(result.platformFee).toBe(1.01); // 20.1 * 5 / 100 = 1.005 → 1.01
  });

  it('produces amounts the gateway can charge as whole paise', () => {
    const result = paymentService.calculateBilling(333, 3, 3);

    expect(Number.isInteger(Math.round(result.totalAmount * 100))).toBe(true);
    expect(result.totalAmount * 100).toBeCloseTo(103436, 6);
  });
});
