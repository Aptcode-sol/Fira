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
    /**
     * Which ticket tier this scanner admits, by tier name.
     *
     * Empty = admits every tier for the event, which is what all existing codes
     * were, so no migration is needed - absent reads as ''.
     *
     * Matched against Ticket.ticketType, which stores the tier name chosen at
     * purchase. Held as a name rather than a subdocument id because a tier is an
     * inline array entry on Event with no stable id of its own, and the name is
     * what the buyer's ticket already records.
     */
    ticketTier: {
        type: String,
        maxlength: 50,
        default: ''
    },
    /**
     * An intentional "admits every tier" scanner, distinct from a legacy unscoped
     * link.
     *
     * Both carry ticketTier '', so on their own they are indistinguishable - and
     * listScanningCodes deactivates unscoped links to close the hole where an old
     * link bypassed tier scoping. This flag marks the ONE combined link the
     * organiser is meant to have, so it survives that sweep while stray unscoped
     * links (allTiers !== true) are still retired. Nothing outside that sweep reads
     * it: the door still admits on `ticketTier === '' → any tier`.
     */
    allTiers: {
        type: Boolean,
        default: false
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

// Indexes. `code` is already unique-indexed by its field definition above, so
// re-declaring it here only produced a duplicate-index warning on every boot.
scanningCodeSchema.index({ event: 1 });

module.exports = mongoose.model('ScanningCode', scanningCodeSchema);
