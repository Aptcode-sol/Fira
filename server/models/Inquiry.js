const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    referenceType: {
        type: String,
        enum: ['event', 'venue'],
        required: true
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderName: {
        type: String,
        required: true,
        maxlength: 100
    },
    senderEmail: {
        type: String,
        required: true,
        maxlength: 254
    },
    senderPhone: {
        type: String,
        maxlength: 20,
        default: null
    },
    message: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 2000
    },
    status: {
        type: String,
        enum: ['pending', 'responded', 'closed'],
        default: 'pending'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    replyText: {
        type: String,
        minlength: 1,
        maxlength: 2000,
        default: null
    },
    responder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    repliedAt: {
        type: Date,
        default: null
    },
    senderSeenReply: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
inquirySchema.index({ referenceId: 1, senderEmail: 1, createdAt: -1 }); // rate-limit count
inquirySchema.index({ referenceType: 1, status: 1 }); // admin filter
inquirySchema.index({ user: 1, createdAt: -1 }); // My Enquiries (sender view)
inquirySchema.index({ referenceType: 1, referenceId: 1, createdAt: -1 }); // owner view

module.exports = mongoose.model('Inquiry', inquirySchema);
