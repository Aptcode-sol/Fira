// @ts-check
const express = require('express');
const router = express.Router();
const bookingService = require('../services/bookingService');
const Booking = require('../models/Booking');
const Venue = require('../models/Venue');

const auth = require('../middleware/auth');
const { noStoreCache } = require('../middleware/httpCache');

/**
 * @typedef {import('../middleware/types').AuthenticatedRequest} AuthenticatedRequest
 * @typedef {import('express').Response} Response
 */

/** A platform admin, by the same role rule requireAuth('admin') applies. */
function isAdmin(user) {
    const held = Array.isArray(user?.roles) && user.roles.length ? user.roles : [user?.role];
    return held.includes('admin') || user?.role === 'admin';
}

/** True if `user` owns the venue `venueId`. */
async function ownsVenue(user, venueId) {
    if (!venueId) return false;
    const venue = await Venue.findById(venueId).select('owner').lean();
    return !!venue && String(venue.owner) === String(user._id);
}

/**
 * Who is asking about this booking: the guest who made it, the owner of the
 * venue it is at, or an admin.
 *
 * Every per-booking route used to trust the caller - the status route had no
 * auth at all, so anyone could accept, reject or complete any booking, and any
 * signed-in user could edit, cancel or read anyone's booking (with the guest's
 * name, email and phone).
 *
 * @returns {Promise<{ booking: any, isBooker: boolean, isOwner: boolean, isAdmin: boolean } | null>}
 */
async function bookingAccess(req, id) {
    const booking = await Booking.findById(id).select('user venue status').lean();
    if (!booking) return null;
    const admin = isAdmin(req.user);
    const isBooker = String(booking.user) === String(req.user._id);
    const isOwner = !isBooker || admin ? await ownsVenue(req.user, booking.venue) : false;
    return { booking, isBooker, isOwner, isAdmin: admin };
}

/** 404 for a missing booking, 403 when `allowed` rejects the caller; else the access. */
async function requireBookingAccess(req, res, allowed) {
    const access = await bookingAccess(req, req.params.id);
    if (!access) {
        res.status(404).json({ error: 'Booking not found' });
        return null;
    }
    if (!allowed(access)) {
        res.status(403).json({ error: 'You do not have access to this booking' });
        return null;
    }
    return access;
}

// GET /api/bookings - List bookings. Admins see all; anyone else only their own.
router.get('/', auth, noStoreCache, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const query = { ...req.query };
        if (!isAdmin(req.user)) query.user = req.user._id.toString();
        const bookings = await bookingService.getAllBookings(query);
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/bookings/user/:userId - Get user's bookings
router.get('/user/:userId', auth, noStoreCache, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        if (req.params.userId !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const bookings = await bookingService.getUserBookings(req.params.userId);
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/bookings/venue/:venueId - Get venue's bookings (venue owner or admin)
router.get('/venue/:venueId', auth, noStoreCache, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        if (!isAdmin(req.user) && !(await ownsVenue(req.user, req.params.venueId))) {
            return res.status(403).json({ error: 'Only the venue owner can view its bookings' });
        }
        const bookings = await bookingService.getVenueBookings(req.params.venueId);
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/bookings/:id - Get booking by ID (guest, venue owner or admin)
router.get('/:id', auth, noStoreCache, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const access = await requireBookingAccess(req, res, a => a.isBooker || a.isOwner || a.isAdmin);
        if (!access) return;
        const booking = await bookingService.getBookingById(req.params.id);
        res.json(booking);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/bookings - Create new booking
router.post('/', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const bookingData = { ...req.body, user: req.user._id };
        const booking = await bookingService.createBooking(bookingData);
        res.status(201).json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Fields a guest may edit on their own booking. Status, money, dates and the
// payment schedule are never client-editable - each has its own guarded flow.
const GUEST_EDITABLE_FIELDS = ['purpose', 'specialRequests', 'expectedGuests'];

// PUT /api/bookings/:id - Update booking details (the guest, while not closed)
router.put('/:id', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const access = await requireBookingAccess(req, res, a => a.isBooker || a.isAdmin);
        if (!access) return;
        if (!['pending', 'accepted'].includes(access.booking.status)) {
            return res.status(400).json({ error: `A ${access.booking.status} booking cannot be edited` });
        }
        const updates = {};
        for (const key of GUEST_EDITABLE_FIELDS) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        const booking = await bookingService.updateBooking(req.params.id, updates);
        res.json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Which status an owner may move a booking to, from which status.
const OWNER_TRANSITIONS = {
    accepted: ['pending'],
    rejected: ['pending'],
    completed: ['accepted'],
};

// PUT /api/bookings/:id/status - Accept/Reject/Complete booking (venue owner or admin)
router.put('/:id/status', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const access = await requireBookingAccess(req, res, a => a.isOwner || a.isAdmin);
        if (!access) return;

        const { status } = req.body;
        const allowedFrom = OWNER_TRANSITIONS[status];
        if (!allowedFrom) {
            return res.status(400).json({ error: 'Status must be accepted, rejected or completed' });
        }
        if (!allowedFrom.includes(access.booking.status)) {
            return res.status(400).json({ error: `A ${access.booking.status} booking cannot be marked ${status}` });
        }

        const booking = await bookingService.updateBookingStatus(req.params.id, {
            status,
            // The owner apps send `reason`; it used to be dropped because the
            // service only read `rejectionReason`.
            rejectionReason: req.body.rejectionReason ?? req.body.reason,
            modifiedDates: req.body.modifiedDates,
        });
        res.json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/bookings/:id/cancel - Cancel booking with venue cancellation policy enforcement (the guest)
router.post('/:id/cancel', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const access = await requireBookingAccess(req, res, a => a.isBooker);
        if (!access) return;
        const venueService = require('../services/venueService');
        const result = await venueService.processCancellation(req.params.id, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message || 'Cancellation failed' });
    }
});

// POST /api/bookings/:id/initiate-payment - Initiate Razorpay payment
router.post('/:id/initiate-payment', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // Enforce using authenticated user
        const result = await bookingService.initiateBookingPayment(req.params.id, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/bookings/:id/verify-payment - Verify payment after Razorpay callback (the guest)
router.post('/:id/verify-payment', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const access = await requireBookingAccess(req, res, a => a.isBooker);
        if (!access) return;
        const { gatewayOrderId, gatewayPaymentId, gatewaySignature } = req.body;
        const result = await bookingService.completeBookingPayment(req.params.id, {
            gatewayOrderId,
            gatewayPaymentId,
            gatewaySignature
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/bookings/:id/initiate-balance-payment - Initiate Razorpay balance payment
router.post('/:id/initiate-balance-payment', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // Enforce using authenticated user
        const result = await bookingService.initiateBalancePayment(req.params.id, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/bookings/:id/verify-balance-payment - Verify balance payment after Razorpay callback (the guest)
router.post('/:id/verify-balance-payment', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const access = await requireBookingAccess(req, res, a => a.isBooker);
        if (!access) return;
        const { gatewayOrderId, gatewayPaymentId, gatewaySignature } = req.body;
        const result = await bookingService.completeBalancePayment(req.params.id, {
            gatewayOrderId,
            gatewayPaymentId,
            gatewaySignature
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
