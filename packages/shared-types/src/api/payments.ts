export type PaymentMethod = 'razorpay' | 'upi' | 'card' | 'netbanking';
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processed';

// --- Requests ---

export interface CreatePaymentOrderRequest {
  bookingId: string;
  amount: number;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RequestRefundRequest {
  paymentId: string;
  reason: string;
}

export interface ProcessRefundRequest {
  status: 'approved' | 'rejected';
  adminNote?: string;
}

export interface CreatePayoutRequest {
  venueOwnerId: string;
  amount: number;
  bookingIds: string[];
}

// --- Responses ---

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  key: string;
}

export interface PaymentVerifyResponse {
  success: boolean;
  paymentId: string;
  message: string;
}

export interface Refund {
  _id: string;
  payment: string;
  user: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface RefundListResponse {
  refunds: Refund[];
  total: number;
}

export interface Payout {
  _id: string;
  venueOwner: string;
  amount: number;
  status: PayoutStatus;
  bookings: string[];
  processedAt: string | null;
  createdAt: string;
}

export interface PayoutListResponse {
  payouts: Payout[];
  total: number;
}
