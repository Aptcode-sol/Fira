const mongoose = require('mongoose');

// Append-only per-listing settlement ledger. A correction is a second row
// (isReversalOf), never a mutation — there is no update or delete helper here.
const settlementSchema = new mongoose.Schema({
    // --- what was settled ---
    listingKind: {
        type: String,
        enum: ['event', 'venue'],
        required: true
    },
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'listingModel'
    },
    listingModel: {
        type: String,
        enum: ['Event', 'Venue'],
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // resolved owner at record time; null when unresolvable (Req 10.5)
    },

    // --- the recorded fact about the transfer ---
    settledAmount: {
        type: Number,
        required: true // whole rupees; negative on a reversal row
    },
    settlementReference: {
        type: String,
        required: true // UTR / bank reference
    },
    settledAt: {
        type: Date,
        required: true
    },
    method: {
        type: String,
        enum: ['manual', 'gateway'],
        default: 'manual'
    },

    // --- admin-internal (never leaves the admin surface) ---
    adminNotes: {
        type: String,
        default: null
    },
    isOverSettlement: {
        type: Boolean,
        default: false
    },
    overrideReason: {
        type: String,
        default: null
    },

    // --- correction linkage ---
    isReversalOf: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Settlement',
        default: null
    },
    reversalReason: {
        type: String,
        default: null
    },

    // --- provenance ---
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    idempotencyKey: {
        type: String,
        required: true // derived on a reversal row: `reversal:<targetId>`
    }
}, {
    timestamps: true
});

// Indexes
// Req 6.2 — one transfer per (listing, key), enforced by the store, not by the caller.
settlementSchema.index({ listingKind: 1, listing: 1, idempotencyKey: 1 }, { unique: true });
// Req 1.3 — the ledger is always read newest-first for one listing.
settlementSchema.index({ listingKind: 1, listing: 1, settledAt: -1 });
// Req 7.5 — "is this entry already reversed?" is a single indexed lookup.
settlementSchema.index({ isReversalOf: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);
