'use strict';

const crypto = require('crypto');
const { isRedisAvailable, getRedisClient, KEY_PATTERNS } = require('../config/redis');

/**
 * Compute a weak ETag from response body using MD5 (fast, sufficient for HTTP caching).
 */
function computeETag(body) {
    const hash = crypto.createHash('md5').update(body).digest('hex');
    return `W/"${hash}"`;
}

/**
 * Middleware for public listing endpoints.
 * - Computes ETag from response body
 * - Sets Cache-Control: public, max-age=60
 * - Handles If-None-Match → 304 Not Modified
 *
 * ponytail: intercepts res.json to capture the body before sending.
 */
function publicCache(req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
        // Only apply caching on successful 2xx (specifically 200) GET responses
        const status = res.statusCode || 200;
        if (req.method !== 'GET' || status !== 200) {
            return originalJson(body);
        }

        const bodyStr = JSON.stringify(body);
        const etag = computeETag(bodyStr);

        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('ETag', etag);

        // If-None-Match check: return 304 if client has current version
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch === etag) {
            res.removeHeader('Content-Type');
            res.removeHeader('Content-Length');
            return res.status(304).end();
        }

        return originalJson(body);
    };

    next();
}

/**
 * Middleware for authenticated/user-specific endpoints.
 * Sets Cache-Control: no-store to prevent caching of sensitive data.
 */
function noStoreCache(req, res, next) {
    res.setHeader('Cache-Control', 'no-store');
    next();
}

/**
 * Invalidate Redis cache entries for events and venues.
 * Call after any write operation (create/update/delete) on events or venues.
 *
 * @param {'events'|'venues'} resource - Which resource type was modified
 */
async function invalidateCache(resource) {
    if (!isRedisAvailable()) return;

    const client = getRedisClient();
    if (!client) return;

    try {
        const pattern = resource === 'events' ? 'cache:events:*' : 'cache:venues:*';
        // ponytail: SCAN-based deletion avoids blocking Redis with KEYS on large datasets.
        // For a typical app with <1000 cache keys, a single SCAN pass suffices.
        let cursor = '0';
        do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await client.del(...keys);
            }
        } while (cursor !== '0');
    } catch (err) {
        // Non-fatal: cache will expire via TTL anyway
        console.warn(`⚠️  Cache invalidation failed for ${resource}: ${err.message}`);
    }
}

module.exports = {
    publicCache,
    noStoreCache,
    invalidateCache,
    computeETag,
};
