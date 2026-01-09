const express = require('express');
const router = express.Router();
const brandService = require('../services/brandService');
const postService = require('../services/postService');
const eventService = require('../services/eventService');
const auth = require('../middleware/auth');

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
router.get('/my-profile', auth, async (req, res) => {
    try {
        // Use req.user._id from auth middleware instead of query param
        const profile = await brandService.getBrandByUserId(req.user._id);
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
router.post('/', auth, async (req, res) => {
    const data = req.body;
    // Remove userId from body if present, stick to authenticated user
    delete data.userId;

    try {
        const profile = await brandService.updateProfile(req.user._id, data);
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
router.post('/:id/posts', auth, async (req, res) => {
    try {
        // Verify user owns the brand they are posting to
        const brand = await brandService.getBrandById(req.params.id);
        if (!brand) return res.status(404).json({ error: 'Brand not found' });

        if (brand.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized: You do not own this brand' });
        }

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
router.post('/:id/follow', auth, async (req, res) => {
    try {
        const result = await brandService.followBrand(req.user._id, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/brands/:id/follow - Unfollow a brand
router.delete('/:id/follow', auth, async (req, res) => {
    try {
        const result = await brandService.unfollowBrand(req.user._id, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/brands/:id/follow/status - Check if user follows brand
router.get('/:id/follow/status', auth, async (req, res) => {
    try {
        const result = await brandService.isFollowingBrand(req.user._id, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================== POST CRUD ROUTES ==================

// PUT /api/brands/:id/posts/:postId - Update a post
router.put('/:id/posts/:postId', auth, async (req, res) => {
    const data = req.body;
    delete data.userId; // valid only if user owns post

    try {
        const post = await postService.updatePost(req.params.postId, req.params.id, req.user._id, data);
        res.json(post);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/brands/:id/posts/:postId - Delete a post
router.delete('/:id/posts/:postId', auth, async (req, res) => {
    try {
        const result = await postService.deletePost(req.params.postId, req.params.id, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/brands/:id/posts/:postId/like - Toggle like on a post
router.post('/:id/posts/:postId/like', auth, async (req, res) => {
    try {
        const result = await postService.toggleLike(req.params.postId, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/brands/:id/posts/:postId/comments - Add comment to a post
router.post('/:id/posts/:postId/comments', auth, async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    try {
        const comments = await postService.addComment(req.params.postId, req.user._id, content);
        res.json({ comments });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/brands/:id/posts/:postId/comments/:commentId - Delete a comment
router.delete('/:id/posts/:postId/comments/:commentId', auth, async (req, res) => {
    try {
        const result = await postService.deleteComment(req.params.postId, req.params.commentId, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;


