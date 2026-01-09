const express = require('express');
const router = express.Router();
const eventService = require('../services/eventService');

const auth = require('../middleware/auth');

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

// GET /api/events/venue-requests - Get events pending venue approval (for venue owners)
router.get('/venue-requests', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        const result = await eventService.getVenueEventRequests(userId, req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/events/admin-pending - Get events pending admin approval
router.get('/admin-pending', async (req, res) => {
    try {
        const result = await eventService.getPendingAdminApproval(req.query);
        res.json(result);
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
router.post('/', auth, async (req, res) => {
    try {
        const eventData = { ...req.body, organizer: req.user._id };
        const event = await eventService.createEvent(eventData);
        res.status(201).json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/events/:id - Update event
router.put('/:id', auth, async (req, res) => {
    try {
        const event = await eventService.updateEvent(req.params.id, req.body);
        res.json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', auth, async (req, res) => {
    try {
        await eventService.deleteEvent(req.params.id);
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/events/:id/cancel - Cancel event
router.post('/:id/cancel', auth, async (req, res) => {
    try {
        const { reason } = req.body;
        const result = await eventService.cancelEvent(req.params.id, reason);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/events/:id/access - Request access to private event
router.post('/:id/access', auth, async (req, res) => {
    try {
        const result = await eventService.requestPrivateAccess(req.params.id, { ...req.body, userId: req.user._id });
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

// POST /api/events/:id/venue-approve - Venue owner approves/rejects event
router.post('/:id/venue-approve', async (req, res) => {
    try {
        const { venueOwnerId, status, rejectionReason } = req.body;
        if (!venueOwnerId || !status) {
            return res.status(400).json({ error: 'venueOwnerId and status are required' });
        }
        const event = await eventService.venueApproveEvent(req.params.id, venueOwnerId, { status, rejectionReason });
        res.json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/events/:id/admin-approve - Admin approves/rejects event
router.post('/:id/admin-approve', async (req, res) => {
    try {
        const { adminId, status, rejectionReason } = req.body;
        if (!adminId || !status) {
            return res.status(400).json({ error: 'adminId and status are required' });
        }
        const event = await eventService.adminApproveEvent(req.params.id, adminId, { status, rejectionReason });
        res.json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// =================== EVENT POST ROUTES ===================
const postService = require('../services/postService');

// GET /api/events/:id/posts - Get all posts for an event
router.get('/:id/posts', async (req, res) => {
    try {
        const result = await postService.getEventPosts(req.params.id, req.query.page, req.query.limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/events/:id/posts - Create a post for an event
router.post('/:id/posts', auth, async (req, res) => {
    const { content, images } = req.body;

    try {
        const post = await postService.createEventPost(req.params.id, req.user._id, { content, images });
        res.status(201).json(post);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/events/:id/posts/:postId - Update an event post
router.put('/:id/posts/:postId', auth, async (req, res) => {
    const { content, images } = req.body;

    try {
        const post = await postService.updateEventPost(req.params.postId, req.params.id, req.user._id, { content, images });
        res.json(post);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/events/:id/posts/:postId - Delete an event post
router.delete('/:id/posts/:postId', auth, async (req, res) => {
    try {
        const result = await postService.deleteEventPost(req.params.postId, req.params.id, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/events/:id/posts/:postId/like - Toggle like on a post
router.post('/:id/posts/:postId/like', auth, async (req, res) => {
    try {
        const result = await postService.toggleLike(req.params.postId, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/events/:id/posts/:postId/comments - Add comment to a post
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

// DELETE /api/events/:id/posts/:postId/comments/:commentId - Delete a comment
router.delete('/:id/posts/:postId/comments/:commentId', auth, async (req, res) => {
    try {
        const result = await postService.deleteComment(req.params.postId, req.params.commentId, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;

