const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        enum: ['event_cancelled', 'booking_cancelled', 'duplicate_payment', 'admin_initiated', 'user_request', 'other'],
        required: true
    },
    reasonDetails: {
        type: String,
        default: null
    },
    amount: {
        type: Number,
        required: true
    },
    refundType: {
        type: String,
        enum: ['full', 'partial'],
        default: 'full'
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    gatewayRefundId: {
        type: String,
        default: null
    },
    gatewayResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    processedAt: {
        type: Date,
        default: null
    },
    adminNotes: {
        type: String,
        default: null
    },
    rejectionReason: {
        type: String,
        default: null
    },
    failureReason: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
refundSchema.index({ payment: 1 });
refundSchema.index({ user: 1 });
refundSchema.index({ status: 1 });
refundSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Refund', refundSchema);
