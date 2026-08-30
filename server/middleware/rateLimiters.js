const rateLimit = require('express-rate-limit');
// Normalises an IP into a bucket key. Required for the IPv6 fallback below: a
// raw req.ip lets one person cycle addresses inside their own /64 and get a fresh
// limit each time, which express-rate-limit rejects outright at startup.
const { ipKeyGenerator } = require('express-rate-limit');

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

/**
 * Chat messages. Each send fans out a web push to the other participant, so an
 * unbounded loop here is a way to hammer someone's lock screen. Keyed per
 * account rather than per IP: the limit should follow the sender, not punish
 * everyone behind one office NAT, and every message route is authenticated.
 * 60/minute is far above human typing speed and well below abuse.
 */
const messageLimiter = rateLimit({
    ...base,
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req, res) => (req.user?._id ? `user:${req.user._id}` : ipKeyGenerator(req, res)),
    message: { error: 'You are sending messages too quickly. Please slow down.' },
});

/**
 * City autocomplete. Public (signup needs it before an account exists) and every
 * cache miss is a paid geocoder call, so an unlimited endpoint is a way for a
 * stranger to burn our provider quota and take the address forms down with it.
 *
 * A person filling one address types maybe 30 keystrokes across two fields, and
 * the client only fires after a debounce. 120/minute leaves room for a shared
 * office NAT while making a scraper useless.
 */
const locationLimiter = rateLimit({
    ...base,
    windowMs: 60 * 1000,
    max: 120,
    message: { error: 'Too many city lookups. Please wait a moment and try again.' },
});

module.exports = { registerLimiter, otpLimiter, loginLimiter, messageLimiter, locationLimiter };
