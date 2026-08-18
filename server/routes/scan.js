const express = require('express');
const router = express.Router();
const ScanningCode = require('../models/ScanningCode');
const eventService = require('../services/eventService');

// GET /api/scan/:code - Public endpoint: validate scanning link and return basic info
router.get('/:code', async (req, res) => {
    try {
        const scanningCode = await ScanningCode.findOne({ code: req.params.code }).populate('event', 'name startDateTime endDateTime');
        if (!scanningCode) {
            return res.status(400).json({ error: 'Access code is invalid' });
        }
        if (!scanningCode.isActive) {
            return res.status(403).json({ error: 'Access code has been deactivated' });
        }
        res.json({
            valid: true,
            eventName: scanningCode.event?.name || null,
            eventId: scanningCode.event?._id || null,
            label: scanningCode.label
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/scan/:code/checkin - Validate ticket and check in via access code
router.post('/:code/checkin', async (req, res) => {
    try {
        const { ticketId } = req.body;
        if (!ticketId) {
            return res.status(400).json({ error: 'ticketId is required' });
        }
        const ticket = await eventService.validateScanAndCheckIn(req.params.code, ticketId);
        res.json({ success: true, ticket });
    } catch (error) {
        const status = error.message.includes('invalid') ? 400
            : error.message.includes('deactivated') ? 403
            : error.message.includes('different event') ? 400
            : error.message.includes('already been used') ? 400
            : 400;
        res.status(status).json({ error: error.message });
    }
});

module.exports = router;
