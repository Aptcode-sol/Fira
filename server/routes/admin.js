const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const earningsService = require('../services/earningsService');
const adminAuth = require('../middleware/adminAuth');
const roleGuard = require('../middleware/roleGuard');
const { invalidateCache } = require('../middleware/httpCache');
const User = require('../models/User');

// Gate EVERY admin route behind a valid token + admin role.
// Applied with router.use rather than per-route so a route added later cannot
// accidentally ship unprotected - which is exactly how this whole router ended
// up publicly readable in the first place.
router.use(adminAuth);

// ================== DASHBOARD ==================
router.get('/stats', async (req, res) => {
    try {
        const stats = await adminService.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================== USERS ==================
router.get('/users', async (req, res) => {
    try {
        const result = await adminService.getAllUsers(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/users/:id', async (req, res) => {
    try {
        const user = await adminService.getUserById(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

router.put('/users/:id/block', async (req, res) => {
    try {
        const user = await adminService.blockUser(req.params.id, req.user._id);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/users/:id/unblock', async (req, res) => {
    try {
        const user = await adminService.unblockUser(req.params.id, req.user._id);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Destructive: irreversible cascade delete of the account and everything it
// owns. Moderators are excluded (roleGuard) - block/unblock is their ceiling.
router.delete('/users/:id', roleGuard(['super_admin', 'admin']), async (req, res) => {
    try {
        const result = await adminService.deleteUser(req.params.id, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(error.status || (error.message === 'User not found' ? 404 : 400)).json({ error: error.message });
    }
});

// ================== VENUES ==================
router.get('/venues', async (req, res) => {
    try {
        const result = await adminService.getVenues(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Venue owners with their venues + payout bank details (admin-only read, Flow 8.6).
router.get('/venue-owners', async (req, res) => {
    try {
        const result = await adminService.getVenueOwners(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/venues/:id', async (req, res) => {
    try {
        const venue = await adminService.getVenueById(req.params.id);
        res.json(venue);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

router.put('/venues/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected', 'blocked'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const venue = await adminService.updateVenueStatus(req.params.id, status, req.user._id);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Soft delete - drops the venue from every public and admin listing while
// keeping bookings/payout history intact. Same cache invalidation as the
// owner-facing DELETE /venues/:id so public pages don't serve a dead listing.
router.delete('/venues/:id', roleGuard(['super_admin', 'admin']), async (req, res) => {
    try {
        const result = await adminService.deleteVenue(req.params.id, req.user._id);
        await invalidateCache('venues');
        res.json(result);
    } catch (error) {
        res.status(error.message === 'Venue not found' ? 404 : 400).json({ error: error.message });
    }
});

// ================== EVENTS ==================
router.get('/events', async (req, res) => {
    try {
        const result = await adminService.getEvents(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/events/:id', async (req, res) => {
    try {
        const event = await adminService.getEventById(req.params.id);
        res.json(event);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

router.put('/events/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'upcoming', 'approved', 'rejected', 'blocked', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const event = await adminService.updateEventStatus(req.params.id, status, req.user._id);
        res.json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Soft delete - see DELETE /venues/:id. Does not refund ticket holders; that
// is the cancel flow's job.
router.delete('/events/:id', roleGuard(['super_admin', 'admin']), async (req, res) => {
    try {
        const result = await adminService.deleteEvent(req.params.id, req.user._id);
        await invalidateCache('events');
        res.json(result);
    } catch (error) {
        res.status(error.message === 'Event not found' ? 404 : 400).json({ error: error.message });
    }
});

// ================== BRANDS ==================
router.get('/brands', async (req, res) => {
    try {
        const result = await adminService.getBrands(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/brands/:id', async (req, res) => {
    try {
        const brand = await adminService.getBrandById(req.params.id);
        res.json(brand);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

router.put('/brands/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected', 'blocked'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const brand = await adminService.updateBrandStatus(req.params.id, status, req.user._id);
        res.json(brand);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ================== FEATURED TOGGLE ==================
router.patch('/events/:id/featured', roleGuard(['super_admin', 'admin']), async (req, res) => {
    try {
        const { isFeatured } = req.body;
        if (typeof isFeatured !== 'boolean') {
            return res.status(400).json({ error: 'isFeatured must be a boolean' });
        }
        const event = await adminService.toggleFeatured(req.params.id, isFeatured, req.user._id);
        res.json(event);
    } catch (error) {
        if (error.message.includes('approved or upcoming')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// ================== AUDIT TRAIL ==================
router.get('/audit-trail', roleGuard(['super_admin', 'admin']), async (req, res) => {
    try {
        const result = await adminService.getAuditTrail(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================== ADMIN ROLE ASSIGNMENT ==================
router.patch('/users/:id/role', roleGuard(['super_admin']), async (req, res) => {
    try {
        const { adminRole } = req.body;
        if (!['super_admin', 'admin', 'moderator'].includes(adminRole)) {
            return res.status(400).json({ error: 'Invalid role. Must be one of: super_admin, admin, moderator' });
        }
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: { adminRole } },
            { new: true }
        ).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================== EARNINGS & PAYOUTS (read-only) ==================
// Read-only reporting surfaces delegating to earningsService (the single
// aggregator). GET-only: no route here creates, edits, or deletes any record
// (Requirement 11.6). The whole router already sits behind adminAuth
// (router.use above); roleGuard(['super_admin','admin']) additionally rejects a
// moderator (Requirement 11.2). On any service failure the request maps to the
// status the error carries (e.g. a fail-closed compute error) or 500 with an
// { error } body, matching the existing admin route error style — never a
// partial or stale total.

// Aggregate overview: six headline figures + reconciliation block, optionally
// scoped to an inclusive createdAt range applied identically to every figure.
router.get('/earnings/overview', roleGuard(['super_admin', 'admin']), async (req, res) => {
    try {
        const overview = await earningsService.getAdminOverview({ from: req.query.from, to: req.query.to });
        res.json(overview);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Per-recipient payable breakdown, partitioned by Payout type, same optional range.
router.get('/earnings/recipients', roleGuard(['super_admin', 'admin']), async (req, res) => {
    try {
        const breakdown = await earningsService.getRecipientBreakdown({ from: req.query.from, to: req.query.to });
        res.json(breakdown);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Payout lifecycle list, optionally filtered by status. `status` may be repeated
// (?status=pending&status=failed) or comma-separated (?status=pending,failed);
// absent → undefined so getPayoutList applies no filter.
router.get('/earnings/payouts', roleGuard(['super_admin', 'admin']), async (req, res) => {
    try {
        let statuses;
        const raw = req.query.status;
        if (raw != null) {
            const list = (Array.isArray(raw) ? raw : String(raw).split(','))
                .map((s) => String(s).trim())
                .filter(Boolean);
            if (list.length) statuses = list;
        }
        const payouts = await earningsService.getPayoutList({ statuses });
        res.json(payouts);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
});

module.exports = router;
