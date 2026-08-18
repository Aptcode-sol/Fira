'use strict';

/**
 * Redis Cache Service
 *
 * Provides OTP storage, token blocklist, and response caching via ioredis.
 * Configured through server/config/redis.js.
 * Fallback: when Redis is unavailable, callers get null/false responses
 * and handle MongoDB fallback themselves. Rate-limited warning is logged
 * at most once per 60s from the config module.
 */

const {
    initRedis: initRedisClient,
    isRedisAvailable,
    getRedisClient,
    closeRedis,
    logRedisWarning,
    KEY_PATTERNS,
    DEFAULT_TTLS,
} = require('../config/redis');

/**
 * Initialize Redis connection. Call once from server entry.
 */
function initRedis() {
    return initRedisClient();
}

/**
 * Store OTP in Redis with expiration.
 * @param {string} identifier - Phone or email
 * @param {string} code - OTP code
 * @param {number} ttl - Time to live in seconds (default: 600)
 */
async function storeOTP(identifier, code, ttl = DEFAULT_TTLS.otp) {
    if (!isRedisAvailable()) {
        logRedisWarning('Unavailable — OTP stored in MongoDB fallback');
        return null;
    }

    try {
        const key = KEY_PATTERNS.otp(identifier);
        const value = JSON.stringify({
            code,
            createdAt: Date.now(),
            attempts: 0,
        });

        const redis = getRedisClient();
        await redis.set(key, value, 'EX', ttl);
        return { key, value };
    } catch (error) {
        logRedisWarning(`Store OTP error: ${error.message}`);
        return null;
    }
}

/**
 * Get OTP from Redis.
 * @param {string} identifier - Phone or email
 */
async function getOTP(identifier) {
    if (!isRedisAvailable()) {
        return null;
    }

    try {
        const key = KEY_PATTERNS.otp(identifier);
        const redis = getRedisClient();
        const value = await redis.get(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        logRedisWarning(`Get OTP error: ${error.message}`);
        return null;
    }
}

/**
 * Verify OTP code and increment attempts.
 * @param {string} identifier - Phone or email
 * @param {string} code - OTP code to verify
 */
async function verifyOTP(identifier, code) {
    if (!isRedisAvailable()) {
        return { verified: null }; // Caller uses MongoDB fallback
    }

    try {
        const key = KEY_PATTERNS.otp(identifier);
        const redis = getRedisClient();
        const otpData = await redis.get(key);

        if (!otpData) {
            return { verified: false, error: 'No OTP found', reason: 'expired_or_not_exists' };
        }

        const otp = JSON.parse(otpData);

        if (otp.attempts >= 5) {
            await redis.del(key);
            return { verified: false, error: 'Too many attempts', reason: 'max_attempts' };
        }

        if (otp.code !== code) {
            otp.attempts += 1;
            const ttl = await redis.ttl(key);
            if (ttl > 0) {
                await redis.set(key, JSON.stringify(otp), 'EX', ttl);
            }
            return {
                verified: false,
                error: 'Invalid code',
                attempts: otp.attempts,
                remainingAttempts: 5 - otp.attempts,
            };
        }

        // Code matches — delete OTP
        await redis.del(key);
        return { verified: true, message: 'OTP verified successfully' };
    } catch (error) {
        logRedisWarning(`Verify OTP error: ${error.message}`);
        return { verified: null };
    }
}

/**
 * Delete OTP from Redis.
 * @param {string} identifier - Phone or email
 */
async function deleteOTP(identifier) {
    if (!isRedisAvailable()) return false;

    try {
        const key = KEY_PATTERNS.otp(identifier);
        const redis = getRedisClient();
        await redis.del(key);
        return true;
    } catch (error) {
        logRedisWarning(`Delete OTP error: ${error.message}`);
        return false;
    }
}

/**
 * Health check for Redis.
 */
async function healthCheck() {
    if (!isRedisAvailable()) {
        return { status: 'disconnected', message: 'Using MongoDB fallback' };
    }

    try {
        const redis = getRedisClient();
        await redis.ping();
        return { status: 'connected', message: 'Redis is healthy' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
}

module.exports = {
    initRedis,
    storeOTP,
    getOTP,
    verifyOTP,
    deleteOTP,
    isRedisAvailable,
    getRedisClient,
    closeRedis,
    healthCheck,
    KEY_PATTERNS,
    DEFAULT_TTLS,
};
