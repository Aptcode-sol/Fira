const express = require('express');
const { z } = require('zod');
const router = express.Router();
const adminService = require('../services/adminService');
const earningsService = require('../services/earningsService');
const settlementService = require('../services/settlementService');
const adminAuth = require('../middleware/adminAuth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
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

// Hard delete, gated to admins: it removes the profile and resets the owner's
// verified badge so they can re-apply. Destructive and irreversible, so it is not
// left open to every authenticated staff role the way the status change is.
router.delete('/brands/:id', roleGuard(['super_admin', 'admin']), async (req, res) => {
    try {
        const result = await adminService.deleteBrand(req.params.id, req.user._id);
        res.json(result);
    } catch (error) {
        const status = error.message === 'Brand not found' ? 404 : 500;
        res.status(status).json({ error: error.message });
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

// ================== PER-LISTING SETTLEMENT ==================
// The platform's first money-write routes. Everything above in this section is
// read-only reporting; these three read a listing's settlement ledger and append
// to it. All the money decisions (validation, the over-settlement guard, the
// audit write, idempotency, append-only correction) live in settlementService —
// a handler here only maps params in and the service's error out.

// The money-write role check. roleGuard on its own is NOT sufficient here: it
// deliberately calls next() when `adminRole` is falsy (documented backward
// compatibility for legacy admins predating the sub-role system), so an
// authenticated admin session carrying no sub-role would pass
// roleGuard(['super_admin','admin']) and reach these routes. That fallback is
// load-bearing for the routes it was written for — a legacy admin locked out of
// the audit trail or the delete routes is a real regression — so it is left
// alone and the role is named explicitly here instead (Requirements 11.1–11.3).
// This is strictly stronger than roleGuard's allow-list, so roleGuard is not
// also listed on these routes: two guards where one decides is one guard nobody
// reads.
// ponytail: replace with roleGuard once every admin account carries an
// adminRole and roleGuard's fallback can be dropped. Note that roleGuard's own
// self-check (server/middleware/roleGuard.test.js) already asserts the strict
// behaviour and currently fails against the permissive implementation.
const settlementRoleGuard = (req, res, next) => {
    const adminRole = req.user && req.user.adminRole;
    if (adminRole !== 'super_admin' && adminRole !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
};

// Request bodies are validated by zod before the service is reached, so a
// malformed body never becomes a money decision. z.object strips unknown keys,
// which also means a caller cannot smuggle `isOverSettlement` or `recordedBy`
// into the stored row.
const entrySchema = z.object({
    settledAmount: z.number().int().positive(),
    settlementReference: z.string().trim().min(1),
    settledAt: z.coerce.date(),
    method: z.enum(['manual', 'gateway']).optional(),
    adminNotes: z.string().trim().optional(),
    idempotencyKey: z.string().trim().min(1),
    override: z.boolean().optional(),
    overrideReason: z.string().trim().optional(),
});

const reversalSchema = z.object({
    reason: z.string().trim().min(1),
});

// The service throws Errors carrying `status`, and the decision helpers attach
// `field` / `code` plus, for an over-settlement, the three figures the admin
// needs to correct the submission. Same shape as the earnings routes above, with
// those extras passed through rather than dropped (Requirement 5.2).
function sendSettlementError(res, error) {
    const body = { error: error.message };
    if (error.field) body.field = error.field;
    // Only a decision code, never a driver's numeric one.
    if (typeof error.code === 'string') body.code = error.code;
    if (error.code === 'over_settlement') {
        body.netPayable = error.netPayable;
        body.settledToDate = error.settledToDate;
        body.maxRecordable = error.maxRecordable;
    }
    res.status(error.status || 500).json(body);
}

const settlementAdmin = (req) => ({ _id: req.user._id, name: req.user.name, adminRole: req.user.adminRole });

// Listing_Stats + the ledger + the derived state (Requirements 1, 2, 3, 11.1).
router.get('/listings/:kind/:id/settlement', settlementRoleGuard, async (req, res) => {
    try {
        const settlement = await settlementService.getListingSettlement({ kind: req.params.kind, listingId: req.params.id });
        res.json(settlement);
    } catch (error) {
        sendSettlementError(res, error);
    }
});

// Record one real transfer (Requirements 4, 5, 6, 8, 10, 11.2).
router.post('/listings/:kind/:id/settlement/entries', settlementRoleGuard, validate(entrySchema), async (req, res) => {
    try {
        const result = await settlementService.recordEntry({
            kind: req.params.kind,
            listingId: req.params.id,
            input: req.body,
            admin: settlementAdmin(req),
        });
        res.json(result);
    } catch (error) {
        sendSettlementError(res, error);
    }
});

// Correct a recorded transfer by appending its reversal — never by editing or
// deleting the original (Requirement 7).
router.post('/listings/:kind/:id/settlement/entries/:entryId/reversal', settlementRoleGuard, validate(reversalSchema), async (req, res) => {
    try {
        const result = await settlementService.recordReversal({
            kind: req.params.kind,
            listingId: req.params.id,
            entryId: req.params.entryId,
            reason: req.body.reason,
            admin: settlementAdmin(req),
        });
        res.json(result);
    } catch (error) {
        sendSettlementError(res, error);
    }
});

module.exports = router;
