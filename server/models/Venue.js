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
        basePrice: { type: Number, required: true },
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
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
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
    cancellationPolicy: {
        freeCancellationHours: { type: Number, min: 1, max: 720, default: 48 },
        partialRefundPercentage: { type: Number, min: 0, max: 100, default: 50 },
        noCancellationHours: { type: Number, min: 0, max: 720, default: 24 }
    }
}, {
    timestamps: true
});

// GeoJSON index for location-based queries
venueSchema.index({ location: '2dsphere' });
venueSchema.index({ owner: 1 });
venueSchema.index({ status: 1 });
venueSchema.index({ 'address.city': 1 });

module.exports = mongoose.model('Venue', venueSchema);
