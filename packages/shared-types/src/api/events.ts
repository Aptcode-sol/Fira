import type { Event, EventCategory, EventStatus, EventType, TicketType } from '../models/event';

// --- Requests ---

export interface CreateEventRequest {
  name: string;
  description: string;
  venue?: string;
  startDateTime: string;
  endDateTime: string;
  eventType?: EventType;
  ticketType?: TicketType;
  ticketPrice?: number;
  maxAttendees: number;
  category?: EventCategory;
  tags?: string[];
  friendsAndFamilyStay?: boolean;
  allowAlcohol?: boolean;
  customVenue?: {
    isCustom: boolean;
    name?: string;
    description?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    capacity?: number;
    locationLink?: string;
  };
  termsAndConditions?: string;
}

export interface UpdateEventRequest extends Partial<CreateEventRequest> {
  status?: EventStatus;
}

export interface ListEventsQuery {
  page?: number;
  limit?: number;
  category?: EventCategory;
  eventType?: EventType;
  status?: EventStatus;
  city?: string;
  search?: string;
}

// --- Responses ---

export interface EventListResponse {
  events: Event[];
  total: number;
  page: number;
  pages: number;
}

export interface EventDetailResponse {
  event: Event;
}

export interface EventCreateResponse {
  event: Event;
  message: string;
}
