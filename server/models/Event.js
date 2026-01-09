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
        // Required only when not using a custom venue
        required: function () {
            try {
                return !(this.customVenue && this.customVenue.isCustom);
            } catch (e) {
                return true;
            }
        }
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
    // Combined datetime fields - store full date+time together
    startDateTime: {
        type: Date,
        required: true
    },
    endDateTime: {
        type: Date,
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
    friendsAndFamilyStay: {
        type: Boolean,
        default: false
    },
    allowAlcohol: {
        type: Boolean,
        default: false
    },
    customVenue: {
        isCustom: {
            type: Boolean,
            default: false
        },
        name: String,
        description: String,
        address: String,
        city: String,
        state: String,
        pincode: String,
        capacity: Number,
        images: [String],
        // Mandatory link to maps when using a custom venue
        locationLink: String
    },
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
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
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
eventSchema.index({ startDateTime: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ eventType: 1 });

module.exports = mongoose.model('Event', eventSchema);
