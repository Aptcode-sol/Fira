const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    // Reference to conversation
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    // Sender of the message
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Message content
    content: {
        type: String,
        required: true,
        maxLength: 2000
    },
    // Message type
    messageType: {
        type: String,
        enum: ['text', 'image', 'system'],
        default: 'text'
    },
    // For image messages
    imageUrl: {
        type: String,
        default: null
    },
    // Read status
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ isRead: 1 });

module.exports = mongoose.model('Message', messageSchema);
