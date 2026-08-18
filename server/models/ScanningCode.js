const mongoose = require('mongoose');

const scanningCodeSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    code: {
        type: String,
        required: true,
        unique: true
    },
    label: {
        type: String,
        maxlength: 50,
        default: ''
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes
scanningCodeSchema.index({ event: 1 });
scanningCodeSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('ScanningCode', scanningCodeSchema);
