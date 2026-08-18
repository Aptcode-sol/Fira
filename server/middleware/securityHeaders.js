// @ts-check
/** @typedef {import('express').RequestHandler} RequestHandler */
const helmet = require('helmet');

/**
 * Security headers middleware using helmet.
 * Applied to ALL responses (including errors and /health).
 *
 * Headers configured:
 *   Content-Security-Policy: default-src 'self'; script-src 'self' + CSP_TRUSTED_CDNS
 *   Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
 *   X-Frame-Options: DENY
 *   X-Content-Type-Options: nosniff
 *   Referrer-Policy: strict-origin-when-cross-origin
 *   X-DNS-Prefetch-Control: off
 *   X-Download-Options: noopen
 */

// ponytail: CSP script-src built once at startup — no per-request string concat.
/** @type {string[]} */
const trustedCdns = process.env.CSP_TRUSTED_CDNS
    ? process.env.CSP_TRUSTED_CDNS.split(',').map(s => s.trim()).filter(Boolean)
    : [];

/** @type {string[]} */
const scriptSrcDirective = ["'self'", ...trustedCdns];

/** @type {RequestHandler} */
const securityHeaders = /** @type {any} */ (helmet)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: scriptSrcDirective,
        },
    },
    strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    dnsPrefetchControl: { allow: false },
    ieNoOpen: true,           // X-Download-Options: noopen
    // Disable headers we don't need to configure explicitly
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    permittedCrossDomainPolicies: false,
    xPoweredBy: false,
});

module.exports = securityHeaders;
