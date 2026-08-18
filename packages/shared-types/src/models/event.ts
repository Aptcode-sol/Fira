export type EventType = 'public' | 'private';
export type TicketType = 'free' | 'paid';
export type EventCategory =
  | 'party' | 'concert' | 'wedding' | 'corporate' | 'birthday'
  | 'festival' | 'music' | 'dance' | 'dj' | 'clubbing' | 'fitness' | 'other';
export type EventStatus =
  | 'draft' | 'pending' | 'upcoming' | 'approved' | 'ongoing'
  | 'completed' | 'cancelled' | 'rejected' | 'blocked';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalInfo {
  status: ApprovalStatus;
  respondedAt?: string;
  respondedBy?: string;
  rejectionReason?: string;
}

export interface CustomVenue {
  isCustom: boolean;
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  capacity?: number;
  images?: string[];
  locationLink?: string;
}

export interface Event {
  _id: string;
  organizer: string;
  venue: string | null;
  booking: string | null;
  name: string;
  description: string;
  images: string[];
  startDateTime: string;
  endDateTime: string;
  eventType: EventType;
  ticketType: TicketType;
  ticketPrice: number;
  maxAttendees: number;
  currentAttendees: number;
  privateCode: string | null;
  category: EventCategory;
  tags: string[];
  friendsAndFamilyStay: boolean;
  allowAlcohol: boolean;
  customVenue: CustomVenue;
  termsAndConditions: string | null;
  status: EventStatus;
  venueApproval: ApprovalInfo;
  adminApproval: ApprovalInfo;
  isActive: boolean;
  isDeleted: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}
