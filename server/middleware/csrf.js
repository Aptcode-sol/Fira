// @ts-check
/**
 * CSRF protection middleware.
 *
 * Issues a CSRF token via secure HttpOnly cookie on GET requests.
 * Validates token on state-changing requests (POST/PUT/DELETE/PATCH) for
 * browser clients (identified by Cookie header or matching Origin/Referer).
 * Pure API clients using only Bearer tokens skip CSRF validation.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

const crypto = require('crypto');

/** @type {string} */
const COOKIE_NAME = '_csrf';
/** @type {string} */
const HEADER_NAME = 'x-csrf-token';
/** @type {number} */
const TOKEN_BYTES = 32;

/** @type {Set<string>} */
const STATE_CHANGING = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * Determines if the request originates from a browser client.
 * A browser client is identified by:
 *  - Presence of a Cookie header, OR
 *  - Origin/Referer header matching the application domain
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isBrowserClient(req) {
  if (req.headers.cookie) return true;

  const appDomain = getAppDomain(req);
  const origin = /** @type {string | undefined} */ (req.headers.origin);
  const referer = /** @type {string | undefined} */ (req.headers.referer);

  if (origin && matchesDomain(origin, appDomain)) return true;
  if (referer && matchesDomain(referer, appDomain)) return true;

  return false;
}

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function getAppDomain(req) {
  // Use CSRF_APP_DOMAIN env var if set, otherwise derive from Host header
  if (process.env.CSRF_APP_DOMAIN) return process.env.CSRF_APP_DOMAIN;
  return /** @type {string} */ (req.headers.host) || '';
}

/**
 * @param {string} url
 * @param {string} domain
 * @returns {boolean}
 */
function matchesDomain(url, domain) {
  try {
    const parsed = new URL(url);
    return parsed.host === domain;
  } catch {
    // If URL is just a domain/path without protocol, try direct compare
    return url.includes(domain);
  }
}

/**
 * Generate a cryptographically random CSRF token.
 * @returns {string}
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * @returns {{ httpOnly: boolean; sameSite: 'strict'; secure: boolean; path: string }}
 */
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: /** @type {const} */ ('strict'),
    secure: isProduction,
    path: '/'
  };
}

/**
 * Main CSRF middleware.
 * @param {import('express').Request & { csrfToken?: string }} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function csrfProtection(req, res, next) {
  // On GET requests (or any non-state-changing), issue/refresh the CSRF token cookie.
  if (!STATE_CHANGING.has(req.method)) {
    const token = generateToken();
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    // Stash on req so the /csrf-token endpoint can read it
    req.csrfToken = token;
    return next();
  }

  // State-changing request: decide whether to validate CSRF
  if (!isBrowserClient(req)) {
    // Pure API client (no cookies, no matching Origin/Referer) — skip CSRF,
    // rely on Bearer token auth alone. (Requirement 10.4)
    return next();
  }

  // Browser client — validate CSRF token (Requirement 10.1, 10.3)
  const cookieToken = parseCsrfCookie(req);
  const headerToken = /** @type {string | undefined} */ (req.headers[HEADER_NAME]);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({
      error: 'CSRF validation failed. Please refresh the page and try again.'
    });
    return;
  }

  next();
}

/**
 * Parse the CSRF cookie value from the raw Cookie header.
 * Uses cookie-parser's result if available, otherwise parses manually.
 * @param {import('express').Request} req
 * @returns {string | null}
 */
function parseCsrfCookie(req) {
  // If cookie-parser ran, req.cookies is populated
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  // Manual parse fallback
  const raw = req.headers.cookie || '';
  const match = raw.split(';').find(c => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return match.split('=')[1].trim();
}

/**
 * Express router for the CSRF token endpoint.
 * GET /api/v1/csrf-token — returns the current token for SPA consumption.
 */
const express = require('express');
const csrfRouter = express.Router();

csrfRouter.get('/csrf-token', (/** @type {any} */ req, /** @type {import('express').Response} */ res) => {
  // The csrfProtection middleware already generated & set the cookie on GET
  res.json({ csrfToken: req.csrfToken });
});

module.exports = { csrfProtection, csrfRouter };
