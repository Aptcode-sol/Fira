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
    },
    paymentSchedule: {
        type: { type: String, enum: ['full', 'installment'], default: 'full' },
        depositAmount: { type: Number, default: 0 },
        balanceAmount: { type: Number, default: 0 },
        balanceDueAt: { type: Date, default: null },
        balanceStatus: {
            type: String,
            enum: ['not_applicable', 'pending', 'paid', 'forfeited'],
            default: 'not_applicable'
        },
        balancePayment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
        lastReminderOn: { type: String, default: null } // 'YYYY-MM-DD', once-per-day reminder dedupe
    },
    cancellationReason: { type: String, default: null } // e.g. 'missed_payment_deadline'
}, {
    timestamps: true
});

// Indexes
bookingSchema.index({ user: 1 });
bookingSchema.index({ venue: 1 });
bookingSchema.index({ bookingDate: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ 'paymentSchedule.balanceStatus': 1, 'paymentSchedule.balanceDueAt': 1 });

// Atomic backstop for the same-day conflict check in bookingService.createBooking.
// That check is a read-then-write (findOne, then create) - two requests landing in
// the same instant can both pass the read before either writes. A DB-level unique
// index is the only thing that closes that window; the app-level check just avoids
// paying for a failed insert on the common (non-racing) path.
// Partial so 'rejected'/'cancelled'/'completed' bookings don't block a fresh date.
bookingSchema.index(
    { venue: 1, bookingDate: 1 },
    {
        unique: true,
        partialFilterExpression: { status: { $in: ['pending', 'accepted'] } }
    }
);

module.exports = mongoose.model('Booking', bookingSchema);
