// @ts-check
const express = require('express');
const router = express.Router();
const bookingService = require('../services/bookingService');

const auth = require('../middleware/auth');
const { noStoreCache } = require('../middleware/httpCache');

/**
 * @typedef {import('../middleware/types').AuthenticatedRequest} AuthenticatedRequest
 * @typedef {import('express').Response} Response
 */

// GET /api/bookings - Get all bookings
router.get('/', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const bookings = await bookingService.getAllBookings(req.query);
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

// GET /api/bookings/venue/:venueId - Get venue's bookings
router.get('/venue/:venueId', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const bookings = await bookingService.getVenueBookings(req.params.venueId);
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/bookings/:id - Get booking by ID
router.get('/:id', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
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

// PUT /api/bookings/:id - Update booking
router.put('/:id', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const booking = await bookingService.updateBooking(req.params.id, req.body);
        res.json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/bookings/:id/status - Accept/Reject booking (venue owner)
router.put('/:id/status', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const booking = await bookingService.updateBookingStatus(req.params.id, req.body);
        res.json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/bookings/:id/cancel - Cancel booking with venue cancellation policy enforcement
router.post('/:id/cancel', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const venueService = require('../services/venueService');
        const result = await venueService.processCancellation(req.params.id, req.user._id);
        res.json(result);
    } catch (error) {
        const message = error.message || 'Cancellation failed';
        if (message === 'Cancellation window has passed') {
            return res.status(400).json({ error: message });
        }
        res.status(400).json({ error: message });
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

// POST /api/bookings/:id/verify-payment - Verify payment after Razorpay callback
router.post('/:id/verify-payment', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
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

module.exports = router;
