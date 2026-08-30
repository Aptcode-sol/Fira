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
    expect(result.gstAmount).toBe(7.2);
    expect(result.totalAmount).toBe(847.2);
  });

  it('caps discount at subtotal', () => {
    const result = calculateBilling(100, 1, 5, 500);
    expect(result.discountedSubtotal).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.gstAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  // The preview the buyer sees has to equal what the server charges. If these
  // two ever diverge, the gateway screen is where the customer finds out.
  it('keeps paise instead of rounding to whole rupees, matching the server', () => {
    const result = calculateBilling(333, 3, 3);
    expect(result.subtotal).toBe(999);
    expect(result.platformFee).toBe(29.97);
    expect(result.gstAmount).toBe(5.39);
    expect(result.totalAmount).toBe(1034.36);
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
    expect(screen.getByText('₹1,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹1,059.00')).toBeInTheDocument();
  });

  it('shows the paise on a fee that is not a whole rupee', () => {
    render(
      <BillingCard ticketPrice={333} quantity={3} platformFeePercentage={3} />
    );
    expect(screen.getByText('₹29.97')).toBeInTheDocument();
    expect(screen.getByText('₹1,034.36')).toBeInTheDocument();
  });

  it('itemises the platform fee without publishing the commission rate', () => {
    render(
      <BillingCard ticketPrice={500} quantity={2} platformFeePercentage={5} />
    );
    // The fee is charged, so it has to be shown - as a rupee amount only. The rate
    // is commercial information and used to sit on every checkout screen.
    expect(screen.getByText('Platform fee')).toBeInTheDocument();
    expect(screen.getByText('₹50.00')).toBeInTheDocument();
    expect(screen.queryByText(/Platform fee \(/)).toBeNull();
    // GST keeps its rate: statutory tax, not our margin.
    expect(screen.getByText('GST (18%)')).toBeInTheDocument();
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
