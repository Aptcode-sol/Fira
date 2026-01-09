const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');

const auth = require('../middleware/auth');

// GET /api/notifications - Get user's notifications
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await notificationService.getUserNotifications(req.user._id);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/notifications/unread - Get unread count
router.get('/unread', auth, async (req, res) => {
    try {
        const count = await notificationService.getUnreadCount(req.user._id);
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/notifications/:id - Get notification by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const notification = await notificationService.getNotificationById(req.params.id);
        res.json(notification);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// PUT /api/notifications/:id/read - Mark as read
router.put('/:id/read', auth, async (req, res) => {
    try {
        const notification = await notificationService.markAsRead(req.params.id);
        res.json(notification);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', auth, async (req, res) => {
    try {
        const result = await notificationService.markAllAsRead(req.user._id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', auth, async (req, res) => {
    try {
        await notificationService.deleteNotification(req.params.id);
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
