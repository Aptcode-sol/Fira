const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['venue_booking', 'ticket_purchase', 'ticket'],
        required: true
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'referenceModel'
    },
    referenceModel: {
        type: String,
        enum: ['Booking', 'Ticket', 'Event'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    platformFee: {
        type: Number,
        default: 0
    },
    platformFeePercentage: {
        type: Number,
        default: 5 // 5% platform fee
    },
    netAmount: {
        type: Number,
        default: 0 // amount - platformFee
    },
    currency: {
        type: String,
        default: 'INR'
    },
    paymentMethod: {
        type: String,
        enum: ['upi', 'card', 'netbanking', 'wallet'],
        default: null
    },
    gatewayTransactionId: {
        type: String,
        default: null
    },
    gatewayOrderId: {
        type: String,
        default: null
    },
    gatewayResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'success', 'failed', 'refunded'],
        default: 'pending'
    },
    paidAt: {
        type: Date,
        default: null
    },
    failureReason: {
        type: String,
        default: null
    },
    subtotal: {
        type: Number,
        default: 0
    },
    gstAmount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    discountCode: {
        type: String,
        default: null
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    discountBearer: {
        type: String,
        enum: ['platform', 'owner'],
        default: null
    },
    listedPrice: {
        type: Number,
        default: 0
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Calculate net amount before saving (only when billing breakdown not explicitly set)
paymentSchema.pre('save', function () {
    if (this.amount && this.platformFeePercentage) {
        // Only auto-calculate if platformFee wasn't explicitly set during creation
        if (!this.platformFee) {
            this.platformFee = Math.round(this.amount * (this.platformFeePercentage / 100));
        }
        this.netAmount = this.amount - this.platformFee;
    }
});

// Indexes
paymentSchema.index({ user: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ gatewayTransactionId: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
