// @ts-check
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isRedisAvailable, getRedisClient } = require('../services/cacheService');

/**
 * @typedef {import('./types').UserRole} UserRole
 * @typedef {import('./types').AuthenticatedRequest} AuthenticatedRequest
 */

/**
 * Unified auth middleware with role-based access control.
 *
 * Usage:
 *   requireAuth()              → any authenticated user
 *   requireAuth('admin')       → admin only
 *   requireAuth('user','admin') → user OR admin
 *
 * Validates JWT signature + expiration. Checks token against Redis blocklist.
 * Attaches full user doc to req.user.
 * Returns 401 for missing/invalid/expired/blocklisted tokens, 403 for wrong role.
 * Returns 503 if Redis is unavailable (fail closed per requirement 3.5/5.5).
 *
 * @param {...string} roles - Allowed roles (empty = any authenticated user)
 * @returns {import('express').RequestHandler}
 */
function requireAuth(...roles) {
    return async (req, res, next) => {
        try {
            const token = req.header('Authorization')?.replace('Bearer ', '');

            if (!token) {
                return res.status(401).json({ error: 'Authentication required. No token provided.' });
            }

            // Redis blocklist check — fail closed with 503 if Redis is down.
            // ponytail: if Redis hasn't been initialized at all (no REDIS_HOST configured),
            // skip the check so the server still works without Redis in dev.
            if (process.env.REDIS_HOST) {
                if (!isRedisAvailable()) {
                    return res.status(503).json({ error: 'Authentication service temporarily unavailable. Please try again shortly.' });
                }
                const redis = getRedisClient();
                try {
                    const blocked = await redis.get(`blocked:${token}`);
                    if (blocked) {
                        return res.status(401).json({ error: 'Session has been invalidated. Please login again.' });
                    }
                } catch (redisErr) {
                    // Redis threw during the lookup — fail closed.
                    return res.status(503).json({ error: 'Authentication service temporarily unavailable. Please try again shortly.' });
                }
            }

            /** @type {any} */
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (err) {
                if (/** @type {any} */ (err).name === 'TokenExpiredError') {
                    return res.status(401).json({ error: 'Session expired. Please login again.' });
                }
                return res.status(401).json({ error: 'Invalid authentication token.' });
            }

            const user = await User.findById(decoded.userId).select('-password');

            if (!user) {
                return res.status(401).json({ error: 'User no longer exists. Please register again.' });
            }

            // Role check — if roles were specified, user.role must be one of them
            if (roles.length > 0 && !roles.includes(user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions for this action.' });
            }

            /** @type {any} */ (req).user = user;
            /** @type {any} */ (req).token = token;
            next();
        } catch (error) {
            res.status(401).json({ error: 'Invalid authentication token.' });
        }
    };
}

// Backward compat: the default export is requireAuth() with no role restriction,
// so all existing `const auth = require('../middleware/auth')` usages keep working.
const auth = /** @type {any} */ (requireAuth());

// Attach the factory so callers can do:
//   const { requireAuth } = require('../middleware/auth');
/** @type {any} */ (auth).requireAuth = requireAuth;

module.exports = auth;
module.exports.requireAuth = requireAuth;
