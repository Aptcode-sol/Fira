const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['venue_booking', 'event_tickets'],
        required: true
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'referenceModel'
    },
    // 'Booking' is a payout for one booking. 'Venue' rows are whole-venue
    // payouts from the removed admin raise-payout step, kept so they still load.
    referenceModel: {
        type: String,
        enum: ['Booking', 'Event', 'Venue'],
        required: true
    },
    grossAmount: {
        type: Number,
        required: true
    },
    platformCommission: {
        type: Number,
        required: true
    },
    // No automatic commission: the admin agrees any cut with the owner and types
    // the final amount. Kept so older payout rows still read the same.
    platformCommissionPercentage: {
        type: Number,
        default: 0
    },
    netAmount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    bankDetails: {
        accountName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        ifscCode: { type: String, required: true },
        bankName: { type: String, required: true }
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    method: {
        type: String,
        enum: ['manual', 'gateway'],
        default: 'manual'
    },
    gatewayPayoutId: {
        type: String,
        default: null
    },
    gatewayResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    processedAt: {
        type: Date,
        default: null
    },
    failureReason: {
        type: String,
        default: null
    },
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // Admin who initiated payout
    },
    notes: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
payoutSchema.index({ recipient: 1 });
payoutSchema.index({ type: 1 });
payoutSchema.index({ status: 1 });
payoutSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payout', payoutSchema);
