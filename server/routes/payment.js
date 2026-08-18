// @ts-check
const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const discountService = require('../services/discountService');

const { requireAuth } = require('../middleware/auth');

/**
 * @typedef {import('../middleware/types').AuthenticatedRequest} AuthenticatedRequest
 * @typedef {import('express').Response} Response
 */

// GET /api/payments - Get all payments (admin only)
router.get('/', requireAuth('admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const payments = await paymentService.getAllPayments(req.query);
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/payments/user/:userId - Get user's payments
router.get('/user/:userId', requireAuth('user', 'admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.params.userId !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const payments = await paymentService.getUserPayments(req.params.userId);
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/payments/:id - Get payment by ID (authenticated)
router.get('/:id', requireAuth('user', 'admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const payment = await paymentService.getPaymentById(req.params.id);
        res.json(payment);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/payments/calculate-billing - Calculate billing breakdown (user)
router.post('/calculate-billing', requireAuth('user'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { ticketPrice, quantity, platformFeePercentage, discountAmount } = req.body;
        if (ticketPrice == null || quantity == null || platformFeePercentage == null) {
            return res.status(400).json({ error: 'ticketPrice, quantity, and platformFeePercentage are required' });
        }
        const billing = paymentService.calculateBilling(ticketPrice, quantity, platformFeePercentage, discountAmount || 0);
        res.json(billing);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/payments/apply-discount - Validate and apply discount code (user)
router.post('/apply-discount', requireAuth('user'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { code, eventId, subtotal } = req.body;
        if (!code || !eventId || subtotal == null) {
            return res.status(400).json({ error: 'code, eventId, and subtotal are required' });
        }
        const result = await discountService.validateAndApplyDiscount(code, eventId, subtotal);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/payments/initiate - Initiate payment (user)
router.post('/initiate', requireAuth('user'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const paymentData = { ...req.body, userId: req.user._id };
        const result = await paymentService.initiatePayment(paymentData);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/payments/verify - Verify payment (requirement 3.4: auth required)
router.post('/verify', requireAuth('user', 'admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await paymentService.verifyPayment(req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/payments/:id/refund - Request refund (user who owns the payment)
router.post('/:id/refund', requireAuth('user'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await paymentService.requestRefund(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/payments/payouts/all - Get all payouts (admin)
router.get('/payouts/all', requireAuth('admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const payouts = await paymentService.getAllPayouts(req.query);
        res.json(payouts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/payments/payouts - Process payout (admin)
router.post('/payouts', requireAuth('admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await paymentService.processPayout(req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============= REFUND ROUTES =============

const refundService = require('../services/refundService');

// GET /api/payments/refunds - Get all refunds (admin)
router.get('/refunds', requireAuth('admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const refunds = await refundService.getAllRefunds(req.query);
        res.json(refunds);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/payments/refunds/user/:userId - Get user's refunds
router.get('/refunds/user/:userId', requireAuth('user', 'admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.params.userId !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const refunds = await refundService.getRefundsByUser(req.params.userId);
        res.json(refunds);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/payments/refunds/:id - Get refund details (authenticated)
router.get('/refunds/:id', requireAuth('user', 'admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const refund = await refundService.getRefundById(req.params.id);
        res.json(refund);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/payments/refunds/:id/process - Process pending refund (admin only)
router.post('/refunds/:id/process', requireAuth('admin'), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { action, notes } = req.body;
        const refund = await refundService.processRefundRequest(req.params.id, req.user._id, action, notes);
        res.json(refund);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
