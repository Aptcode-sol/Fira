const { requireAuth } = require('./auth');

/**
 * Venue owner role middleware — delegates to unified requireAuth.
 */
const venueOwnerAuth = requireAuth('venue_owner');

module.exports = { venueOwnerAuth, requireAuth };
