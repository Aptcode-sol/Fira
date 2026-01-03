const mongoose = require('mongoose');

const brandProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['brand', 'band', 'organizer'],
        required: true
    },
    bio: {
        type: String,
        maxLength: 1000,
        default: ''
    },
    coverPhoto: {
        type: String,
        default: null
    },
    profilePhoto: {
        type: String,
        default: null
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0] // [longitude, latitude]
        }
    },
    address: {
        type: String,
        default: null
    },
    socialLinks: {
        instagram: { type: String, default: null },
        twitter: { type: String, default: null },
        facebook: { type: String, default: null },
        website: { type: String, default: null },
        spotify: { type: String, default: null },
        youtube: { type: String, default: null }
    },
    stats: {
        followers: { type: Number, default: 0 },
        events: { type: Number, default: 0 },
        views: { type: Number, default: 0 }
    },
    members: [{
        name: { type: String, required: true },
        role: { type: String, required: true },
        photoUrl: { type: String }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'blocked'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Indexes
brandProfileSchema.index({ type: 1 });
brandProfileSchema.index({ location: '2dsphere' });
brandProfileSchema.index({ name: 'text', bio: 'text' });
brandProfileSchema.index({ 'stats.followers': -1 });

module.exports = mongoose.model('BrandProfile', brandProfileSchema);
