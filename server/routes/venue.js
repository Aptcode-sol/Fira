// @ts-check
const express = require('express');
const { z } = require('zod');
const router = express.Router();
const venueService = require('../services/venueService');
const validate = require('../middleware/validate');
const { venueOwnerAuth, requireAuth } = require('../middleware/venueOwnerAuth');
const { publicCache, noStoreCache, invalidateCache } = require('../middleware/httpCache');

// Maps/location link validation (Req 20.2). Only guards `locationLink`; every other
// venue field passes through untouched via .passthrough(). The field is optional and
// an empty string is allowed (clearing the link); a non-empty value must be a valid URL.
// ponytail: reuses the zod-based validate middleware — no new validation dependency.
const locationLinkBody = z.object({
    locationLink: z
        .string()
        .trim()
        .refine(v => v === '' || z.string().url().safeParse(v).success, {
            message: 'locationLink must be a valid URL'
        })
        .optional()
}).passthrough();

/**
 * @typedef {import('../middleware/types').AuthenticatedRequest} AuthenticatedRequest
 * @typedef {import('express').Response} Response
 */

// GET /api/venues - Get all venues (public)
router.get('/', publicCache, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const venues = await venueService.getAllVenues(req.query);
        res.json(venues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/venues/sections - Fetch all homepage sections in one call
router.get('/sections', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
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
router.get('/nearby', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        const venues = await venueService.getNearbyVenues(lat, lng, /** @type {any} */ (radius));
        res.json(venues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/venues/my-venues - Get venues owned by current user (venue owner only)
router.get('/my-venues', venueOwnerAuth, noStoreCache, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const venues = await venueService.getVenuesByOwner(req.user._id);
        res.json(venues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/venues/:id - Get venue by ID (public)
router.get('/:id', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const venue = await venueService.getVenueById(req.params.id);
        res.json(venue);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/venues - Create new venue (venue owner only)
router.post('/', venueOwnerAuth, validate(locationLinkBody), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    console.log('🏢 [VENUE POST] Creating new venue...');
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));

    try {
        // Add owner from authenticated user
        const venueData = {
            ...req.body,
            owner: req.user._id
        };
        const venue = await venueService.createVenue(venueData);
        await invalidateCache('venues');
        console.log('✅ [VENUE POST] Venue created successfully:', /** @type {any} */ (venue)._id);
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
router.put('/:id', venueOwnerAuth, validate(locationLinkBody), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // Verify ownership
        const existingVenue = await venueService.getVenueById(req.params.id);
        if (existingVenue.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not own this venue' });
        }
        const venue = await venueService.updateVenue(req.params.id, req.body);
        await invalidateCache('venues');
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/venues/:id - Delete venue (venue owner only, must own the venue)
router.delete('/:id', venueOwnerAuth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // Verify ownership
        const existingVenue = await venueService.getVenueById(req.params.id);
        if (existingVenue.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not own this venue' });
        }
        await venueService.deleteVenue(req.params.id);
        await invalidateCache('venues');
        res.json({ message: 'Venue deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/venues/:id/availability - Update venue availability (venue owner only)
router.put('/:id/availability', venueOwnerAuth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // Verify ownership
        const existingVenue = await venueService.getVenueById(req.params.id);
        if (existingVenue.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not own this venue' });
        }
        const venue = await venueService.updateAvailability(req.params.id, req.body);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/venues/:id/status - Update venue status (admin only - keep for future)
router.put('/:id/status', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const venue = await venueService.updateStatus(req.params.id, req.body.status);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/venues/:id/cancel - Delete venue (venue owner only)
router.post('/:id/cancel', venueOwnerAuth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // Verify ownership
        const existingVenue = await venueService.getVenueById(req.params.id);
        if (existingVenue.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not own this venue' });
        }
        const result = await venueService.deleteVenue(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/venues/:id/reviews - Submit a venue review (requires auth + completed booking)
router.post('/:id/reviews', requireAuth(), /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const review = await venueService.submitReview(req.user._id, req.params.id, req.body.rating, req.body.comment);
        res.status(201).json(review);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: error.message });
    }
});

// PATCH /api/venues/:id/cancellation-policy - Update cancellation policy (venue owner only)
router.patch('/:id/cancellation-policy', venueOwnerAuth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // Verify ownership
        const existingVenue = await venueService.getVenueById(req.params.id);
        if (existingVenue.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You do not own this venue' });
        }
        // Validate policy constraints
        venueService.validateCancellationPolicy(req.body);
        // Update venue with new cancellation policy
        const venue = await venueService.updateVenue(req.params.id, { cancellationPolicy: req.body });
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;

