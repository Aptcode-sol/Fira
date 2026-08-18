/**
 * Token Blocklist Service
 *
 * Stores blocked tokens in Redis with TTL = remaining expiration time.
 * Auth middleware (auth.js) already checks `blocked:{token}` on every request.
 * This service provides the write side: adding tokens on logout.
 *
 * ponytail: uses full token string as key (not jti) because existing tokens
 * don't carry a jti claim. Requirement 5.1 allows "jti or the full token string".
 */

const jwt = require('jsonwebtoken');
const { isRedisAvailable, getRedisClient } = require('./cacheService');

/**
 * Add a token to the blocklist with TTL = remaining seconds until expiry.
 * @param {string} token - The raw JWT string
 * @returns {{ blocked: boolean, error?: string }}
 */
async function blockToken(token) {
    if (!isRedisAvailable()) {
        return { blocked: false, error: 'Redis unavailable' };
    }

    // Decode (don't verify — token is already verified by auth middleware before reaching logout)
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
        return { blocked: false, error: 'Token has no exp claim' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - nowSec;

    // Already expired — no need to block
    if (ttl <= 0) {
        return { blocked: true }; // effectively blocked by expiration
    }

    const redis = getRedisClient();
    await redis.set(`blocked:${token}`, '1', 'EX', ttl);
    return { blocked: true };
}

/**
 * Check if a token is blocklisted.
 * ponytail: auth.js already does this inline, but exposing here for testability.
 * @param {string} token
 * @returns {boolean}
 */
async function isBlocked(token) {
    if (!isRedisAvailable()) {
        // Caller should fail closed (auth.js already does)
        throw new Error('Redis unavailable');
    }

    const redis = getRedisClient();
    const result = await redis.get(`blocked:${token}`);
    return result !== null;
}

module.exports = { blockToken, isBlocked };
