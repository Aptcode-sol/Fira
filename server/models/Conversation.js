const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    // Participants in the conversation
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    // Optional: If this is a brand enquiry conversation
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BrandProfile',
        default: null
    },
    // Last message preview
    lastMessage: {
        content: { type: String, default: '' },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now }
    },
    // Unread count per participant
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    },
    // Conversation status
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ brand: 1 });
conversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
