// API Client for FIRA Backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface RequestOptions extends RequestInit {
    token?: string;
}

class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // Get token from localStorage if not provided
    if (!token && typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('fira_token');
        if (storedToken) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${storedToken}`;
        }
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        // Handle 401 Unauthorized (Token expired, Invalid, or User Deleted)
        if (response.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('fira_token');
            localStorage.removeItem('fira_user');
            // Prevent redirect loop if already on login page
            if (!window.location.pathname.startsWith('/signin')) {
                window.location.href = '/signin';
            }
        }

        throw new ApiError(response.status, data.error || 'Something went wrong');
    }

    return data;
}

// Auth API
export const authApi = {
    register: (data: { email: string; password: string; name: string; role?: string }) =>
        request<{ success: boolean; message: string; email: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    verifyOTP: (data: { email: string; code: string }) =>
        request<{ user: unknown; token: string; message: string }>('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    resendOTP: (data: { email: string }) =>
        request<{ success: boolean; message: string; cooldownSeconds: number }>('/auth/resend-otp', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    login: (data: { email: string; password: string }) =>
        request<{ user: unknown; token: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    logout: () =>
        request<{ message: string }>('/auth/logout', {
            method: 'POST',
        }),

    getMe: () => request<{ user: unknown }>('/auth/me'),

    forgotPassword: (data: { email: string }) =>
        request<{ success: boolean; message: string; email?: string }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    verifyResetOTP: (data: { email: string; code: string }) =>
        request<{ success: boolean; message: string; resetToken: string }>('/auth/verify-reset-otp', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    resetPassword: (data: { resetToken: string; newPassword: string }) =>
        request<{ success: boolean; message: string }>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// Users API
export const usersApi = {
    getProfile: (id: string) => request(`/users/${id}`),
    updateProfile: (id: string, data: unknown) =>
        request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    followUser: (id: string) =>
        request(`/users/${id}/follow`, {
            method: 'POST',
        }),
    unfollowUser: (id: string) =>
        request(`/users/${id}/unfollow`, {
            method: 'POST',
        }),
};

const followedBrandsCache: Map<string, Set<string>> = new Map();
const followStatusPromises: Map<string, Promise<Set<string>>> = new Map();

// Brands API
export const brandsApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/brands${query}`);
    },
    getById: (id: string) => request(`/brands/${id}`),
    getMyProfile: (userId: string) => request(`/brands/my-profile?userId=${userId}`),
    create: (data: unknown) =>
        request('/brands', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    update: (id: string, data: unknown) =>
        request(`/brands/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Follow/Unfollow
    follow: async (brandId: string, userId: string) => {
        const res = await request(`/brands/${brandId}/follow`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        });
        const cache = followedBrandsCache.get(userId);
        if (cache) cache.add(brandId);
        return res;
    },
    unfollow: async (brandId: string, userId: string) => {
        const res = await request(`/brands/${brandId}/follow`, {
            method: 'DELETE',
            body: JSON.stringify({ userId }),
        });
        const cache = followedBrandsCache.get(userId);
        if (cache) cache.delete(brandId);
        return res;
    },
    getFollowStatus: async (brandId: string, userId: string) => {
        let cache = followedBrandsCache.get(userId);
        if (!cache) {
            let promise = followStatusPromises.get(userId);
            if (!promise) {
               // Fetch the user's profile which contains the followingBrands array
               promise = request<{ followingBrands?: string[] }>(`/users/${userId}`)
                   .then((u) => new Set(u.followingBrands || []))
                   .catch(() => new Set<string>()); // fallback on error
               followStatusPromises.set(userId, promise);
            }
            cache = await promise;
            followedBrandsCache.set(userId, cache);
            followStatusPromises.delete(userId);
        }
        return { isFollowing: cache.has(brandId) };
    },

    // Posts
    getPosts: (id: string, params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/brands/${id}/posts${query}`);
    },
    createPost: (brandId: string, data: { content: string; images?: string[]; userId: string }) =>
        request(`/brands/${brandId}/posts`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updatePost: (brandId: string, postId: string, data: { content?: string; images?: string[]; userId: string }) =>
        request(`/brands/${brandId}/posts/${postId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    deletePost: (brandId: string, postId: string, userId: string) =>
        request(`/brands/${brandId}/posts/${postId}`, {
            method: 'DELETE',
            body: JSON.stringify({ userId }),
        }),
    toggleLike: (brandId: string, postId: string, userId: string) =>
        request(`/brands/${brandId}/posts/${postId}/like`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        }),
    addComment: (brandId: string, postId: string, userId: string, content: string) =>
        request(`/brands/${brandId}/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ userId, content }),
        }),
    deleteComment: (brandId: string, postId: string, commentId: string, userId: string) =>
        request(`/brands/${brandId}/posts/${postId}/comments/${commentId}`, {
            method: 'DELETE',
            body: JSON.stringify({ userId }),
        }),

    getEvents: (id: string) => request(`/brands/${id}/events`),
};

// Venues API
export const venuesApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/venues${query}`);
    },
    getNearby: (lat: number, lng: number, radius?: number) => {
        const params = new URLSearchParams({
            lat: lat.toString(),
            lng: lng.toString(),
            ...(radius && { radius: radius.toString() }),
        });
        return request(`/venues/nearby?${params}`);
    },
    getUserVenues: (userId: string) => request(`/venues?owner=${userId}`),
    getById: (id: string) => request(`/venues/${id}`),
    create: (data: unknown) =>
        request('/venues', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    update: (id: string, data: unknown) =>
        request(`/venues/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    delete: (id: string) =>
        request(`/venues/${id}`, {
            method: 'DELETE',
        }),
    updateAvailability: (id: string, data: unknown) =>
        request(`/venues/${id}/availability`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    updateStatus: (id: string, status: string) =>
        request(`/venues/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        }),
    cancel: (id: string, reason?: string) =>
        request<{ venue: any; message: string }>(`/venues/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),
};

// Events API
export const eventsApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/events${query}`);
    },
    getUpcoming: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/events/upcoming${query}`);
    },
    getUserEvents: (userId: string) => request(`/events?organizer=${userId}`),
    getById: (id: string) => request(`/events/${id}`),
    create: (data: unknown) =>
        request('/events', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    update: (id: string, data: unknown) =>
        request(`/events/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    delete: (id: string) =>
        request(`/events/${id}`, {
            method: 'DELETE',
        }),
    cancel: (id: string, reason?: string) =>
        request<{
            event: any;
            refundResults: {
                totalTickets: number;
                refundsInitiated: number;
                refundsFailed: number;
                totalRefundAmount: number;
            };
        }>(`/events/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),
    requestAccess: (id: string, data: { code: string; userId: string }) =>
        request(`/events/${id}/access`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    handleAccessRequest: (eventId: string, requestId: string, status: string) =>
        request(`/events/${eventId}/access/${requestId}`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        }),
    // Venue owner approval
    getVenueRequests: (userId: string, params?: Record<string, string>) => {
        const query = new URLSearchParams({ userId, ...params }).toString();
        return request(`/events/venue-requests?${query}`);
    },
    venueApprove: (eventId: string, data: { venueOwnerId: string; status: 'approved' | 'rejected'; rejectionReason?: string }) =>
        request(`/events/${eventId}/venue-approve`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    // Admin approval
    getAdminPending: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/events/admin-pending${query}`);
    },
    adminApprove: (eventId: string, data: { adminId: string; status: 'approved' | 'rejected'; rejectionReason?: string }) =>
        request(`/events/${eventId}/admin-approve`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Event Posts
    getPosts: (eventId: string, params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/events/${eventId}/posts${query}`);
    },
    createPost: (eventId: string, data: { content: string; images?: string[]; userId: string }) =>
        request(`/events/${eventId}/posts`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updatePost: (eventId: string, postId: string, data: { content?: string; images?: string[]; userId: string }) =>
        request(`/events/${eventId}/posts/${postId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    deletePost: (eventId: string, postId: string, userId: string) =>
        request(`/events/${eventId}/posts/${postId}`, {
            method: 'DELETE',
            body: JSON.stringify({ userId }),
        }),
    toggleLike: (eventId: string, postId: string, userId: string) =>
        request(`/events/${eventId}/posts/${postId}/like`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        }),
    addComment: (eventId: string, postId: string, userId: string, content: string) =>
        request(`/events/${eventId}/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ userId, content }),
        }),
    deleteComment: (eventId: string, postId: string, commentId: string, userId: string) =>
        request(`/events/${eventId}/posts/${postId}/comments/${commentId}`, {
            method: 'DELETE',
            body: JSON.stringify({ userId }),
        }),
};

// Bookings API
export const bookingsApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/bookings${query}`);
    },
    getUserBookings: (userId: string) => request(`/bookings/user/${userId}`),
    getVenueBookings: (venueId: string) => request(`/bookings/venue/${venueId}`),
    getById: (id: string) => request(`/bookings/${id}`),
    create: (data: unknown) =>
        request('/bookings', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    update: (id: string, data: unknown) =>
        request(`/bookings/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    updateStatus: (id: string, status: string, reason?: string) =>
        request(`/bookings/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, reason }),
        }),
    cancel: (id: string, userId: string, reason?: string) =>
        request<{
            booking: any;
            refund: any | null;
        }>(`/bookings/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ userId, reason }),
        }),
    initiatePayment: (id: string, userId: string) =>
        request<{
            gatewayOrderId: string;
            keyId: string;
            amount: number;
            currency: string;
            payment: { _id: string };
            booking: { _id: string; venueName: string; totalAmount: number };
        }>(`/bookings/${id}/initiate-payment`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        }),
    verifyPayment: (id: string, data: { gatewayOrderId: string; gatewayPaymentId: string; gatewaySignature: string }) =>
        request(`/bookings/${id}/verify-payment`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// Tickets API
export const ticketsApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/tickets${query}`);
    },
    getUserTickets: (userId: string) => request(`/tickets/user/${userId}`),
    getEventTickets: (eventId: string) => request(`/tickets/event/${eventId}`),
    getById: (id: string) => request(`/tickets/${id}`),
    purchase: (data: { eventId: string; quantity: number; ticketType?: string; userId: string; paymentId?: string }) =>
        request<{
            success?: boolean;
            ticket?: any;
            paymentRequired?: boolean;
            paymentData?: any
        }>('/tickets', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    validate: (ticketId: string, qrCode: string) =>
        request(`/tickets/${ticketId}/validate`, {
            method: 'POST',
            body: JSON.stringify({ qrCode }),
        }),
    cancel: (ticketId: string, userId: string, reason?: string) =>
        request<{
            ticket: any;
            refund: any | null;
            refundEligibility: {
                amount: number;
                refundType: string;
                policy: string;
                refundPercentage: number;
            };
        }>(`/tickets/${ticketId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ userId, reason }),
        }),
    checkRefundEligibility: (ticketId: string) =>
        request<{
            eligible: boolean;
            reason: string;
            refundAmount: number;
            originalAmount: number;
            refundPercentage: number;
            policy: string;
            eventDate: string;
        }>(`/tickets/${ticketId}/refund-eligibility`),
};

// Payments API
export const paymentsApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/payments${query}`);
    },
    getUserPayments: (userId: string) => request(`/payments/user/${userId}`),
    getById: (id: string) => request(`/payments/${id}`),
    initiatePayment: (data: unknown) =>
        request('/payments/initiate', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    verifyPayment: (data: unknown) =>
        request('/payments/verify', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    requestRefund: (id: string, data?: unknown) =>
        request(`/payments/${id}/refund`, {
            method: 'POST',
            body: JSON.stringify(data || {}),
        }),
    getPayouts: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/payments/payouts/all${query}`);
    },
    // Refund-related methods
    getAllRefunds: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request<{
            refunds: any[];
            totalPages: number;
            currentPage: number;
            total: number;
        }>(`/payments/refunds${query}`);
    },
    getUserRefunds: (userId: string) =>
        request<any[]>(`/payments/refunds/user/${userId}`),
    getRefundById: (id: string) =>
        request<any>(`/payments/refunds/${id}`),
};

// Notifications API
export const notificationsApi = {
    getAll: (userId?: string) => {
        const query = userId ? `?userId=${userId}` : '';
        return request(`/notifications${query}`);
    },
    getUserNotifications: (userId: string) => request(`/notifications?userId=${userId}`),
    getUnreadCount: (userId: string) => request<{ count: number }>(`/notifications/unread?userId=${userId}`),
    getById: (id: string) => request(`/notifications/${id}`),
    markAsRead: (id: string) =>
        request(`/notifications/${id}/read`, {
            method: 'PUT',
        }),
    markAllAsRead: (userId: string) =>
        request('/notifications/read-all', {
            method: 'PUT',
            body: JSON.stringify({ userId }),
        }),
    delete: (id: string) =>
        request(`/notifications/${id}`, {
            method: 'DELETE',
        }),
};

// Verification API
export const verificationApi = {
    getAll: () => request('/verification'),
    getById: (id: string) => request(`/verification/${id}`),
    apply: (data: unknown) =>
        request('/verification/apply', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    review: (id: string, data: { status: string; notes?: string }) =>
        request(`/verification/${id}/review`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};

// Upload API (uses FormData, not JSON)
export const uploadApi = {
    single: async (file: File, folder = 'events'): Promise<{ url: string; publicId: string }> => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('folder', folder);

        const token = typeof window !== 'undefined' ? localStorage.getItem('fira_token') : null;
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/upload/single`, {
            method: 'POST',
            headers,
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        return response.json();
    },
    multiple: async (files: File[], folder = 'events'): Promise<{ images: { url: string; publicId: string }[] }> => {
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));
        formData.append('folder', folder);

        const token = typeof window !== 'undefined' ? localStorage.getItem('fira_token') : null;
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/upload/multiple`, {
            method: 'POST',
            headers,
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        return response.json();
    },
    delete: async (publicId: string): Promise<{ success: boolean }> => {
        return request('/upload/delete', {
            method: 'DELETE',
            body: JSON.stringify({ publicId }),
        });
    },
};

// Dashboard API
export interface DashboardStats {
    eventsOrganizing: number;
    upcomingEventsOrganizing: number;
    eventsAttending: number;
    activeTickets: number;
    venuesOwned: number;
    activeBookings: number;
    totalBookings: number;
    totalAttendees: number;
    totalRevenue: number;
    hasBrandProfile: boolean;
}

export interface DashboardEvent {
    _id: string;
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    images: string[];
    venue: {
        _id: string;
        name: string;
        address: {
            street: string;
            city: string;
            state: string;
        };
    };
    currentAttendees: number;
    maxAttendees: number;
    ticketPrice: number;
    status: string;
    isFeatured: boolean;
}

export interface DashboardVenue {
    _id: string;
    name: string;
    images: string[];
    address: {
        street: string;
        city: string;
        state: string;
    };
    status: string;
    capacity: {
        min: number;
        max: number;
    };
    pricing: {
        basePrice: number;
        currency: string;
    };
    rating: {
        average: number;
        count: number;
    };
}

export interface DashboardActivity {
    _id: string;
    title: string;
    message: string;
    category: string;
    isRead: boolean;
    createdAt: string;
}

export interface DashboardOverview {
    stats: DashboardStats;
    recentActivity: DashboardActivity[];
    upcomingEventsAttending: {
        _id: string;
        ticketId: string;
        event: {
            _id: string;
            name: string;
            date: string;
            startTime: string;
            endTime: string;
            images: string[];
            status: string;
            venue?: {
                name: string;
                address: { city: string };
            };
        };
        status: string;
        quantity: number;
        purchasedAt: string;
    }[];
    organizedEvents: DashboardEvent[];
    venues: DashboardVenue[];
    brandProfile: {
        _id: string;
        name: string;
        type: string;
        profilePhoto: string;
        followers: number;
        events: number;
    } | null;
}

export const dashboardApi = {
    getOverview: (userId: string) =>
        request<DashboardOverview>(`/dashboard/overview/${userId}`),

    getQuickStats: (userId: string) =>
        request<{
            eventsOrganizing: number;
            activeTickets: number;
            venuesOwned: number;
            activeBookings: number;
        }>(`/dashboard/stats/${userId}`),
};

export { ApiError };
