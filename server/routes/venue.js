const express = require('express');
const router = express.Router();
const venueService = require('../services/venueService');

// GET /api/venues - Get all venues
router.get('/', async (req, res) => {
    try {
        const venues = await venueService.getAllVenues(req.query);
        res.json(venues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/venues/nearby - Get nearby venues
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        const venues = await venueService.getNearbyVenues(lat, lng, radius);
        res.json(venues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/venues/:id - Get venue by ID
router.get('/:id', async (req, res) => {
    try {
        const venue = await venueService.getVenueById(req.params.id);
        res.json(venue);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/venues - Create new venue
router.post('/', async (req, res) => {
    try {
        const venue = await venueService.createVenue(req.body);
        res.status(201).json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/venues/:id - Update venue
router.put('/:id', async (req, res) => {
    try {
        const venue = await venueService.updateVenue(req.params.id, req.body);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/venues/:id - Delete venue
router.delete('/:id', async (req, res) => {
    try {
        await venueService.deleteVenue(req.params.id);
        res.json({ message: 'Venue deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/venues/:id/availability - Update venue availability
router.put('/:id/availability', async (req, res) => {
    try {
        const venue = await venueService.updateAvailability(req.params.id, req.body);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/venues/:id/status - Update venue status (admin)
router.put('/:id/status', async (req, res) => {
    try {
        const venue = await venueService.updateStatus(req.params.id, req.body.status);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/venues/:id/cancel - Cancel/deactivate venue
router.post('/:id/cancel', async (req, res) => {
    try {
        const venue = await venueService.updateStatus(req.params.id, 'inactive');
        res.json({ venue, message: 'Venue has been cancelled successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
