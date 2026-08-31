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
        required: false
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
    /** Portrait poster image (3:4) for event cards. Separate from banner images. */
    coverPhoto: {
        type: String,
        default: null
    },
    /** Landscape images for the detail page banner and gallery. */
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
    // Platform fee % applied to paid ticket/tier billing (Flow 1/2/3). Persisted
    // so config can flow end-to-end into calculateBilling/processPayout; default 5
    // preserves current behavior for existing docs.
    platformFeePercentage: {
        type: Number,
        default: 5,
        min: 0,
        max: 100
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
        enum: ['party', 'concert', 'wedding', 'corporate', 'birthday', 'festival', 'music', 'dance', 'dj', 'clubbing', 'fitness', 'other'],
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
        /** Canonical slug of `city`. Derived by the hook below - see Venue.address.citySlug. */
        citySlug: String,
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
    /**
     * Which of the organizer's saved bankAccounts ticket revenue goes to.
     * An id into `User.bankAccounts`; null falls back to the mirrored default in
     * `User.bankDetails`, which is what the payout path reads today.
     */
    payoutAccount: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
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
    },
    ticketTiers: [{
        name: { type: String, required: true, trim: true, maxlength: 50 },
        price: { type: Number, required: true, min: 0 },
        description: { type: String, maxlength: 200, default: '' },
        maxQuantity: { type: Number, required: true, min: 1 },
        soldCount: { type: Number, default: 0 }
    }]
}, {
    timestamps: true
});

// Generate private code for private events
eventSchema.pre('save', async function () {
    if (this.eventType === 'private' && !this.privateCode) {
        this.privateCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    }
});

/**
 * Keep ticketType and ticketPrice consistent.
 *
 * They are two fields describing one fact, and they had drifted apart in real
 * data - an event with ticketType 'free' and ticketPrice 999 showed a price to
 * buyers while the purchase flow handed out free tickets.
 *
 * Price wins, because that is what the buyer is shown:
 *   price > 0  -> the event is paid
 *   type free  -> the price must be 0
 */
eventSchema.pre('save', function () {
    if (this.ticketPrice > 0) {
        this.ticketType = 'paid';
    } else {
        this.ticketType = 'free';
        this.ticketPrice = 0;
    }
});

// Indexes
eventSchema.index({ organizer: 1 });
eventSchema.index({ venue: 1 });
eventSchema.index({ startDateTime: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ eventType: 1 });
// Derives customVenue.citySlug from customVenue.city on every write path.
require('../utils/citySlugHook').attachCitySlug(eventSchema, 'customVenue');

// Compound indexes for common query patterns
eventSchema.index({ organizer: 1, status: 1, isDeleted: 1 }); // Dashboard queries
eventSchema.index({ status: 1, isActive: 1, startDateTime: 1 }); // Public listing
eventSchema.index({ 'customVenue.citySlug': 1, status: 1 }); // City filter / city pages
eventSchema.index({ venue: 1, status: 1, startDateTime: 1, endDateTime: 1 }); // Conflict checks

module.exports = mongoose.model('Event', eventSchema);
