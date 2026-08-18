import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillingCard, { calculateBilling } from './BillingCard';

describe('calculateBilling', () => {
  it('computes correct breakdown without discount', () => {
    const result = calculateBilling(500, 2, 5);
    expect(result.subtotal).toBe(1000);
    expect(result.discountedSubtotal).toBe(1000);
    expect(result.platformFee).toBe(50);
    expect(result.gstAmount).toBe(9);
    expect(result.totalAmount).toBe(1059);
  });

  it('applies discount before computing fees', () => {
    const result = calculateBilling(500, 2, 5, 200);
    expect(result.subtotal).toBe(1000);
    expect(result.discountedSubtotal).toBe(800);
    expect(result.platformFee).toBe(40);
    expect(result.gstAmount).toBe(7);
    expect(result.totalAmount).toBe(847);
  });

  it('caps discount at subtotal', () => {
    const result = calculateBilling(100, 1, 5, 500);
    expect(result.discountedSubtotal).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.gstAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });
});

describe('BillingCard component', () => {
  it('renders nothing for free events', () => {
    const { container } = render(
      <BillingCard ticketPrice={0} quantity={1} platformFeePercentage={5} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders billing breakdown with INR formatting', () => {
    render(
      <BillingCard ticketPrice={500} quantity={2} platformFeePercentage={5} />
    );
    expect(screen.getByText('Billing Summary')).toBeInTheDocument();
    expect(screen.getByText('₹500.00')).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
    expect(screen.getByText('₹1000.00')).toBeInTheDocument();
    expect(screen.getByText('₹1059.00')).toBeInTheDocument();
  });

  it('displays discount with code name when provided', () => {
    render(
      <BillingCard
        ticketPrice={500}
        quantity={2}
        platformFeePercentage={5}
        discountAmount={200}
        discountCode="SAVE20"
      />
    );
    expect(screen.getByText('Discount (SAVE20)')).toBeInTheDocument();
    expect(screen.getByText('-₹200.00')).toBeInTheDocument();
  });
});
