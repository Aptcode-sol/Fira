const express = require('express');
const router = express.Router();
const eventService = require('../services/eventService');

// GET /api/events - Get all events
router.get('/', async (req, res) => {
    try {
        const events = await eventService.getAllEvents(req.query);
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/events/upcoming - Get upcoming events
router.get('/upcoming', async (req, res) => {
    try {
        const events = await eventService.getUpcomingEvents(req.query);
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', async (req, res) => {
    try {
        const event = await eventService.getEventById(req.params.id);
        res.json(event);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/events - Create new event
router.post('/', async (req, res) => {
    try {
        const event = await eventService.createEvent(req.body);
        res.status(201).json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/events/:id - Update event
router.put('/:id', async (req, res) => {
    try {
        const event = await eventService.updateEvent(req.params.id, req.body);
        res.json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', async (req, res) => {
    try {
        await eventService.deleteEvent(req.params.id);
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/events/:id/cancel - Cancel event with automatic refunds
router.post('/:id/cancel', async (req, res) => {
    try {
        const { reason } = req.body;
        const result = await eventService.cancelEvent(req.params.id, reason);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/events/:id/access - Request access to private event
router.post('/:id/access', async (req, res) => {
    try {
        const result = await eventService.requestPrivateAccess(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/events/:id/access/:requestId - Approve/reject access request
router.put('/:id/access/:requestId', async (req, res) => {
    try {
        const result = await eventService.handleAccessRequest(req.params.requestId, req.body.status);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
