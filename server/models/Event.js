const mongoose = require('mongoose');
const crypto = require('crypto');

const eventSchema = new mongoose.Schema({
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    venue: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    images: [{
        type: String
    }],
    date: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        default: function () { return this.date; } // Defaults to same day
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    eventType: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
    },
    ticketType: {
        type: String,
        enum: ['free', 'paid'],
        default: 'free'
    },
    ticketPrice: {
        type: Number,
        default: 0
    },
    maxAttendees: {
        type: Number,
        required: true
    },
    currentAttendees: {
        type: Number,
        default: 0
    },
    privateCode: {
        type: String,
        default: null
    },
    category: {
        type: String,
        enum: ['party', 'concert', 'wedding', 'corporate', 'birthday', 'festival', 'other'],
        default: 'party'
    },
    tags: [{
        type: String
    }],
    termsAndConditions: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'upcoming', 'approved', 'ongoing', 'completed', 'cancelled', 'rejected', 'blocked'],
        default: 'pending'
    },
    // Dual approval system
    venueApproval: {
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        respondedAt: Date,
        respondedBy: String,
        rejectionReason: String
    },
    adminApproval: {
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        respondedAt: Date,
        respondedBy: String,
        rejectionReason: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Generate private code for private events
eventSchema.pre('save', async function () {
    if (this.eventType === 'private' && !this.privateCode) {
        this.privateCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    }
});

// Indexes
eventSchema.index({ organizer: 1 });
eventSchema.index({ venue: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ eventType: 1 });

module.exports = mongoose.model('Event', eventSchema);
