// @ts-check
const express = require('express');
const router = express.Router();
const eventService = require('../services/eventService');
const notificationService = require('../services/notificationService');

const auth = require('../middleware/auth');
const { publicCache, invalidateCache } = require('../middleware/httpCache');

/**
 * Validate ticketTiers array for event create/edit.
 * Returns an error string if invalid, null if valid.
 */
function validateTicketTiers(ticketTiers) {
    if (!ticketTiers || !Array.isArray(ticketTiers)) return null; // optional field, skip if absent
    if (ticketTiers.length < 1 || ticketTiers.length > 10) {
        return 'ticketTiers must contain between 1 and 10 tiers';
    }
    const names = new Set();
    for (const tier of ticketTiers) {
        if (!tier.name || typeof tier.name !== 'string' || tier.name.trim().length === 0 || tier.name.trim().length > 50) {
            return 'Each tier must have a name between 1 and 50 characters';
        }
        const normalizedName = tier.name.trim().toLowerCase();
        if (names.has(normalizedName)) {
            return 'Duplicate tier names are not allowed';
        }
        names.add(normalizedName);
        if (typeof tier.price !== 'number' || tier.price < 0) {
            return 'Each tier must have a price >= 0';
        }
        if (!Number.isInteger(tier.maxQuantity) || tier.maxQuantity < 1) {
            return 'Each tier must have a maxQuantity >= 1';
        }
    }
    return null;
}

/**
 * @typedef {import('../middleware/types').AuthenticatedRequest} AuthenticatedRequest
 * @typedef {import('express').Response} Response
 */

// GET /api/events - Get all events
router.get('/', publicCache, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { includeCompleted, ...restQuery } = req.query;
        const events = await eventService.getAllEvents(restQuery);

        // When includeCompleted=true, fetch completed events separately
        if (includeCompleted === 'true') {
            const Event = require('../models/Event');
            const completedEvents = await Event.find({
                status: 'completed',
                isDeleted: { $ne: true }
            })
                .populate('organizer', 'name email verificationBadge')
                .populate('venue', 'name address images')
                .sort({ endDateTime: -1 })
                .limit(20)
                .lean();
            return res.json({ ...events, completedEvents });
        }

        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/events/sections - Fetch all homepage sections in one call
router.get('/sections', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const [upcoming, top, latest] = await Promise.all([
            eventService.getAllEvents({ status: 'upcoming', eventType: 'public', sort: 'upcoming' }),
            eventService.getAllEvents({ status: 'upcoming', eventType: 'public', sort: 'top' }),
            eventService.getAllEvents({ eventType: 'public', sort: 'latest' }),
        ]);
        res.json({
            upcoming: upcoming.events || [],
            top: top.events || [],
            latest: latest.events || [],
        });
    } catch (error) {
        console.error('Error fetching event sections:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/events/upcoming - Get upcoming events
router.get('/upcoming', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const events = await eventService.getUpcomingEvents(req.query);
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/events/venue-requests - Get events pending venue approval (for venue owners)
router.get('/venue-requests', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
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
router.get('/admin-pending', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await eventService.getPendingAdminApproval(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const event = await eventService.getEventById(req.params.id);
        res.json(event);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /api/events - Create new event
router.post('/', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // Validate ticketTiers if provided
        const tierError = validateTicketTiers(req.body.ticketTiers);
        if (tierError) {
            return res.status(400).json({ error: tierError });
        }

        const eventData = { ...req.body, organizer: req.user._id };
        const event = await eventService.createEvent(eventData);
        await invalidateCache('events');
        res.status(201).json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/events/:id - Update event
router.put('/:id', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // Validate ticketTiers if provided
        const tierError = validateTicketTiers(req.body.ticketTiers);
        if (tierError) {
            return res.status(400).json({ error: tierError });
        }

        // Fetch current event state to detect field changes for notifications
        const currentEvent = await eventService.getEventById(req.params.id);

        const event = await eventService.updateEvent(req.params.id, req.body);
        await invalidateCache('events');

        // Detect changes to notifiable fields and fire notifications asynchronously
        const trackedFields = ['name', 'startDateTime', 'endDateTime', 'venue', 'description'];
        const changedFields = [];
        for (const field of trackedFields) {
            const oldVal = currentEvent[field];
            const newVal = req.body[field];
            if (newVal !== undefined) {
                // Compare as strings to handle ObjectIds and Date objects
                const oldStr = oldVal != null ? String(oldVal._id || oldVal) : '';
                const newStr = newVal != null ? String(newVal) : '';
                if (oldStr !== newStr) {
                    changedFields.push(field);
                }
            }
        }

        if (changedFields.length > 0) {
            // Fire-and-forget with error swallowing — don't block the response
            notificationService.sendEventUpdateNotifications(event, changedFields, req.user).catch(err => {
                console.error('Failed to send event update notifications:', err.message);
            });
        }

        res.json(event);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        await eventService.deleteEvent(req.params.id);
        await invalidateCache('events');
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/events/:id/cancel - Cancel event
router.post('/:id/cancel', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { reason } = req.body;
        const result = await eventService.cancelEvent(req.params.id, reason);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/events/:id/access - Request access to private event
router.post('/:id/access', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await eventService.requestPrivateAccess(req.params.id, { ...req.body, userId: req.user._id });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/events/:id/access/:requestId - Approve/reject access request
router.put('/:id/access/:requestId', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await eventService.handleAccessRequest(req.params.requestId, req.body.status);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/events/:id/venue-approve - Venue owner approves/rejects event
router.post('/:id/venue-approve', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
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
router.post('/:id/admin-approve', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
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

// =================== SCANNING CODE ROUTES ===================

// POST /api/events/:id/scanning-codes - Create scanning codes for an event
router.post('/:id/scanning-codes', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const codes = await eventService.createScanningCodes(req.params.id, req.body.labels || [], req.user._id);
        res.status(201).json(codes);
    } catch (error) {
        const status = error.message.includes('not found') ? 404
            : error.message.includes('Only the event organizer') ? 403
            : 400;
        res.status(status).json({ error: error.message });
    }
});

// GET /api/events/:id/scanning-codes - List scanning codes for an event (organizer only)
router.get('/:id/scanning-codes', auth, async (req, res) => {
    try {
        const ScanningCode = require('../models/ScanningCode');
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.organizer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the event organizer can view scanning codes' });
        }
        const codes = await ScanningCode.find({ event: req.params.id }).sort({ createdAt: -1 });
        res.json(codes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/events/:id/scanning-codes/:codeId/deactivate - Deactivate a scanning code
router.patch('/:id/scanning-codes/:codeId/deactivate', auth, async (req, res) => {
    try {
        const code = await eventService.deactivateScanningCode(req.params.codeId, req.user._id);
        res.json(code);
    } catch (error) {
        const status = error.message.includes('not found') ? 404
            : error.message.includes('Only the code creator') ? 403
            : 400;
        res.status(status).json({ error: error.message });
    }
});

// =================== EVENT POST ROUTES ===================
const postService = require('../services/postService');

// GET /api/events/:id/posts - Get all posts for an event
router.get('/:id/posts', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await postService.getEventPosts(req.params.id, /** @type {any} */ (req.query.page), /** @type {any} */ (req.query.limit));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/events/:id/posts - Create a post for an event
router.post('/:id/posts', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    const { content, images } = req.body;

    try {
        const post = await postService.createEventPost(req.params.id, req.user._id, { content, images });
        res.status(201).json(post);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/events/:id/posts/:postId - Update an event post
router.put('/:id/posts/:postId', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    const { content, images } = req.body;

    try {
        const post = await postService.updateEventPost(req.params.postId, req.params.id, req.user._id, { content, images });
        res.json(post);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/events/:id/posts/:postId - Delete an event post
router.delete('/:id/posts/:postId', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await postService.deleteEventPost(req.params.postId, req.params.id, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/events/:id/posts/:postId/like - Toggle like on a post
router.post('/:id/posts/:postId/like', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await postService.toggleLike(req.params.postId, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/events/:id/posts/:postId/comments - Add comment to a post
router.post('/:id/posts/:postId/comments', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
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
router.delete('/:id/posts/:postId/comments/:commentId', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const result = await postService.deleteComment(req.params.postId, req.params.commentId, req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;

