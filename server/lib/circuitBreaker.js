'use strict';

const CircuitBreaker = require('opossum');

// ponytail: opossum handles open/half-open/closed states, probe logic, and rolling windows out of the box.
// We only add logging and a 503-compatible error shape on top.

const DEFAULT_OPTIONS = {
    timeout: 10_000, // 10s — if the call itself takes longer, treat as failure
    errorThresholdPercentage: 100, // we want N consecutive failures, not percentage-based
    volumeThreshold: 1, // start tracking from the first call
    rollingCountTimeout: 60_000, // 60s rolling window
    resetTimeout: 30_000, // probe every 30s when open
};

/**
 * Error thrown when the circuit is open — designed to map to HTTP 503.
 */
class ServiceUnavailableError extends Error {
    constructor(serviceName) {
        super(`Service unavailable: ${serviceName} (circuit open)`);
        this.name = 'ServiceUnavailableError';
        this.statusCode = 503;
        this.service = serviceName;
    }
}

/**
 * Factory: wraps an async function with circuit breaker behavior.
 *
 * @param {string} name – human-readable service name (for logs & errors)
 * @param {Function} fn – the async function to protect
 * @param {object} [opts] – override options (merged over defaults)
 * @returns {CircuitBreaker}
 */
function createCircuitBreaker(name, fn, opts = {}) {
    const options = {
        ...DEFAULT_OPTIONS,
        ...opts,
        name,
    };

    const breaker = new CircuitBreaker(fn, options);

    // Log state transitions (Req 19.7)
    breaker.on('open', () => {
        console.log(
            `🔴 [CircuitBreaker] ${name} → OPEN at ${new Date().toISOString()}`
        );
    });

    breaker.on('close', () => {
        console.log(
            `🟢 [CircuitBreaker] ${name} → CLOSED at ${new Date().toISOString()}`
        );
    });

    breaker.on('halfOpen', () => {
        console.log(
            `🟡 [CircuitBreaker] ${name} → HALF-OPEN (probing) at ${new Date().toISOString()}`
        );
    });

    // When the circuit is open, opossum rejects with its own error.
    // We intercept via the fallback to throw a 503-shaped error instead.
    breaker.fallback(() => {
        throw new ServiceUnavailableError(name);
    });

    return breaker;
}

// ─── Pre-configured breakers for the three external services ──────────────────

// Razorpay: 5 failures in 60s window, probe every 30s
const razorpayBreaker = (fn) =>
    createCircuitBreaker('Razorpay', fn, {
        volumeThreshold: 5,
        rollingCountTimeout: 60_000,
        resetTimeout: 30_000,
    });

// Cloudinary: 5 failures in 60s window, probe every 30s
const cloudinaryBreaker = (fn) =>
    createCircuitBreaker('Cloudinary', fn, {
        volumeThreshold: 5,
        rollingCountTimeout: 60_000,
        resetTimeout: 30_000,
    });

// Email: 3 failures in 60s window, probe every 30s
const emailBreaker = (fn) =>
    createCircuitBreaker('Email', fn, {
        volumeThreshold: 3,
        rollingCountTimeout: 60_000,
        resetTimeout: 30_000,
    });

module.exports = {
    createCircuitBreaker,
    razorpayBreaker,
    cloudinaryBreaker,
    emailBreaker,
    ServiceUnavailableError,
};
