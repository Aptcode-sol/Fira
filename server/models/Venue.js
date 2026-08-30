const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    venueType: {
        type: String,
        enum: ['banquet', 'hall', 'outdoor', 'restaurant', 'club', 'resort', 'farmhouse', 'rooftop', 'garden', 'beach', 'other'],
        default: 'other'
    },
    description: {
        type: String,
        required: true
    },
    images: [{
        type: String
    }],
    videos: [{
        type: String
    }],
    capacity: {
        min: { type: Number, default: 1 },
        max: { type: Number, required: true }
    },
    pricing: {
        /**
         * The venue's day rate - the single number owners set and guests compare.
         *
         * Replaces basePrice + pricePerHour. An hourly add-on on top of a flat
         * booking fee meant a venue had two numbers that had to be reasoned about
         * together, and it did not match how event spaces are actually let (by the
         * day). A booking's total is now simply dayRate x days.
         */
        pricePerDay: { type: Number, default: null },
        /**
         * Deprecated, kept for back-compat. Venues created before pricePerDay
         * existed only have this, and reads fall back to it (see venuePricing.js),
         * so no migration is needed. New writes set both: pricePerDay is
         * authoritative, basePrice mirrors it for anything still reading the old
         * field (SEO schema, admin lists, the venue portal list).
         */
        basePrice: { type: Number, required: true },
        /** Deprecated and no longer written. Old docs may still carry a value. */
        pricePerHour: { type: Number, default: null },
        currency: { type: String, default: 'INR' }
    },
    // Platform fee % applied to the booking-advance billing (Flow 1/3). Persisted
    // so config can flow into initiateBookingPayment/processPayout; default 5
    // preserves current behavior for existing docs.
    platformFeePercentage: {
        type: Number,
        default: 5,
        min: 0,
        max: 100
    },
    amenities: [{
        type: String
    }],
    rules: [{
        type: String
    }],
    /**
     * Optional GeoJSON point, used only by the "nearby venues" $near query.
     *
     * Deliberately NOT required. The creation form collects a maps link, not
     * latitude/longitude, so it has no real coordinates to submit. The previous
     * form satisfied this constraint by sending hardcoded Delhi coordinates for
     * every venue - which made $near treat every venue in the country as being in
     * Delhi. Absent coordinates are simply not indexed by 2dsphere, so an
     * un-geocoded venue drops out of proximity results instead of poisoning them.
     *
     * Populating this properly means geocoding the maps link (or capturing a pin at
     * creation); until then, missing is the honest value.
     */
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: undefined
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: undefined
        }
    },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        /**
         * Canonical slug of `city`, derived on every write by the hooks below.
         *
         * City names come from a geocoding provider, and providers disagree with
         * each other and with themselves over time (Bengaluru/Bangalore,
         * Panaji/Goa). Filtering on the display string splits one city into two
         * buckets nothing can join, and empties /venues/in/bangalore the day the
         * provider changes its mind. Matching happens on this instead.
         *
         * Never set this by hand - see the pre-save/pre-update hooks.
         */
        citySlug: { type: String, index: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, default: 'India' }
    },
    availability: [{
        dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday
        startTime: { type: String }, // "09:00"
        endTime: { type: String },   // "22:00"
        isAvailable: { type: Boolean, default: true }
    }],
    blockedDates: [{
        date: { type: String }, // "2024-12-25" format
        slots: [{
            startTime: { type: String }, // "09:00"
            endTime: { type: String },   // "12:00"
            type: { type: String, enum: ['busy', 'booked'], default: 'busy' }
        }]
    }],
    daySlots: [{
        date: { type: Date, required: true },
        isAvailable: { type: Boolean, default: true },
        isBooked: { type: Boolean, default: false },
        bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null }
    }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'suspended'],
        default: 'pending'
    },
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
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
    // Optional link to maps for this venue (Google Maps or similar)
    locationLink: {
        type: String,
        default: ''
    },
    autoApproveBookings: {
        type: Boolean,
        default: false
    },
    /**
     * Which of the owner's saved bankAccounts this venue's earnings go to.
     *
     * An id into `User.bankAccounts`, not a copy of the details: if the owner
     * corrects a typo in an account, every listing pointing at it follows. Null
     * falls back to `User.bankDetails` (the mirrored default), which is what the
     * payout path already reads - so old venues keep working untouched.
     */
    payoutAccount: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    cancellationPolicy: {
        freeCancellationHours: { type: Number, min: 1, max: 720, default: 48 },
        partialRefundPercentage: { type: Number, min: 0, max: 100, default: 50 },
        noCancellationHours: { type: Number, min: 0, max: 720, default: 24 }
    }
}, {
    timestamps: true
});

// Derives address.citySlug from address.city on every write path.
require('../utils/citySlugHook').attachCitySlug(venueSchema, 'address');

// GeoJSON index for location-based queries
venueSchema.index({ location: '2dsphere' });
venueSchema.index({ owner: 1 });
venueSchema.index({ status: 1 });
venueSchema.index({ 'address.city': 1 });
// The city filter and the /venues/in/<city> pages both match on the slug, always
// alongside status. A compound index serves the real query rather than the field.
venueSchema.index({ 'address.citySlug': 1, status: 1 });

module.exports = mongoose.model('Venue', venueSchema);
