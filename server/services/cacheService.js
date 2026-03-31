/**
 * Redis Cache Service for Distributed OTP Storage
 * Works perfectly with PM2 cluster mode
 * Provides fallback to MongoDB if Redis unavailable
 */

let redis = null;

const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    enableReadyCheck: false,
    enableOfflineQueue: false
};

/**
 * Initialize Redis connection
 */
async function initRedis() {
    try {
        const Redis = require('redis');
        redis = Redis.createClient(REDIS_CONFIG);

        redis.on('error', (err) => {
            console.warn('⚠️  Redis Error:', err.message);
            console.warn('⚠️  Falling back to MongoDB for OTP storage');
            redis = null;
        });

        redis.on('connect', () => {
            console.log('✅ Redis connected for distributed cache');
        });

        await redis.connect();
        return true;
    } catch (error) {
        console.warn('⚠️  Redis not available. Using MongoDB for OTP storage.');
        console.warn('⚠️  For production cluster mode, install Redis:', error.message);
        redis = null;
        return false;
    }
}

/**
 * Store OTP in Redis with expiration
 * @param {string} email - User email
 * @param {string} code - OTP code
 * @param {number} ttl - Time to live in seconds (default: 10 minutes)
 */
async function storeOTP(email, code, ttl = 600) {
    if (!redis) {
        return null; // Use MongoDB fallback
    }

    try {
        const key = `otp:${email}`;
        const value = JSON.stringify({
            code,
            createdAt: Date.now(),
            attempts: 0
        });

        await redis.setEx(key, ttl, value);
        console.log(`✅ OTP stored in Redis for ${email}`);
        return { key, value };
    } catch (error) {
        console.error('❌ Redis store error:', error);
        return null;
    }
}

/**
 * Get OTP from Redis
 * @param {string} email - User email
 */
async function getOTP(email) {
    if (!redis) {
        return null; // Use MongoDB fallback
    }

    try {
        const key = `otp:${email}`;
        const value = await redis.get(key);

        if (!value) {
            return null;
        }

        return JSON.parse(value);
    } catch (error) {
        console.error('❌ Redis get error:', error);
        return null;
    }
}

/**
 * Verify OTP code and increment attempts
 * @param {string} email - User email
 * @param {string} code - OTP code to verify
 */
async function verifyOTP(email, code) {
    if (!redis) {
        return { verified: null }; // Use MongoDB fallback
    }

    try {
        const key = `otp:${email}`;
        const otpData = await redis.get(key);

        if (!otpData) {
            return {
                verified: false,
                error: 'No OTP found',
                reason: 'expired_or_not_exists'
            };
        }

        const otp = JSON.parse(otpData);

        // Check attempts
        if (otp.attempts >= 5) {
            await redis.del(key);
            return {
                verified: false,
                error: 'Too many attempts',
                reason: 'max_attempts'
            };
        }

        // Check code
        if (otp.code !== code) {
            otp.attempts += 1;
            const ttl = await redis.ttl(key);
            if (ttl > 0) {
                await redis.setEx(key, ttl, JSON.stringify(otp));
            }
            return {
                verified: false,
                error: 'Invalid code',
                attempts: otp.attempts,
                remainingAttempts: 5 - otp.attempts
            };
        }

        // Code matches - delete OTP
        await redis.del(key);
        return {
            verified: true,
            message: 'OTP verified successfully'
        };
    } catch (error) {
        console.error('❌ Redis verify error:', error);
        return { verified: null };
    }
}

/**
 * Delete OTP from Redis
 * @param {string} email - User email
 */
async function deleteOTP(email) {
    if (!redis) {
        return false;
    }

    try {
        const key = `otp:${email}`;
        await redis.del(key);
        console.log(`✅ OTP deleted from Redis for ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Redis delete error:', error);
        return false;
    }
}

/**
 * Check if Redis is available
 */
function isRedisAvailable() {
    return redis !== null;
}

/**
 * Get Redis client instance
 */
function getRedisClient() {
    return redis;
}

/**
 * Health check for Redis
 */
async function healthCheck() {
    if (!redis) {
        return {
            status: 'disconnected',
            message: 'Using MongoDB fallback'
        };
    }

    try {
        await redis.ping();
        return {
            status: 'connected',
            message: 'Redis is healthy'
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message
        };
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
    healthCheck,
    REDIS_CONFIG
};
