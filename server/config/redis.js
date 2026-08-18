'use strict';

const Redis = require('ioredis');

// ─── Key Pattern Documentation ─────────────────────────────────────
// otp:{phone}              → OTP code (TTL 600s)
// blocked:{jti}            → Token blocklist entry (TTL = remaining token exp)
// cache:events:{hash}      → Cached event listing response (TTL 300s)
// cache:venues:{hash}      → Cached venue listing response (TTL 300s)
// ────────────────────────────────────────────────────────────────────

const KEY_PATTERNS = {
    otp: (phone) => `otp:${phone}`,
    blocked: (jti) => `blocked:${jti}`,
    cacheEvents: (hash) => `cache:events:${hash}`,
    cacheVenues: (hash) => `cache:venues:${hash}`,
};

const DEFAULT_TTLS = {
    otp: 600,
    blocked: null, // dynamic — remaining token exp
    cacheEvents: 300,
    cacheVenues: 300,
};

let redis = null;
let redisAvailable = false;

// Rate-limited warning: log Redis-down message at most once per 60s
let lastWarningTime = 0;
const WARNING_INTERVAL_MS = 60_000;

function logRedisWarning(msg) {
    const now = Date.now();
    if (now - lastWarningTime >= WARNING_INTERVAL_MS) {
        console.warn(`⚠️  Redis: ${msg}`);
        lastWarningTime = now;
    }
}

/**
 * Initialize the ioredis client. Call once at server startup.
 * Returns the client instance (or null if connection fails).
 */
function initRedis() {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
    const password = process.env.REDIS_PASSWORD || undefined;

    redis = new Redis({
        host,
        port,
        password,
        // Reconnection: exponential backoff capped at 2s
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        lazyConnect: false,
    });

    redis.on('connect', () => {
        redisAvailable = true;
        console.log('✅ Redis connected (ioredis)');
    });

    redis.on('ready', () => {
        redisAvailable = true;
    });

    redis.on('error', (err) => {
        redisAvailable = false;
        logRedisWarning(`Error — ${err.message}. Falling back to direct DB queries.`);
    });

    redis.on('close', () => {
        redisAvailable = false;
        logRedisWarning('Connection closed. Falling back to direct DB queries.');
    });

    redis.on('reconnecting', () => {
        // silent — ioredis handles reconnection automatically
    });

    return redis;
}

/**
 * Whether Redis is connected and operational.
 */
function isRedisAvailable() {
    return redisAvailable && redis !== null && redis.status === 'ready';
}

/**
 * Returns the raw ioredis client (or null).
 */
function getRedisClient() {
    return redis;
}

/**
 * Gracefully close the Redis connection.
 */
async function closeRedis() {
    if (redis) {
        try {
            await redis.quit();
        } catch (e) {
            // Force disconnect if quit times out
            redis.disconnect();
        }
        redis = null;
        redisAvailable = false;
    }
}

module.exports = {
    initRedis,
    isRedisAvailable,
    getRedisClient,
    closeRedis,
    logRedisWarning,
    KEY_PATTERNS,
    DEFAULT_TTLS,
};
