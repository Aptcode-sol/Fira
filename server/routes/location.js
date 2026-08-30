// @ts-check
const express = require('express');
const router = express.Router();
const locationService = require('../services/locationService');
const { locationLimiter } = require('../middleware/rateLimiters');

/**
 * City lookup. Public on purpose - signup needs it before an account exists.
 *
 * Rate limited because each miss can cost a provider call, and an unbounded
 * autocomplete endpoint is a cheap way for someone else to spend our quota.
 */

// GET /api/locations/cities?q=vell — suggestions for the address forms
router.get('/cities', locationLimiter, async (req, res) => {
    try {
        const q = typeof req.query.q === 'string' ? req.query.q : '';
        const { results, source } = await locationService.searchCities(q);

        // Suggestions for one query are stable for a long time and identical for
        // every user, so let the CDN and the browser hold them.
        res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        res.json({ results, source, minLength: locationService.MIN_QUERY_LENGTH });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/locations/listed — cities that currently have listings, with counts.
// Drives the city filter, the city landing pages and the sitemap.
router.get('/listed', async (req, res) => {
    try {
        const cities = await locationService.listedCities();
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
        res.json({ cities });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
