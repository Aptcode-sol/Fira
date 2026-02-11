const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');

// ================== DASHBOARD ==================
router.get('/stats', async (req, res) => {
    try {
        const stats = await adminService.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================== USERS ==================
router.get('/users', async (req, res) => {
    try {
        const result = await adminService.getAllUsers(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/users/:id', async (req, res) => {
    try {
        const user = await adminService.getUserById(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

router.put('/users/:id/block', async (req, res) => {
    try {
        const user = await adminService.blockUser(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/users/:id/unblock', async (req, res) => {
    try {
        const user = await adminService.unblockUser(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ================== VENUES ==================
router.get('/venues', async (req, res) => {
    try {
        const result = await adminService.getVenues(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/venues/:id', async (req, res) => {
    try {
        const venue = await adminService.getVenueById(req.params.id);
        res.json(venue);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

router.put('/venues/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected', 'blocked'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const venue = await adminService.updateVenueStatus(req.params.id, status);
        res.json(venue);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ================== EVENTS ==================
router.get('/events', async (req, res) => {
    try {
        const result = await adminService.getEvents(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/events/:id', async (req, res) => {
    try {
        const event = await adminService.getEventById(req.params.id);
        res.json(event);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

router.put('/events/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'upcoming', 'approved', 'rejected', 'blocked', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const event = await adminService.updateEventStatus(req.params.id, status);
        res.json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ================== BRANDS ==================
router.get('/brands', async (req, res) => {
    try {
        const result = await adminService.getBrands(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/brands/:id', async (req, res) => {
    try {
        const brand = await adminService.getBrandById(req.params.id);
        res.json(brand);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

router.put('/brands/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected', 'blocked'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const brand = await adminService.updateBrandStatus(req.params.id, status);
        res.json(brand);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
