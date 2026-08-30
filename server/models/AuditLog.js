const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    adminUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        // 'update' covers a change the other words cannot name - a status moved back
        // to 'pending', an event 'cancelled'. Without it those writes failed enum
        // validation and the action went unrecorded, which is the worst outcome for an
        // audit log: silently incomplete. metadata carries the actual from/to.
        // 'settle' / 'reverse' are money movement over a listing's settlement ledger.
        // They are named rather than folded into 'update' for the same reason: a value
        // missing here means Settlement recording fails enum validation and the action
        // goes silently unrecorded, and a distinct word is what lets the audit surface
        // filter money movement apart from ordinary status edits.
        enum: ['approve', 'reject', 'block', 'unblock', 'feature', 'unfeature', 'delete', 'update',
            'settle', 'reverse'],
        required: true
    },
    entityType: {
        type: String,
        enum: ['event', 'venue', 'creator', 'user'],
        required: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Indexes
auditLogSchema.index({ entityType: 1, action: 1 });
auditLogSchema.index({ adminUser: 1 });
auditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
