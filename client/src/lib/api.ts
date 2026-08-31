// API Client for FIRA Backend

import { API_BASE_URL } from '@/lib/siteConfig';

interface RequestOptions extends RequestInit {
    token?: string;
}

class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

const globalRequestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();
const CACHE_TTL = 15000; // 15-second deduplication window for navigation between dashboard pages

/**
 * Drop cached GETs so the next read hits the server.
 *
 * Without this, saving something and then refetching it inside the 15s window
 * returns the pre-save response - the write succeeds but the UI shows the old
 * values. Call it after a mutation with the endpoint prefix it affects.
 */
export function clearRequestCache(prefix?: string) {
    if (!prefix) {
        globalRequestCache.clear();
        return;
    }
    for (const key of globalRequestCache.keys()) {
        if (key.startsWith(prefix)) globalRequestCache.delete(key);
    }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;
    const isGet = !fetchOptions.method || fetchOptions.method.toUpperCase() === 'GET';
    
    // Create a cache key unique to the endpoint and the user's token
    let userToken = token;
    if (!userToken && typeof window !== 'undefined') {
        userToken = localStorage.getItem('fira_token') || undefined;
    }
    const cacheKey = `${endpoint}_${userToken || 'unauth'}`;

    // Return cached promise if within TTL bounds
    if (isGet) {
        const cached = globalRequestCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.promise;
        }
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (userToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${userToken}`;
    }

    const fetchPromise = (async () => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...fetchOptions,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            // Handle 401 Unauthorized.
            //
            // A 401 from an /auth/ endpoint means "those credentials are wrong",
            // NOT "your session expired" - so it must not clear storage or
            // redirect. A wrong password must show an inline error, not bounce
            // the page.
            const isAuthAttempt = endpoint.startsWith('/auth/');

            if (response.status === 401 && !isAuthAttempt && typeof window !== 'undefined') {
                localStorage.removeItem('fira_token');
                localStorage.removeItem('fira_user');

                // The venue-owner auth space is retired: every non-auth 401
                // sends the browser to the Unified_Sign_In, regardless of the
                // current route.
                const target = '/signin';

                if (window.location.pathname !== target) {
                    window.location.href = target;
                }
            }

            throw new ApiError(response.status, data.error || 'Something went wrong');
        }

        return data as T;
    })();

    if (isGet) {
        globalRequestCache.set(cacheKey, { promise: fetchPromise, timestamp: Date.now() });
    }

    try {
        return await fetchPromise;
    } catch (error) {
        if (isGet) {
            globalRequestCache.delete(cacheKey);
        }
        throw error;
    }
}

// Auth API
export const authApi = {
    register: (data: { email: string; password: string; name: string; role?: string; city?: string }) =>
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

    changePassword: (data: { currentPassword: string; newPassword: string }) =>
        request<{ success: boolean; message: string }>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    registerVenueOwner: (data: {
        email: string;
        password: string;
        name: string;
        businessName?: string;
        businessPhone?: string;
        govIdType?: string;
        govIdNumber?: string;
        govIdDocument?: string;
        bankAccountName?: string;
        bankAccountNumber?: string;
        bankIfscCode?: string;
        bankName?: string;
    }) =>
        request<{ success: boolean; message: string; email: string }>('/auth/register-venue-owner', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Option A "become a host": upgrade the signed-in account to also hold the
    // venue_owner role. Token is attached automatically by `request`.
    becomeVenueOwner: (data: {
        businessName: string;
        businessPhone: string;
        govIdType?: string;
        govIdNumber?: string;
        govIdDocument?: string;
        bankAccountName?: string;
        bankAccountNumber?: string;
        bankIfscCode?: string;
        bankName?: string;
    }) =>
        request<{ user: unknown; token: string; message: string }>('/auth/become-venue-owner', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

/** A saved payout account. Exactly one in the list carries isDefault. */
export interface BankAccount {
    _id: string;
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    isDefault: boolean;
    createdAt?: string;
}

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
    getFollowingBrands: (userId: string) =>
        request<{
            brands: {
                _id: string;
                name: string;
                type: string;
                bio: string;
                profilePhoto: string | null;
                stats: { followers: number; events: number };
                user?: { _id: string; name: string };
            }[];
            count: number;
        }>(`/users/${userId}/following-brands`),
    /**
     * Legacy single-account write. Kept for the registration and
     * become-a-venue-owner flows that still submit one account inline; settings
     * uses the bank-accounts endpoints below.
     */
    updateBankDetails: (data: {
        accountName: string;
        accountNumber: string;
        ifscCode: string;
        bankName: string;
    }) =>
        request<{ bankDetails: { accountName: string; accountNumber: string; ifscCode: string; bankName: string } }>(
            '/users/me/bank-details',
            { method: 'PATCH', body: JSON.stringify(data) }
        ),
    /* Payout accounts. `bankDetails` above still exists and always mirrors
       whichever of these is the default, so payout-facing reads are unchanged. */
    listBankAccounts: () =>
        request<{ accounts: BankAccount[] }>('/users/me/bank-accounts'),
    addBankAccount: (data: {
        accountName: string;
        accountNumber: string;
        ifscCode: string;
        bankName: string;
        makeDefault?: boolean;
    }) =>
        request<{ accounts: BankAccount[] }>('/users/me/bank-accounts', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    setDefaultBankAccount: (accountId: string) =>
        request<{ accounts: BankAccount[] }>(`/users/me/bank-accounts/${accountId}/default`, {
            method: 'PATCH',
        }),
    deleteBankAccount: (accountId: string) =>
        request<{ accounts: BankAccount[] }>(`/users/me/bank-accounts/${accountId}`, {
            method: 'DELETE',
        }),
    // Delete the authenticated user's own account + associated data.
    // Server endpoint (DELETE /api/users/me) already exists; this just wires it.
    deleteAccount: () => request('/users/me', { method: 'DELETE' }),
};

const followedBrandsCache: Map<string, Set<string>> = new Map();
const followStatusPromises: Map<string, Promise<Set<string>>> = new Map();

// Brands API
export const brandsApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/brands${query}`);
    },
    getSections: (limit = '4') => request<{
        bands: any[]; brands: any[]; organizers: any[];
        trending: any[]; top: any[];
    }>(`/brands/sections?limit=${limit}`),
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

/** One city suggestion, already normalised and de-duplicated server-side. */
export interface CitySuggestion {
    /** Spelling to store and display. */
    city: string;
    /** Canonical slug - the value filters and city URLs match on. */
    slug: string;
    state: string;
    lat: number | null;
    lng: number | null;
}

/** A city that currently holds listings, with how many of each. */
export interface ListedCity extends Pick<CitySuggestion, 'city' | 'slug' | 'state'> {
    venues: number;
    events: number;
}

/**
 * Locations API — city lookup for the address forms and the city filter.
 *
 * The geocoder itself is called server-side, so the provider key never reaches
 * the browser and one cache serves every user.
 */
export const locationsApi = {
    searchCities: (q: string) =>
        request<{ results: CitySuggestion[]; source: string; minLength: number }>(
            `/locations/cities?q=${encodeURIComponent(q)}`
        ),
    /** Cities with at least one live listing. Drives the filters and city pages. */
    listed: () => request<{ cities: ListedCity[] }>('/locations/listed'),
};

// Venues API
export const venuesApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/venues${query}`);
    },
    getSections: () => request<{
        topRated: any[]; inDemand: any[]; latest: any[];
    }>('/venues/sections'),
    getNearby: (lat: number, lng: number, radius?: number) => {
        const params = new URLSearchParams({
            lat: lat.toString(),
            lng: lng.toString(),
            ...(radius && { radius: radius.toString() }),
        });
        return request(`/venues/nearby?${params}`);
    },
    getUserVenues: (userId: string) => request(`/venues?owner=${userId}`),
    getMyVenues: () => request(`/venues/my-venues`),
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
    // Venue status is admin-controlled via the admin API (adminApi), which hits
    // the guarded /admin/venues/:id/status route. No owner-facing status setter
    // exists by design - a venue owner must not be able to approve their own venue.
    cancel: (id: string, reason?: string) =>
        request<{ venue: any; message: string }>(`/venues/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),
    submitReview: (id: string, data: { rating: number; comment?: string }) =>
        request(`/venues/${id}/reviews`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    checkReviewEligibility: (id: string) =>
        request<{ eligible: boolean }>(`/bookings?venue=${id}&status=completed`),
};

/**
 * A door scanner link.
 *
 * `ticketTier` empty means the link admits every tier for the event; a tier name
 * means it admits only that tier and rejects the rest.
 */
export interface ScanningCode {
    _id: string;
    code: string;
    label: string;
    ticketTier: string;
    isActive: boolean;
    createdAt: string;
}

// Events API
export const eventsApi = {
    getAll: (params?: Record<string, string>) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return request(`/events${query}`);
    },
    getSections: () => request<{
        upcoming: any[]; top: any[]; latest: any[];
    }>('/events/sections'),
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

    // Scanning Codes
    getScanningCodes: (eventId: string) =>
        request<ScanningCode[]>(`/events/${eventId}/scanning-codes`),

    deactivateScanningCode: (eventId: string, codeId: string) =>
        request(`/events/${eventId}/scanning-codes/${codeId}/deactivate`, {
            method: 'PATCH',
        }),
};

// Discounts API
export const discountsApi = {
    list: (eventId: string) =>
        request<any[]>(`/discounts/events/${eventId}/discount-codes`),
    // No validity dates: the server derives the window from the event (usable from
    // creation until the event ends) and ignores any dates in the request.
    create: (eventId: string, data: { code: string; discountType: string; discountValue: number; maxUses: number | null }) =>
        request(`/discounts/events/${eventId}/discount-codes`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    edit: (codeId: string, data: Record<string, unknown>) =>
        request(`/discounts/discount-codes/${codeId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    deactivate: (codeId: string) =>
        request(`/discounts/discount-codes/${codeId}`, {
            method: 'DELETE',
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
    applyDiscount: (data: { code: string; eventId: string; subtotal: number }) =>
        request<{ discountAmount: number; discountType: string; discountValue: number; code: string }>(
            '/payments/apply-discount',
            { method: 'POST', body: JSON.stringify(data) }
        ),
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

    // --- Web Push ---
    getPushPublicKey: () =>
        request<{ publicKey: string }>('/notifications/push/public-key'),
    subscribePush: (subscription: PushSubscriptionJSON) =>
        request<{ success: boolean; message: string }>('/notifications/push/subscribe', {
            method: 'POST',
            body: JSON.stringify({ subscription }),
        }),
    unsubscribePush: (endpoint: string) =>
        request<{ success: boolean; removed: number }>('/notifications/push/unsubscribe', {
            method: 'POST',
            body: JSON.stringify({ endpoint }),
        }),
    sendTestPush: () =>
        request<{ success: boolean; sent: number }>('/notifications/push/test', {
            method: 'POST',
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

/**
 * Read an upload response as JSON, but survive the body NOT being JSON.
 *
 * The upload route always answers JSON, so an HTML body means the request never
 * reached it - a proxy 413/502, a dev-server 404, or a multer error hitting
 * Express's default (HTML) error handler. Calling response.json() on that threw
 * "Unexpected token '<', "<!DOCTYPE"..." which tells the user nothing. This reads
 * the text first and, when it will not parse, throws the HTTP status instead, so
 * the toast says something actionable like "Upload failed (502)".
 */
async function readUploadResponse<T>(response: Response, token: string | null): Promise<T> {
    const raw = await response.text();
    let parsed: unknown = null;
    try {
        parsed = raw ? JSON.parse(raw) : null;
    } catch {
        // Body was not JSON (almost always an HTML error page).
        if (!response.ok) {
            const hint = response.status === 401 || response.status === 403
                ? token ? 'your session may have expired' : 'you need to sign in'
                : response.status === 413
                    ? 'the image is too large'
                    : 'the server returned an unexpected response';
            throw new Error(`Upload failed (${response.status}) - ${hint}`);
        }
        throw new Error('Upload succeeded but the server response could not be read');
    }

    if (!response.ok) {
        const message = (parsed as { error?: string })?.error || `Upload failed (${response.status})`;
        throw new Error(message);
    }
    return parsed as T;
}

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

        return readUploadResponse<{ url: string; publicId: string }>(response, token);
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

        return readUploadResponse<{ images: { url: string; publicId: string }[] }>(response, token);
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
        /** Review state of the creator application. Mirrors BrandProfile.status. */
        status: 'pending' | 'approved' | 'rejected' | 'blocked';
        profilePhoto: string;
        /** Landscape cover image (16:9), same field the creator page banner uses. */
        coverPhoto?: string | null;
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

// Messages/Chat API
export interface Conversation {
    _id: string;
    participants: Array<{
        _id: string;
        name: string;
        avatar?: string;
        email: string;
    }>;
    brand?: {
        _id: string;
        name: string;
        profilePhoto?: string;
        type: string;
        user?: string;
    };
    /** Set when this thread came from an event/venue enquiry. */
    inquiry?: string | null;
    /**
     * Denormalized enquiry header: who asked, how to reach them, and which
     * listing it is about. Written once when the thread is created.
     */
    inquiryContext?: {
        referenceType?: 'event' | 'venue' | null;
        referenceId?: string | null;
        referenceName?: string | null;
        referenceImage?: string | null;
        senderName?: string | null;
        senderEmail?: string | null;
        senderPhone?: string | null;
    } | null;
    lastMessage: {
        content: string;
        sender: string;
        timestamp: string;
    };
    unreadCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface Message {
    _id: string;
    conversation: string;
    sender: {
        _id: string;
        name: string;
        avatar?: string;
    };
    content: string;
    messageType: 'text' | 'image' | 'system';
    imageUrl?: string;
    isRead: boolean;
    readAt?: string | null;
    createdAt: string;
    /**
     * Client-only delivery state for optimistic bubbles. Absent on anything that
     * came back from the server, which is by definition already sent.
     */
    pending?: boolean;
    failed?: boolean;
}

export const messagesApi = {
    /**
     * A page of conversations, newest activity first. Page-based because the inbox
     * shows a "page X of Y" control, which needs a total count.
     */
    getConversations: (opts: { page?: number; limit?: number } = {}) => {
        const params = new URLSearchParams({
            page: String(opts.page ?? 1),
            limit: String(opts.limit ?? 20),
        });
        return request<{
            success: boolean;
            conversations: Conversation[];
            pagination: { page: number; limit: number; total: number; totalPages: number };
        }>(`/messages/conversations?${params.toString()}`);
    },

    /**
     * Newest page of a thread, or the page immediately older than `before`.
     * `before` is the createdAt of the oldest message already held - a cursor
     * rather than an offset, so pages stay stable while new messages arrive.
     */
    getMessages: (conversationId: string, opts: { before?: string; limit?: number } = {}) => {
        const params = new URLSearchParams({ limit: String(opts.limit ?? 30) });
        if (opts.before) params.set('before', opts.before);
        return request<{
            success: boolean;
            conversation: Conversation;
            messages: Message[];
            pagination: { limit: number; hasMore: boolean; nextBefore: string | null };
        }>(`/messages/conversations/${conversationId}?${params.toString()}`);
    },

    sendMessage: (data: {
        conversationId?: string;
        receiverId?: string;
        brandId?: string;
        content: string;
        messageType?: string;
        imageUrl?: string;
    }) =>
        request<{ success: boolean; message: Message; conversationId: string }>('/messages/send', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    startBrandEnquiry: (data: { brandId: string; message?: string }) =>
        request<{ success: boolean; conversation: Conversation }>('/messages/start-brand-enquiry', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Find-or-create a conversation between the inquiry sender and the reference
    // (event/venue) owner, bound to the inquiry.
    // Takes the inquiry's own id: the server resolves referenceType/referenceId
    // (and from those the owner) off the stored Inquiry, so the caller cannot
    // point a conversation at a reference it never actually enquired about.
    // This previously sent { referenceType, referenceId } and every call failed
    // its 400 guard, which is why submitting an enquiry never opened a chat.
    startInquiryConversation: (data: {
        inquiryId: string;
        message?: string;
    }) =>
        request<{ success: boolean; conversation: Conversation }>('/messages/start-inquiry-conversation', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getUnreadCount: () =>
        request<{ success: boolean; unreadCount: number }>('/messages/unread-count'),

    archiveConversation: (conversationId: string) =>
        request<{ success: boolean; message: string }>(`/messages/conversations/${conversationId}`, {
            method: 'DELETE',
        }),
};

// Inquiries API
export const inquiriesApi = {
    // Sender identity is derived from the authenticated account server-side, so
    // there is nothing to send but the reference and the question. The old
    // senderName/senderEmail/senderPhone fields were discarded by the server.
    submit: (data: {
        referenceType: 'event' | 'venue';
        referenceId: string;
        message: string;
    }) =>
        request<{ _id: string; referenceType: string; referenceId: string; status: string }>('/inquiries', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// Earnings API
// Read-only per-event / per-venue earnings breakdowns. Both routes are behind
// requireAuth() and enforce ownership server-side (organizer / venue owner),
// returning the DTO verbatim. All monetary values are integer rupees.
export type EarningsPayoutStatus =
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'not yet initiated';

export interface EventEarningsDTO {
    grossTicketSales: number;
    platformCommissionDeducted: number;
    gst: number;
    netEarnings: number;
    payoutStatus: EarningsPayoutStatus;
}

export interface VenueEarningsBooking {
    bookingId: string;
    grossBookingAmount: number;
    advancePaid: number;
    commissionDeducted: number;
    netPayable: number;
    balanceOutstanding: boolean;
    payoutStatus: EarningsPayoutStatus;
}

export interface VenueEarningsDTO {
    venueId: string;
    bookings: VenueEarningsBooking[];
}

export const earningsApi = {
    getEventEarnings: (eventId: string) =>
        request<EventEarningsDTO>(`/events/${eventId}/earnings`),
    getVenueEarnings: (venueId: string) =>
        request<VenueEarningsDTO>(`/venues/${venueId}/earnings`),
};

// Settlement API
// Read-only per-listing settlement mirror for the listing owner. Both routes are
// behind auth and enforce ownership server-side, returning the owner DTO
// verbatim. There is no write method here by design: creating, editing,
// reversing and disputing an entry are admin-only (Requirement 9.6).
export type SettlementState =
    | 'not_settled'
    | 'partially_settled'
    | 'fully_settled'
    | 'over_settled';

/**
 * One settlement the owner received. This mirrors the server's owner whitelist
 * (`settlementService.toOwnerRow`) exactly - no admin notes, no override reason,
 * no administrator identity. A reversed entry is still listed, flagged, and
 * already excluded from `settledToDate`.
 */
export interface OwnerSettlementEntry {
    settledAmount: number;
    settlementReference: string;
    settledAt: string;
    reversed: boolean;
}

export interface OwnerSettlementDTO {
    listing: { kind: 'event' | 'venue'; id: string; name: string };
    /** Owner-side figures only; the buyer-side breakdown is platform accounting. */
    money: {
        ownerGross: number;
        platformCommission: number;
        netPayable: number;
        settledToDate: number;
        outstandingAmount: number;
        refundedTotal: number;
    };
    activity: {
        successfulPayments: number;
        unitsSold: number;
        confirmed: number;
        cancelled: number;
        refundedPayments: number;
        lastPaymentAt: string | null;
    };
    state: SettlementState;
    entries: OwnerSettlementEntry[];
}

export const settlementApi = {
    getEventSettlement: (eventId: string) =>
        request<OwnerSettlementDTO>(`/events/${eventId}/settlement`),
    getVenueSettlement: (venueId: string) =>
        request<OwnerSettlementDTO>(`/venues/${venueId}/settlement`),
};

export { ApiError };
