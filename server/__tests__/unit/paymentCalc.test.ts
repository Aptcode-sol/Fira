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
    expect(result.gstAmount).toBe(9); // Math.round(50 * 0.18)
    expect(result.totalAmount).toBe(1059); // 1000 + 50 + 9
    expect(result.platformFeePercentage).toBe(5);
  });

  it('calculates billing with a flat discount', () => {
    const result = paymentService.calculateBilling(500, 2, 5, 200);

    expect(result.subtotal).toBe(1000);
    expect(result.discountAmount).toBe(200);
    expect(result.discountedSubtotal).toBe(800);
    expect(result.platformFee).toBe(40); // 800 * 5 / 100
    expect(result.gstAmount).toBe(7); // Math.round(40 * 0.18)
    expect(result.totalAmount).toBe(847); // 800 + 40 + 7
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

  it('rounds platform fee and GST to nearest integer', () => {
    // 999 * 3 / 100 = 29.97 → rounds to 30
    const result = paymentService.calculateBilling(333, 3, 3);

    expect(result.subtotal).toBe(999);
    expect(result.platformFee).toBe(30); // Math.round(999 * 3 / 100) = Math.round(29.97)
    expect(result.gstAmount).toBe(5); // Math.round(30 * 0.18) = Math.round(5.4)
    expect(result.totalAmount).toBe(999 + 30 + 5);
  });
});
