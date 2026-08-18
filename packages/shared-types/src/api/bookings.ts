export type BookingType = 'event' | 'personal';
export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

// --- Requests ---

export interface CreateBookingRequest {
  venue: string;
  event?: string;
  bookingType?: BookingType;
  bookingDate: string;
  startTime: string;
  endTime: string;
  purpose?: string;
  expectedGuests?: number;
  specialRequests?: string;
}

export interface RespondBookingRequest {
  status: 'accepted' | 'rejected';
  rejectionReason?: string;
  modifiedDates?: {
    bookingDate?: string;
    startTime?: string;
    endTime?: string;
  };
}

export interface ListBookingsQuery {
  page?: number;
  limit?: number;
  status?: BookingStatus;
}

// --- Responses ---

export interface Booking {
  _id: string;
  user: string;
  venue: string;
  event: string | null;
  bookingType: BookingType;
  bookingDate: string;
  startTime: string;
  endTime: string;
  purpose: string | null;
  expectedGuests: number;
  specialRequests: string | null;
  status: BookingStatus;
  rejectionReason: string | null;
  totalAmount: number;
  platformFee: number;
  paymentStatus: PaymentStatus;
  payment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingListResponse {
  bookings: Booking[];
  total: number;
  page: number;
  pages: number;
}

export interface BookingDetailResponse {
  booking: Booking;
}

export interface BookingCreateResponse {
  booking: Booking;
  message: string;
}
