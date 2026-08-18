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
    }
}, {
    timestamps: true
});

// Indexes
inquirySchema.index({ referenceId: 1, senderEmail: 1, createdAt: -1 });
inquirySchema.index({ referenceType: 1, status: 1 });

module.exports = mongoose.model('Inquiry', inquirySchema);
