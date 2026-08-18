export type VenueType =
  | 'banquet' | 'hall' | 'outdoor' | 'restaurant' | 'club'
  | 'resort' | 'farmhouse' | 'rooftop' | 'garden' | 'beach' | 'other';
export type VenueStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface VenueCapacity {
  min: number;
  max: number;
}

export interface VenuePricing {
  basePrice: number;
  pricePerHour: number | null;
  currency: string;
}

export interface VenueAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface VenueAvailability {
  dayOfWeek: number; // 0-6, 0 = Sunday
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface VenueRating {
  average: number;
  count: number;
}

export interface Venue {
  _id: string;
  owner: string;
  name: string;
  venueType: VenueType;
  description: string;
  images: string[];
  videos: string[];
  capacity: VenueCapacity;
  pricing: VenuePricing;
  amenities: string[];
  rules: string[];
  location: GeoPoint;
  address: VenueAddress;
  availability: VenueAvailability[];
  status: VenueStatus;
  rating: VenueRating;
  isActive: boolean;
  isDeleted: boolean;
  locationLink: string;
  autoApproveBookings: boolean;
  createdAt: string;
  updatedAt: string;
}
