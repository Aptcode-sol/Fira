const express = require('express');
const router = express.Router();
const ScanningCode = require('../models/ScanningCode');
const eventService = require('../services/eventService');

// GET /api/scan/:code - Public endpoint: validate scanning link and return basic info
router.get('/:code', async (req, res) => {
    try {
        const scanningCode = await ScanningCode.findOne({ code: req.params.code })
            .populate('event', 'name startDateTime endDateTime ticketTiers');
        if (!scanningCode) {
            return res.status(400).json({ error: 'Access code is invalid' });
        }
        if (!scanningCode.isActive) {
            return res.status(403).json({ error: 'Access code has been deactivated' });
        }
        // An unscoped link on a tiered event bypasses every per-tier restriction, so it
        // fails here - when the door opens the page - rather than on the first guest.
        if (!scanningCode.ticketTier && (scanningCode.event?.ticketTiers || []).length > 0) {
            return res.status(403).json({
                error: 'This scanner link is out of date. Ask the organiser for the link for this tier.'
            });
        }
        res.json({
            valid: true,
            eventName: scanningCode.event?.name || null,
            eventId: scanningCode.event?._id || null,
            label: scanningCode.label,
            // So the door can see which tier it admits before the first guest
            // arrives, rather than discovering it from a rejection.
            ticketTier: scanningCode.ticketTier || ''
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
        // Only what the door needs to see. The full ticket document carries the
        // buyer's payment reference and QR data URL, which has no business being
        // returned to an unauthenticated endpoint.
        res.json({
            success: true,
            ticket: {
                ticketId: ticket.ticketId,
                ticketType: ticket.ticketType,
                quantity: ticket.quantity,
                user: {
                    name: ticket.user?.name || '',
                    email: ticket.user?.email || ''
                }
            }
        });
    } catch (error) {
        const status = error.message.includes('deactivated') ? 403 : 400;
        res.status(status).json({ error: error.message });
    }
});

module.exports = router;
