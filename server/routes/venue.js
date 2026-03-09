const express = require('express');
const router = express.Router();
const venueService = require('../services/venueService');
const { venueOwnerAuth, requireAuth } = require('../middleware/venueOwnerAuth');

// GET /api/venues - Get all venues (public)
router.get('/', async (req, res) => {
    try {
        const venues = await venueService.getAllVenues(req.query);
        res.json(venues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/venues/sections - Fetch all homepage sections in one call
router.get('/sections', async (req, res) => {
    try {
        const [topRated, inDemand, latest] = await Promise.all([
            venueService.getAllVenues({ status: 'approved', sort: 'topRated' }),
            venueService.getAllVenues({ status: 'approved', sort: 'inDemand' }),
            venueService.getAllVenues({ status: 'approved', sort: 'latest' }),
        ]);
        res.json({
            topRated: topRated.venues || [],
            inDemand: inDemand.venues || [],
            latest: latest.venues || [],
        });
    } catch (error) {
        console.error('Error fetching venue sections:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/venues/nearby - Get nearby venues (public)
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        const venues = await venueService.getNearbyVenues(lat, lng, radius);
        res.json(venues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/venues/my-venues - Get venues owned by current user (venue owner only)
router.get('/my-venues', venueOwnerAuth, async (req, res) => {
    try {
        const venues = await venueService.getVenuesByOwner(req.user._id);
        res.json(venues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/venues/:id - Get venue by ID (public)
router.get('/:id', async (req, res) => {
    try {
        const venue = await venueService.getVenueById(req.params.id);
        res.json(venue);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/venues - Create new venue (venue owner only)
router.post('/', venueOwnerAuth, async (req, res) => {
    console.log('🏢 [VENUE POST] Creating new venue...');
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));

    try {
        // Add owner from authenticated user
        const venueData = {
            ...req.body,
            owner: req.user._id
        };
        const venue = await venueService.createVenue(venueData);
        console.log('✅ [VENUE POST] Venue created successfully:', venue._id);
        res.status(201).json(venue);
    } catch (error) {
        console.error('❌ [VENUE POST] Error creating venue:');
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        console.error('Error Name:', error.name);
        if (error.errors) {
            console.error('Validation Errors:', JSON.stringify(error.errors, null, 2));
        }
        console.error('Request Body that caused error:', JSON.stringify(req.body, null, 2));
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/venues/:id - Update venue (venue owner only, must own the venue)
router.put('/:id', venueOwnerAuth, async (req, res) => {
    try {
        // Verify ownership
        const existingVenue = await venueService.getVenueById(req.params.id);
        if (existingVenue.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not own this venue' });
        }
        const venue = await venueService.updateVenue(req.params.id, req.body);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/venues/:id - Delete venue (venue owner only, must own the venue)
router.delete('/:id', venueOwnerAuth, async (req, res) => {
    try {
        // Verify ownership
        const existingVenue = await venueService.getVenueById(req.params.id);
        if (existingVenue.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not own this venue' });
        }
        await venueService.deleteVenue(req.params.id);
        res.json({ message: 'Venue deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/venues/:id/availability - Update venue availability (venue owner only)
router.put('/:id/availability', venueOwnerAuth, async (req, res) => {
    try {
        // Verify ownership
        const existingVenue = await venueService.getVenueById(req.params.id);
        if (existingVenue.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not own this venue' });
        }
        const venue = await venueService.updateAvailability(req.params.id, req.body);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/venues/:id/status - Update venue status (admin only - keep for future)
router.put('/:id/status', async (req, res) => {
    try {
        const venue = await venueService.updateStatus(req.params.id, req.body.status);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/venues/:id/cancel - Delete venue (venue owner only)
router.post('/:id/cancel', venueOwnerAuth, async (req, res) => {
    try {
        // Verify ownership
        const existingVenue = await venueService.getVenueById(req.params.id);
        if (existingVenue.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not own this venue' });
        }
        const result = await venueService.deleteVenue(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;

