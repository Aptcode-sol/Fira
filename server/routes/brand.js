const express = require('express');
const router = express.Router();
const brandService = require('../services/brandService');
const postService = require('../services/postService');
const eventService = require('../services/eventService');
// const auth = require('../middleware/auth'); // Assuming auth middleware exists

// GET /api/brands - Get all brands with filters
router.get('/', async (req, res) => {
    try {
        const result = await brandService.getBrands(req.query);
        res.json(result);
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/brands/my-profile - Get current user's brand profile
router.get('/my-profile', async (req, res) => {
    // Assuming auth middleware sets req.user
    if (!req.query.userId) {
        return res.status(401).json({ error: 'User ID required (Auth middleware pending)' });
    }

    try {
        const profile = await brandService.getBrandByUserId(req.query.userId);
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/brands/:id - Get brand by ID
router.get('/:id', async (req, res) => {
    try {
        const brand = await brandService.getBrandById(req.params.id);
        res.json(brand);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/brands - Create/Update profile
router.post('/', async (req, res) => {
    // Needs Auth
    const { userId, ...data } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const profile = await brandService.updateProfile(userId, data);
        res.json(profile);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/brands/:id/posts - Get brand posts
router.get('/:id/posts', async (req, res) => {
    try {
        const result = await postService.getBrandPosts(req.params.id, req.query.page, req.query.limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/brands/:id/posts - Create brand post
router.post('/:id/posts', async (req, res) => {
    // Needs Auth and check if user owns brand
    // For now assuming req.body has necessary data or user is validated
    try {
        const post = await postService.createPost(req.params.id, req.body);
        res.status(201).json(post);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/brands/:id/events - Get brand events
router.get('/:id/events', async (req, res) => {
    try {
        const brand = await brandService.getBrandById(req.params.id);
        if (!brand) return res.status(404).json({ error: 'Brand not found' });

        // Use eventService to get events by organizer (brand.user._id)
        const events = await eventService.getEventsByOrganizer(brand.user._id);
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================== FOLLOW ROUTES ==================

// POST /api/brands/:id/follow - Follow a brand
router.post('/:id/follow', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const result = await brandService.followBrand(userId, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/brands/:id/follow - Unfollow a brand
router.delete('/:id/follow', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const result = await brandService.unfollowBrand(userId, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/brands/:id/follow/status - Check if user follows brand
router.get('/:id/follow/status', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const result = await brandService.isFollowingBrand(userId, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================== POST CRUD ROUTES ==================

// PUT /api/brands/:id/posts/:postId - Update a post
router.put('/:id/posts/:postId', async (req, res) => {
    const { userId, ...data } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const post = await postService.updatePost(req.params.postId, req.params.id, userId, data);
        res.json(post);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/brands/:id/posts/:postId - Delete a post
router.delete('/:id/posts/:postId', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const result = await postService.deletePost(req.params.postId, req.params.id, userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/brands/:id/posts/:postId/like - Toggle like on a post
router.post('/:id/posts/:postId/like', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const result = await postService.toggleLike(req.params.postId, userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/brands/:id/posts/:postId/comments - Add comment to a post
router.post('/:id/posts/:postId/comments', async (req, res) => {
    const { userId, content } = req.body;
    if (!userId || !content) return res.status(400).json({ error: 'User ID and content required' });

    try {
        const comments = await postService.addComment(req.params.postId, userId, content);
        res.json({ comments });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/brands/:id/posts/:postId/comments/:commentId - Delete a comment
router.delete('/:id/posts/:postId/comments/:commentId', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const result = await postService.deleteComment(req.params.postId, req.params.commentId, userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;


