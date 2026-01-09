const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    venue: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        default: null
    },
    bookingType: {
        type: String,
        enum: ['event', 'personal'],
        default: 'event'
    },
    bookingDate: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        default: null
    },
    expectedGuests: {
        type: Number,
        default: 0
    },
    specialRequests: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
        default: 'pending'
    },
    rejectionReason: {
        type: String,
        default: null
    },
    totalAmount: {
        type: Number,
        required: true
    },
    platformFee: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'failed'],
        default: 'pending'
    },
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        default: null
    },
    ownerResponse: {
        respondedAt: { type: Date, default: null },
        modifiedDates: {
            bookingDate: { type: Date, default: null },
            startTime: { type: String, default: null },
            endTime: { type: String, default: null }
        }
    }
}, {
    timestamps: true
});

// Indexes
bookingSchema.index({ venue: 1 });
bookingSchema.index({ bookingDate: 1 });
bookingSchema.index({ status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
