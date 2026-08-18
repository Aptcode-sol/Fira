const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: [
            'booking_request',
            'booking_accepted',
            'booking_rejected',
            'booking_cancelled',
            'payment_success',
            'payment_failed',
            'refund_processed',
            // Emitted by refundService when a ticket is cancelled and when a
            // refund changes state. Both were missing from this enum, so
            // Notification.create() threw a ValidationError mid-cancellation -
            // surfacing to the user as
            // "type: `ticket_cancelled` is not a valid enum value for path `type`".
            'ticket_cancelled',
            'refund_update',
            'event_reminder',
            'event_reminder_1h',
            'event_cancelled',
            'event_update',
            'new_event',
            'ticket_purchased',
            'verification_approved',
            'verification_rejected',
            'private_event_request',
            'private_event_approved',
            'private_event_rejected',
            'new_follower',
            'payout_completed',
            'brand_new_event',
            'brand_new_post',
            'event_new_post',
            'system'
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    data: {
        referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
        referenceModel: { type: String, default: null },
        actionUrl: { type: String, default: null },
        extra: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    channel: {
        type: String,
        enum: ['in_app', 'email', 'sms', 'push', 'all'],
        default: 'in_app'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    sentAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
