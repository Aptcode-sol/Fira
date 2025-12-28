const express = require('express');
const router = express.Router();
const ticketService = require('../services/ticketService');

// GET /api/tickets - Get all tickets
router.get('/', async (req, res) => {
    try {
        const tickets = await ticketService.getAllTickets(req.query);
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tickets/user/:userId - Get user's tickets
router.get('/user/:userId', async (req, res) => {
    try {
        const tickets = await ticketService.getUserTickets(req.params.userId);
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tickets/event/:eventId - Get event's tickets
router.get('/event/:eventId', async (req, res) => {
    try {
        const tickets = await ticketService.getEventTickets(req.params.eventId);
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tickets/:id - Get ticket by ID
router.get('/:id', async (req, res) => {
    try {
        const ticket = await ticketService.getTicketById(req.params.id);
        res.json(ticket);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/tickets - Purchase ticket
router.post('/', async (req, res) => {
    try {
        const ticket = await ticketService.purchaseTicket(req.body);
        res.status(201).json(ticket);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/tickets/:id/validate - Validate ticket (check-in)
router.post('/:id/validate', async (req, res) => {
    try {
        const result = await ticketService.validateTicket(req.params.id, req.body.qrCode);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/tickets/scan - Scan ticket via QR code (for scanner UI)
router.post('/scan', async (req, res) => {
    try {
        const { qrData, scannerId, eventId } = req.body;

        if (!qrData || !eventId) {
            return res.status(400).json({ error: 'Missing qrData or eventId' });
        }

        const result = await ticketService.scanTicket({
            qrData,
            scannerId,
            eventId
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/tickets/event/:eventId/stats - Get scan stats for event
router.get('/event/:eventId/stats', async (req, res) => {
    try {
        const tickets = await ticketService.getEventTickets(req.params.eventId);
        const total = tickets.length;
        const scanned = tickets.filter(t => t.isUsed || t.status === 'used').length;
        const totalAttendees = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
        const scannedAttendees = tickets.filter(t => t.isUsed || t.status === 'used')
            .reduce((sum, t) => sum + (t.quantity || 1), 0);

        res.json({
            totalTickets: total,
            scannedTickets: scanned,
            totalAttendees,
            scannedAttendees,
            pending: total - scanned
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tickets/:id/refund-eligibility - Check refund eligibility
router.get('/:id/refund-eligibility', async (req, res) => {
    try {
        const eligibility = await ticketService.checkRefundEligibility(req.params.id);
        res.json(eligibility);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/tickets/:id/cancel - Cancel ticket with refund
router.post('/:id/cancel', async (req, res) => {
    try {
        const { userId, reason } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        const result = await ticketService.cancelTicket(req.params.id, userId, reason);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
