// TypeScript interfaces for FIRA platform

// User Types
export interface User {
    _id: string;
    email: string;
    name: string;
    avatar: string | null;
    phone: string | null;
    role: 'user' | 'venue_owner' | 'admin';
    isVerified: boolean;
    emailVerified: boolean;
    emailVerifiedAt?: string;
    verificationBadge: 'none' | 'brand' | 'band' | 'organizer';
    socialLinks: {
        instagram: string | null;
        twitter: string | null;
        facebook: string | null;
        website: string | null;
    };
    followers: string[];
    following: string[];
    bankDetails: {
        accountName: string | null;
        accountNumber: string | null;
        ifscCode: string | null;
        bankName: string | null;
    };
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// Venue Types
export interface Venue {
    _id: string;
    owner: string | User;
    name: string;
    description: string;
    images: string[];
    videos: string[];
    capacity: {
        min: number;
        max: number;
    };
    pricing: {
        basePrice: number;
        pricePerHour: number | null;
        currency: string;
    };
    amenities: string[];
    rules: string[];
    location: {
        type: 'Point';
        coordinates: [number, number]; // [longitude, latitude]
    };
    address: {
        street: string;
        city: string;
        state: string;
        pincode: string;
        country: string;
    };
    availability: {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        isAvailable: boolean;
    }[];
    blockedDates: {
        date: string;
        reason: string;
    }[];
    status: 'pending' | 'approved' | 'rejected' | 'suspended';
    rating: {
        average: number;
        count: number;
    };
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// Event Types
export interface Event {
    _id: string;
    organizer: string | User;
    venue: string | Venue;
    booking: string | null;
    name: string;
    description: string;
    images: string[];
    date: string;
    endDate?: string;
    startTime: string;
    endTime: string;
    eventType: 'public' | 'private';
    ticketType: 'free' | 'paid';
    ticketPrice: number;
    maxAttendees: number;
    currentAttendees: number;
    privateCode: string | null;
    category: 'party' | 'concert' | 'wedding' | 'corporate' | 'birthday' | 'festival' | 'other';
    tags: string[];
    termsAndConditions?: string;
    status: 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | 'approved';
    isFeatured: boolean;
    createdAt: string;
    updatedAt: string;
}

// Booking Types
export interface Booking {
    _id: string;
    user: string | User;
    venue: string | Venue;
    event: string | Event | null;
    bookingDate: string;
    startTime: string;
    endTime: string;
    purpose: string | null;
    expectedGuests: number;
    specialRequests: string | null;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
    rejectionReason: string | null;
    totalAmount: number;
    platformFee: number;
    paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
    payment: string | null;
    ownerResponse: {
        respondedAt: string | null;
        modifiedDates: {
            bookingDate: string | null;
            startTime: string | null;
            endTime: string | null;
        };
    };
    createdAt: string;
    updatedAt: string;
}

// Ticket Types
export interface Ticket {
    _id: string;
    ticketId: string;
    user: string | User;
    event: string | Event;
    qrCode: string;
    ticketType: 'general' | 'vip' | 'early_bird';
    price: number;
    quantity: number;
    payment: string | null;
    purchaseDate: string;
    isUsed: boolean;
    usedAt: string | null;
    checkedInBy: string | null;
    status: 'active' | 'used' | 'cancelled' | 'expired';
    createdAt: string;
    updatedAt: string;
}

// Payment Types
export interface Payment {
    _id: string;
    user: string | User;
    type: 'venue_booking' | 'ticket_purchase';
    referenceId: string;
    referenceModel: 'Booking' | 'Ticket';
    amount: number;
    platformFee: number;
    platformFeePercentage: number;
    netAmount: number;
    currency: string;
    paymentMethod: 'upi' | 'card' | 'netbanking' | 'wallet' | null;
    gatewayTransactionId: string | null;
    gatewayOrderId: string | null;
    status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded';
    paidAt: string | null;
    failureReason: string | null;
    createdAt: string;
    updatedAt: string;
}

// Notification Types
export interface Notification {
    _id: string;
    user: string;
    type: string;
    title: string;
    message: string;
    data: Record<string, unknown>;
    isRead: boolean;
    createdAt: string;
}

// Verification Request Types
export interface VerificationRequest {
    _id: string;
    user: string | User;
    type: 'brand' | 'band' | 'organizer';
    name: string;
    description: string;
    documents: string[];
    socialLinks: {
        instagram: string | null;
        twitter: string | null;
        facebook: string | null;
        website: string | null;
    };
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy: string | null;
    reviewNotes: string | null;
    createdAt: string;
    updatedAt: string;
}

// API Response Types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface RegisterResponse {
    success: boolean;
    message: string;
    email: string;
}

export interface OTPVerifyResponse {
    user: User;
    token: string;
    message: string;
}

export interface ResendOTPResponse {
    success: boolean;
    message: string;
    cooldownSeconds: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
