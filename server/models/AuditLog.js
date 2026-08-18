const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    adminUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        enum: ['approve', 'reject', 'block', 'unblock', 'feature', 'unfeature'],
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
