const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/admin';
const MAIN_API_BASE = API_BASE.replace(/\/admin$/, '');

export const ADMIN_TOKEN_KEY = 'fira_admin_token';

/**
 * Every admin request now carries the JWT issued by /api/auth/login. The
 * server checks the token AND the admin role, so nothing here is a security
 * boundary - it just avoids pointless 401s.
 */
function authHeaders(extra = {}) {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    return {
        ...extra,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

/**
 * Single place where responses are turned into data or errors.
 *
 * A 401/403 means the session is gone or the account is not an admin; clearing
 * the token and reloading drops the user back to the login screen instead of
 * leaving a dashboard full of silently failing panels.
 */
async function handle(res, fallbackMessage) {
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem('fira_admin_auth');
        if (typeof window !== 'undefined') window.location.reload();
        throw new Error('Your admin session has expired. Please sign in again.');
    }
    if (!res.ok) {
        let message = fallbackMessage;
        let body = null;
        try {
            body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // non-JSON error body; keep the fallback
        }
        const error = new Error(message);
        // Structured rejections (e.g. the settlement over-settlement guard, which
        // returns code/netPayable/maxRecordable) are unusable if only the message
        // survives. Callers that don't care keep reading `.message` as before.
        error.status = res.status;
        error.body = body;
        throw error;
    }
    return res.json();
}

const adminApi = {
    // ================== AUTH ==================
    async login(email, password) {
        const res = await fetch(`${MAIN_API_BASE}/auth/login`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ email, password }),
        });
        const data = await handle(res, 'Invalid email or password');
        if (data?.token) localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        return data;
    },

    logout() {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
    },
    // ================== DASHBOARD ==================
    async getStats() {
        const res = await fetch(`${API_BASE}/stats`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch stats');
    },

    // ================== USERS ==================
    async getUsers(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/users?${query}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch users');
    },

    async getUserById(userId) {
        const res = await fetch(`${API_BASE}/users/${userId}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch user');
    },

    async blockUser(userId) {
        const res = await fetch(`${API_BASE}/users/${userId}/block`, { method: 'PUT', headers: authHeaders() });
        return handle(res, 'Failed to block user');
    },

    async unblockUser(userId) {
        const res = await fetch(`${API_BASE}/users/${userId}/unblock`, { method: 'PUT', headers: authHeaders() });
        return handle(res, 'Failed to unblock user');
    },

    async deleteUser(userId) {
        const res = await fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE', headers: authHeaders() });
        return handle(res, 'Failed to delete user');
    },

    // ================== VENUES ==================
    async getVenues(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/venues?${query}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch venues');
    },

    async getVenueById(venueId) {
        const res = await fetch(`${API_BASE}/venues/${venueId}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch venue');
    },

    async getVenueOwners(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/venue-owners?${query}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch venue owners');
    },

    async updateVenueStatus(venueId, status) {
        const res = await fetch(`${API_BASE}/venues/${venueId}/status`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ status })
        });
        return handle(res, 'Failed to update venue status');
    },

    async deleteVenue(venueId) {
        const res = await fetch(`${API_BASE}/venues/${venueId}`, { method: 'DELETE', headers: authHeaders() });
        return handle(res, 'Failed to delete venue');
    },

    // ================== EVENTS ==================
    async getEvents(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/events?${query}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch events');
    },

    async getEventById(eventId) {
        const res = await fetch(`${API_BASE}/events/${eventId}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch event');
    },

    async updateEventStatus(eventId, status) {
        const res = await fetch(`${API_BASE}/events/${eventId}/status`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ status })
        });
        return handle(res, 'Failed to update event status');
    },

    async deleteEvent(eventId) {
        const res = await fetch(`${API_BASE}/events/${eventId}`, { method: 'DELETE', headers: authHeaders() });
        return handle(res, 'Failed to delete event');
    },

    async toggleFeatured(eventId, isFeatured) {
        const res = await fetch(`${API_BASE}/events/${eventId}/featured`, {
            method: 'PATCH',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ isFeatured })
        });
        return handle(res, 'Failed to update featured status');
    },

    // Get events pending admin approval (venue already approved)
    async getPendingEventApprovals(params = {}) {
        const query = new URLSearchParams(params).toString();
        // Use main API endpoint for pending events
        const res = await fetch(`${MAIN_API_BASE}/events/admin-pending?${query}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch pending events');
    },

    // Admin approve/reject event
    async adminApproveEvent(eventId, adminId, status, rejectionReason) {
        const res = await fetch(`${MAIN_API_BASE}/events/${eventId}/admin-approve`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ adminId, status, rejectionReason })
        });
        return handle(res, 'Failed to approve event');
    },

    // ================== BRANDS ==================
    async getBrands(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/brands?${query}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch brands');
    },

    async getBrandById(brandId) {
        const res = await fetch(`${API_BASE}/brands/${brandId}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch brand');
    },

    async updateBrandStatus(brandId, status) {
        const res = await fetch(`${API_BASE}/brands/${brandId}/status`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ status })
        });
        return handle(res, 'Failed to update brand status');
    },

    // ================== AUDIT TRAIL ==================
    async getAuditTrail(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/audit-trail?${query}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch audit trail');
    },

    // ================== EARNINGS & PAYOUTS (read-only) ==================
    async getEarningsOverview({ from, to } = {}) {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const query = params.toString();
        const res = await fetch(`${API_BASE}/earnings/overview${query ? `?${query}` : ''}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch earnings overview');
    },

    async getEarningsRecipients({ from, to } = {}) {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const query = params.toString();
        const res = await fetch(`${API_BASE}/earnings/recipients${query ? `?${query}` : ''}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch recipient breakdown');
    },

    async getEarningsPayouts({ statuses } = {}) {
        // Backend accepts comma-separated ?status=pending,failed (absent → no filter)
        const params = new URLSearchParams();
        const list = Array.isArray(statuses) ? statuses.filter(Boolean) : [];
        if (list.length) params.set('status', list.join(','));
        const query = params.toString();
        const res = await fetch(`${API_BASE}/earnings/payouts${query ? `?${query}` : ''}`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch payouts');
    },

    // ================== PER-LISTING SETTLEMENT ==================
    async getListingSettlement(kind, listingId) {
        const res = await fetch(`${API_BASE}/listings/${kind}/${listingId}/settlement`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch settlement');
    },

    async recordSettlement(kind, listingId, body) {
        const res = await fetch(`${API_BASE}/listings/${kind}/${listingId}/settlement/entries`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body)
        });
        return handle(res, 'Failed to record settlement');
    },

    async reverseSettlement(kind, listingId, entryId, reason) {
        const res = await fetch(`${API_BASE}/listings/${kind}/${listingId}/settlement/entries/${entryId}/reversal`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ reason })
        });
        return handle(res, 'Failed to reverse settlement');
    },

    // ================== DISCOUNT CODES ==================
    async getDiscountCodes() {
        const res = await fetch(`${MAIN_API_BASE}/discounts/admin/discount-codes`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch discount codes');
    },

    async getDiscountAnalytics(codeId) {
        const res = await fetch(`${MAIN_API_BASE}/discounts/admin/discount-codes/${codeId}/analytics`, { headers: authHeaders() });
        return handle(res, 'Failed to fetch discount analytics');
    },

    async activateDiscountCode(codeId) {
        const res = await fetch(`${MAIN_API_BASE}/discounts/admin/discount-codes/${codeId}/activate`, {
            method: 'PATCH',
            headers: authHeaders()
        });
        return handle(res, 'Failed to activate discount code');
    },

    async deactivateDiscountCode(codeId) {
        const res = await fetch(`${MAIN_API_BASE}/discounts/admin/discount-codes/${codeId}/deactivate`, {
            method: 'PATCH',
            headers: authHeaders()
        });
        return handle(res, 'Failed to deactivate discount code');
    }
};

export default adminApi;
