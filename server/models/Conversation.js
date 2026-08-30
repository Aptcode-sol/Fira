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
    // Optional: If this conversation is bound to an inquiry (event/venue enquiry).
    // Mirrors `brand` above — lets a conversation be found-or-created per inquiry.
    inquiry: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inquiry',
        default: null
    },
    // Denormalized enquiry header, written once when the thread is created.
    //
    // The owner needs to know who is asking, how else to reach them, and which
    // listing it is about. Resolving that per request would mean loading the
    // Inquiry plus the Event/Venue for every row of the inbox - an N+1 on the
    // hottest read. These fields never change after creation (an enquiry cannot
    // move to another listing), so copying them is safe rather than a staleness
    // risk. Only the two participants can read a conversation, so the contact
    // details are no more exposed than the enquiry itself.
    inquiryContext: {
        referenceType: { type: String, enum: ['event', 'venue'], default: null },
        referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
        referenceName: { type: String, default: null },
        // First image of the event/venue, so the thread can show what is being
        // discussed instead of the other person's face. Copied like the rest of
        // this block to keep listing the inbox a single query.
        referenceImage: { type: String, default: null },
        senderName: { type: String, default: null },
        senderEmail: { type: String, default: null },
        senderPhone: { type: String, default: null }
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
// Serves the paginated inbox: filter by participant, ordered/cursored on
// updatedAt. Without the compound form Mongo matches on participants then sorts
// the whole matched set in memory.
conversationSchema.index({ participants: 1, updatedAt: -1 });
// Serves the find-or-create that keys an enquiry thread to a listing rather than
// to a single enquiry, so follow-up questions reuse the same conversation.
conversationSchema.index({ participants: 1, 'inquiryContext.referenceId': 1 });
conversationSchema.index({ brand: 1 });
conversationSchema.index({ inquiry: 1 });
conversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
