const rateLimit = require('express-rate-limit');

/**
 * Rate limiters for the endpoints that cost real money or reputation.
 *
 * Why this exists: /api/auth/register had no limit at all. A bot registered 48
 * accounts using real-looking Gmail addresses it did not own, and every one of
 * them triggered a genuine OTP email from no-reply@letsfira.com. Zoho read that
 * as a compromised account spamming strangers and blocked ALL outbound mail
 * with "550 5.4.6 Unusual sending activity detected" - which took down email
 * verification for real users too.
 *
 * The limits below are deliberately generous for humans and ruinous for bots.
 */

/** Shared shape so every limiter returns a consistent JSON error. */
const base = {
    standardHeaders: true,   // RateLimit-* response headers
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
};

/**
 * Registration. The expensive one - each call can send an email.
 * A real person signs up once; five attempts per hour per IP is plenty for
 * typos and retries.
 */
const registerLimiter = rateLimit({
    ...base,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: { error: 'Too many sign-up attempts from this network. Please try again in an hour.' },
});

/**
 * OTP resend. Also sends mail. The service already enforces a 90-second
 * cooldown per address; this stops someone cycling many addresses from one IP.
 */
const otpLimiter = rateLimit({
    ...base,
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many verification requests. Please try again later.' },
});

/**
 * Login and password reset. Not email-heavy, but worth limiting to slow
 * credential stuffing.
 */
const loginLimiter = rateLimit({
    ...base,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
});

module.exports = { registerLimiter, otpLimiter, loginLimiter };
