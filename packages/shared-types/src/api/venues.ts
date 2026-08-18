import type { Venue, VenueType, VenueStatus } from '../models/venue';

// --- Requests ---

export interface CreateVenueRequest {
  name: string;
  venueType?: VenueType;
  description: string;
  capacity: { min?: number; max: number };
  pricing: { basePrice: number; pricePerHour?: number; currency?: string };
  amenities?: string[];
  rules?: string[];
  location: { coordinates: [number, number] };
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  };
  availability?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable?: boolean;
  }>;
  locationLink?: string;
  autoApproveBookings?: boolean;
}

export interface UpdateVenueRequest extends Partial<CreateVenueRequest> {
  status?: VenueStatus;
}

export interface ListVenuesQuery {
  page?: number;
  limit?: number;
  city?: string;
  venueType?: VenueType;
  status?: VenueStatus;
  minCapacity?: number;
  maxPrice?: number;
  search?: string;
}

// --- Responses ---

export interface VenueListResponse {
  venues: Venue[];
  total: number;
  page: number;
  pages: number;
}

export interface VenueDetailResponse {
  venue: Venue;
}

export interface VenueCreateResponse {
  venue: Venue;
  message: string;
}
