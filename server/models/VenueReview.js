const mongoose = require('mongoose');

const venueReviewSchema = new mongoose.Schema({
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
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        maxlength: 1000,
        default: ''
    }
}, { timestamps: true });

// One review per user per venue
venueReviewSchema.index({ user: 1, venue: 1 }, { unique: true });
// Efficient venue reviews listing sorted by newest
venueReviewSchema.index({ venue: 1, createdAt: -1 });

module.exports = mongoose.model('VenueReview', venueReviewSchema);
