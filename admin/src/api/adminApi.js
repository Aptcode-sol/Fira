const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/admin';

const adminApi = {
    // ================== DASHBOARD ==================
    async getStats() {
        const res = await fetch(`${API_BASE}/stats`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
    },

    // ================== USERS ==================
    async getUsers(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/users?${query}`);
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },

    async blockUser(userId) {
        const res = await fetch(`${API_BASE}/users/${userId}/block`, { method: 'PUT' });
        if (!res.ok) throw new Error('Failed to block user');
        return res.json();
    },

    async unblockUser(userId) {
        const res = await fetch(`${API_BASE}/users/${userId}/unblock`, { method: 'PUT' });
        if (!res.ok) throw new Error('Failed to unblock user');
        return res.json();
    },

    // ================== VENUES ==================
    async getVenues(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/venues?${query}`);
        if (!res.ok) throw new Error('Failed to fetch venues');
        return res.json();
    },

    async getVenueById(venueId) {
        const res = await fetch(`${API_BASE}/venues/${venueId}`);
        if (!res.ok) throw new Error('Failed to fetch venue');
        return res.json();
    },

    async updateVenueStatus(venueId, status) {
        const res = await fetch(`${API_BASE}/venues/${venueId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Failed to update venue status');
        return res.json();
    },

    // ================== EVENTS ==================
    async getEvents(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/events?${query}`);
        if (!res.ok) throw new Error('Failed to fetch events');
        return res.json();
    },

    async getEventById(eventId) {
        const res = await fetch(`${API_BASE}/events/${eventId}`);
        if (!res.ok) throw new Error('Failed to fetch event');
        return res.json();
    },

    async updateEventStatus(eventId, status) {
        const res = await fetch(`${API_BASE}/events/${eventId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Failed to update event status');
        return res.json();
    },

    // Get events pending admin approval (venue already approved)
    async getPendingEventApprovals(params = {}) {
        const query = new URLSearchParams(params).toString();
        // Use main API endpoint for pending events
        const mainApiBase = import.meta.env.VITE_API_BASE_URL?.replace('/admin', '') || 'http://localhost:4000/api';
        const res = await fetch(`${mainApiBase}/events/admin-pending?${query}`);
        if (!res.ok) throw new Error('Failed to fetch pending events');
        return res.json();
    },

    // Admin approve/reject event
    async adminApproveEvent(eventId, adminId, status, rejectionReason) {
        const mainApiBase = import.meta.env.VITE_API_BASE_URL?.replace('/admin', '') || 'http://localhost:4000/api';
        const res = await fetch(`${mainApiBase}/events/${eventId}/admin-approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId, status, rejectionReason })
        });
        if (!res.ok) throw new Error('Failed to approve event');
        return res.json();
    },

    // ================== BRANDS ==================
    async getBrands(params = {}) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/brands?${query}`);
        if (!res.ok) throw new Error('Failed to fetch brands');
        return res.json();
    },

    async getBrandById(brandId) {
        const res = await fetch(`${API_BASE}/brands/${brandId}`);
        if (!res.ok) throw new Error('Failed to fetch brand');
        return res.json();
    },

    async updateBrandStatus(brandId, status) {
        const res = await fetch(`${API_BASE}/brands/${brandId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Failed to update brand status');
        return res.json();
    }
};

export default adminApi;
