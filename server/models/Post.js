const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    // Polymorphic - can be brand post or event post
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BrandProfile',
        default: null
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        default: null
    },
    // Author of the post
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    images: [{
        type: String
    }],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isEdited: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
postSchema.index({ brand: 1, createdAt: -1 });
postSchema.index({ event: 1, createdAt: -1 });

// Custom validation - must have either brand or event
postSchema.path('brand').validate(function () {
    return this.brand || this.event;
}, 'Post must belong to either a brand or an event');

module.exports = mongoose.model('Post', postSchema);

