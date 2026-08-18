// @ts-check
'use strict';

/**
 * Custom CORS middleware with origin allowlist.
 *
 * Reads CORS_ALLOWED_ORIGINS from env (comma-separated URLs).
 * Refuses server startup if missing/empty.
 * Returns 403 (no CORS headers) for disallowed origins.
 * Responds to preflight OPTIONS with correct headers for allowed origins.
 *
 * ponytail: replaces the previous `app.use(cors())` wide-open config.
 */

/** @type {string[]} */
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

if (allowedOrigins.length === 0) {
    throw new Error(
        'CORS_ALLOWED_ORIGINS environment variable is missing or empty. ' +
        'Set it to a comma-separated list of allowed origins (e.g. "https://app.fira.com,https://admin.fira.com").'
    );
}

/** @type {Set<string>} */
const allowedOriginsSet = new Set(allowedOrigins);

// ponytail: in development, auto-allow any localhost/127.0.0.1 origin so devs
// don't need to enumerate every port in their .env.
/** @type {boolean} */
const isDev = process.env.NODE_ENV === 'development';

/**
 * @param {string} origin
 * @returns {boolean}
 */
function isLocalhostOrigin(origin) {
    try {
        const url = new URL(origin);
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

/** @type {string} */
const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
/** @type {string} */
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token';

/**
 * CORS middleware.
 * - Allowed origin: sets Access-Control-Allow-Origin, Methods, Headers.
 * - Disallowed origin: responds 403 with no CORS headers.
 * - OPTIONS preflight from allowed origin: responds 204 immediately.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    // No Origin header (same-origin requests, curl, etc.) — let through without CORS headers.
    if (!origin) {
        return next();
    }

    if (!allowedOriginsSet.has(origin) && !(isDev && isLocalhostOrigin(origin))) {
        res.status(403).json({ error: 'Origin not allowed' });
        return;
    }

    // Origin is allowed — set CORS headers.
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Preflight: respond immediately with 204 (no content).
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight for 24h
        res.status(204).end();
        return;
    }

    next();
}

module.exports = corsMiddleware;
