const express = require('express');
const router = express.Router();
const discountService = require('../services/discountService');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Event = require('../models/Event');
const DiscountCode = require('../models/DiscountCode');

// POST /events/:id/discount-codes — create discount code (requires auth + event ownership)
router.post('/events/:id/discount-codes', auth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (event.organizer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the event organizer can create discount codes' });
        }

        // No validFrom/validUntil: the service derives the window from this event.
        const { code, discountType, discountValue, maxUses } = req.body;
        const discount = await discountService.createDiscountCode({
            eventId: req.params.id,
            code,
            discountType,
            discountValue,
            maxUses,
            createdBy: req.user._id
        });
        res.status(201).json(discount);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PATCH /discount-codes/:id — edit discount code (requires auth + ownership)
router.patch('/discount-codes/:id', auth, async (req, res) => {
    try {
        const discount = await discountService.editDiscountCode(req.params.id, req.body, req.user._id);
        res.json(discount);
    } catch (error) {
        const status = error.message.includes('Not authorized') ? 403
            : error.message.includes('not found') ? 404
            : 400;
        res.status(status).json({ error: error.message });
    }
});

// DELETE /discount-codes/:id — deactivate discount code (requires auth + ownership)
router.delete('/discount-codes/:id', auth, async (req, res) => {
    try {
        const discount = await discountService.deactivateDiscountCode(req.params.id, req.user._id);
        res.json(discount);
    } catch (error) {
        const status = error.message.includes('Not authorized') ? 403
            : error.message.includes('not found') ? 404
            : 400;
        res.status(status).json({ error: error.message });
    }
});

// GET /events/:id/discount-codes — list discount codes for an event (requires auth)
router.get('/events/:id/discount-codes', auth, async (req, res) => {
    try {
        const codes = await DiscountCode.find({ event: req.params.id }).sort({ createdAt: -1 });
        res.json(codes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /admin/discount-codes — list all discount codes (requires adminAuth)
router.get('/admin/discount-codes', adminAuth, async (req, res) => {
    try {
        // adminRole distinguishes platform (admin) codes from event-owner codes (Flow 8.7).
        const codes = await DiscountCode.find()
            .populate('event', 'name')
            .populate('createdBy', 'name email adminRole')
            .sort({ createdAt: -1 });
        res.json(codes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /admin/discount-codes/:id/analytics — analytics for a discount code (requires adminAuth)
router.get('/admin/discount-codes/:id/analytics', adminAuth, async (req, res) => {
    try {
        const analytics = await discountService.getDiscountAnalytics(req.params.id);
        res.json(analytics);
    } catch (error) {
        const status = error.message.includes('not found') ? 404 : 500;
        res.status(status).json({ error: error.message });
    }
});

// PATCH /admin/discount-codes/:id/activate — admin activation of a discount code (requires adminAuth)
router.patch('/admin/discount-codes/:id/activate', adminAuth, async (req, res) => {
    try {
        const discount = await DiscountCode.findById(req.params.id);
        if (!discount) {
            return res.status(404).json({ error: 'Discount code not found' });
        }
        discount.isActive = true;
        discount.activatedBy = req.user._id;
        await discount.save();
        res.json(discount);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /admin/discount-codes/:id/deactivate — admin deactivation of a discount code (requires adminAuth)
router.patch('/admin/discount-codes/:id/deactivate', adminAuth, async (req, res) => {
    try {
        const discount = await DiscountCode.findById(req.params.id);
        if (!discount) {
            return res.status(404).json({ error: 'Discount code not found' });
        }
        discount.isActive = false;
        await discount.save();
        res.json(discount);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
