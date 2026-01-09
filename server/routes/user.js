const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const auth = require('../middleware/auth');

// GET /api/users - Get all users (admin only)
router.get('/', auth, async (req, res) => {
    try {
        const users = await userService.getAllUsers(req.query);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/brands - Get verified brands
router.get('/brands', async (req, res) => {
    try {
        // Pass query params: type, search, sort, lat, lng, page, limit
        const result = await userService.getBrands(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// PUT /api/users/:id - Update user
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const user = await userService.updateUser(req.params.id, req.body);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        await userService.deleteUser(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/users/:id/follow - Follow a user
router.post('/:id/follow', auth, async (req, res) => {
    try {
        const result = await userService.followUser(req.user._id, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/users/:id/unfollow - Unfollow a user
router.post('/:id/unfollow', auth, async (req, res) => {
    try {
        const result = await userService.unfollowUser(req.user._id, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
