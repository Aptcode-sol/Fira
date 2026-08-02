const Notification = require('../models/Notification');
const pushService = require('./pushService');

/**
 * Channels that should also fire a browser push. `in_app` stays silent - it is
 * for things the user will see next time they open the inbox.
 */
const PUSH_CHANNELS = new Set(['push', 'all']);

/**
 * Fire-and-forget push. Notifications must never fail the action that caused
 * them, so this logs and swallows rather than rejecting.
 */
function dispatchPush(userIds, { title, message, data }) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    if (ids.length === 0) return;

    pushService
        .sendToUsers(ids, {
            title,
            body: message,
            url: data?.actionUrl || '/inbox',
            data: { referenceId: data?.referenceId, ...(data?.extra || {}) }
        })
        .catch(err => console.error('Push dispatch failed:', err.message));
}

const notificationService = {
    // Get user's notifications
    async getUserNotifications(userId, limit = 50) {
        const notifications = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        return notifications;
    },

    // Get unread count
    async getUnreadCount(userId) {
        const count = await Notification.countDocuments({ user: userId, isRead: false });
        return count;
    },

    // Get notification by ID
    async getNotificationById(id) {
        const notification = await Notification.findById(id);
        if (!notification) {
            throw new Error('Notification not found');
        }
        return notification;
    },

    // Create notification
    async createNotification({ userId, type, title, message, data, priority = 'medium', channel = 'in_app' }) {
        const notification = await Notification.create({
            user: userId,
            type,
            title,
            message,
            data,
            priority,
            channel
        });

        if (PUSH_CHANNELS.has(channel)) {
            dispatchPush(userId, { title, message, data });
        }

        return notification;
    },

    // Mark as read
    async markAsRead(id) {
        const notification = await Notification.findByIdAndUpdate(
            id,
            { $set: { isRead: true, readAt: new Date() } },
            { new: true }
        );
        if (!notification) {
            throw new Error('Notification not found');
        }
        return notification;
    },

    // Mark all as read
    async markAllAsRead(userId) {
        await Notification.updateMany(
            { user: userId, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );
        return { message: 'All notifications marked as read' };
    },

    // Delete notification
    async deleteNotification(id) {
        const notification = await Notification.findByIdAndDelete(id);
        if (!notification) {
            throw new Error('Notification not found');
        }
        return { message: 'Notification deleted' };
    },

    // Send bulk notifications (for events like new event from followed user)
    async sendBulkNotifications(userIds, { type, title, message, data, channel = 'all' }) {
        const notifications = userIds.map(userId => ({
            user: userId,
            type,
            title,
            message,
            data,
            channel
        }));

        await Notification.insertMany(notifications);

        if (PUSH_CHANNELS.has(channel)) {
            dispatchPush(userIds, { title, message, data });
        }

        return { message: `Sent ${userIds.length} notifications` };
    },

    // Notify all followers of a brand
    async notifyBrandFollowers(brandId, type, notificationData, sendEmail = true) {
        const User = require('../models/User');
        const BrandProfile = require('../models/BrandProfile');
        const emailService = require('./emailService');

        // Get the brand info
        const brand = await BrandProfile.findById(brandId).select('name profilePhoto');
        if (!brand) {
            console.error('Brand not found for notifications:', brandId);
            return { success: false, message: 'Brand not found' };
        }

        // Get all users following this brand
        const followers = await User.find({
            followingBrands: brandId
        }).select('_id email name');

        if (followers.length === 0) {
            return { success: true, notificationsSent: 0, emailsSent: 0 };
        }

        // Create notifications for all followers
        const notifications = followers.map(follower => ({
            user: follower._id,
            type,
            title: notificationData.title,
            message: notificationData.message,
            data: {
                referenceId: notificationData.referenceId,
                referenceModel: notificationData.referenceModel,
                actionUrl: notificationData.actionUrl,
                extra: {
                    brandId: brandId,
                    brandName: brand.name,
                    ...notificationData.extra
                }
            },
            channel: sendEmail ? 'all' : 'in_app'
        }));

        await Notification.insertMany(notifications);

        // Push to every follower's devices in one batch
        dispatchPush(followers.map(f => f._id), {
            title: notificationData.title,
            message: notificationData.message,
            data: {
                referenceId: notificationData.referenceId,
                actionUrl: notificationData.actionUrl,
                extra: { brandId, brandName: brand.name }
            }
        });

        // Send emails if enabled
        let emailsSent = 0;
        if (sendEmail) {
            for (const follower of followers) {
                try {
                    await emailService.sendBrandActivityEmail(
                        follower.email,
                        follower.name,
                        brand.name,
                        type,
                        notificationData
                    );
                    emailsSent++;
                } catch (error) {
                    console.error(`Failed to send brand activity email to ${follower.email}:`, error.message);
                }
            }
        }

        console.log(`✅ Brand notification sent: ${followers.length} notifications, ${emailsSent} emails`);
        return {
            success: true,
            notificationsSent: followers.length,
            emailsSent
        };
    }
};

module.exports = notificationService;
