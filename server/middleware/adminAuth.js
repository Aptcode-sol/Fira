const { requireAuth } = require('./auth');

/**
 * Require a signed-in user with role === 'admin'.
 * Delegates to the unified requireAuth middleware.
 */
const adminAuth = requireAuth('admin');

module.exports = adminAuth;
