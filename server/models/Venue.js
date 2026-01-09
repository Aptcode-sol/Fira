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
