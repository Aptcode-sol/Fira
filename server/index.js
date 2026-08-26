const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const connectDB = require('./config/db');
const corsMiddleware = require('./middleware/cors');
const { loggingMiddleware, logger } = require('./lib/logger');
const sentry = require('./lib/sentry');

const app = express();

// Sentry request handler — must be first middleware for request context + tracing.
sentry.init(app);

// Nginx sits in front of this in production, so without trusting the proxy
// every request would appear to come from 127.0.0.1 - the rate limiters would
// then see all traffic as one client and lock out every user at once.
// `1` = trust exactly one hop (our own Nginx), not an arbitrary X-Forwarded-For
// chain a client could forge.
app.set('trust proxy', 1);

// Security headers — applied first so every response (including errors) gets them.
const securityHeaders = require('./middleware/securityHeaders');
app.use(securityHeaders);

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Input sanitization — reject any key starting with '$' (NoSQL injection prevention)
const sanitize = require('./middleware/sanitize');
app.use(sanitize);

// CSRF protection — issues token cookie on reads, validates on state-changing requests
const { csrfProtection, csrfRouter } = require('./middleware/csrf');
app.use(csrfProtection);

// API version header — every response declares the version it's serving
app.use((req, res, next) => {
    res.setHeader('X-API-Version', '1');
    next();
});

// Structured request logging via pino-http (replaces console.log)
app.use(loggingMiddleware);

// Connect to Database
connectDB();

// Initialize Redis (ioredis) — used for OTP, token blocklist, and response caching.
// Non-blocking: if Redis is unavailable, server continues with MongoDB fallback.
const { initRedis } = require('./config/redis');
initRedis();

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const brandRoutes = require('./routes/brand');
const venueRoutes = require('./routes/venue');
const eventRoutes = require('./routes/event');
const bookingRoutes = require('./routes/booking');
const ticketRoutes = require('./routes/ticket');
const paymentRoutes = require('./routes/payment');
const notificationRoutes = require('./routes/notification');
const verificationRoutes = require('./routes/verification');
const uploadRoutes = require('./routes/upload');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const whatsappRoutes = require('./routes/whatsapp');
const scanRoutes = require('./routes/scan');
const discountRoutes = require('./routes/discount');
const inquiryRoutes = require('./routes/inquiry');
const messageRoutes = require('./routes/message');

// ponytail: mount on both /api/v1 (canonical) and /api (backward compat alias).
// When v2 lands, /api/v1 stays frozen and /api can be re-pointed.
const routeTable = [
    ['auth', authRoutes],
    ['users', userRoutes],
    ['brands', brandRoutes],
    ['venues', venueRoutes],
    ['events', eventRoutes],
    ['bookings', bookingRoutes],
    ['tickets', ticketRoutes],
    ['payments', paymentRoutes],
    ['notifications', notificationRoutes],
    ['verification', verificationRoutes],
    ['upload', uploadRoutes],
    ['dashboard', dashboardRoutes],
    ['admin', adminRoutes],
    ['whatsapp', whatsappRoutes],
    ['scan', scanRoutes],
    ['discounts', discountRoutes],
    ['inquiries', inquiryRoutes],
    ['messages', messageRoutes],
];

for (const [path, router] of routeTable) {
    app.use(`/api/v1/${path}`, router);  // canonical versioned path
    app.use(`/api/${path}`, router);     // backward compat alias
}

// CSRF token endpoint for SPA consumption (GET /api/v1/csrf-token)
app.use('/api/v1', csrfRouter);
app.use('/api', csrfRouter);

// Health Check — simple root (keep as-is for basic uptime probes)
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'FIRA API is running' });
});

// Health Check — deep dependency check (REQ 41.1–41.4)
// ponytail: inline rather than a route file — it's 30 lines with no shared state.
const healthCheck = async (req, res) => {
    const TIMEOUT_MS = 5000;

    const checks = await Promise.race([
        (async () => {
            // MongoDB: readyState 1 = connected
            const mongoState = mongoose.connection.readyState;
            const mongoOk = mongoState === 1;

            // Redis: PING with individual timeout
            let redisOk = false;
            try {
                const { getRedisClient, isRedisAvailable } = require('./config/redis');
                if (isRedisAvailable()) {
                    const client = getRedisClient();
                    const pong = await client.ping();
                    redisOk = pong === 'PONG';
                }
            } catch (_) {
                redisOk = false;
            }

            return { mongoOk, redisOk };
        })(),
        new Promise((resolve) =>
            setTimeout(() => resolve({ mongoOk: false, redisOk: false, timeout: true }), TIMEOUT_MS)
        ),
    ]);

    const healthy = checks.mongoOk && checks.redisOk && !checks.timeout;
    const status = healthy ? 200 : 503;

    res.status(status).json({
        status: healthy ? 'healthy' : 'degraded',
        mongo: checks.mongoOk ? 'connected' : 'disconnected',
        redis: checks.redisOk ? 'connected' : 'disconnected',
        ...(checks.timeout && { error: 'Health check timed out' }),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
};

app.get('/api/v1/health', healthCheck);
app.get('/api/health', healthCheck);

// Sentry error handler — captures unhandled exceptions with request context.
// Must be registered BEFORE the custom error handler below.
app.use(sentry.errorHandler());

// Error Handler
//
// The previous version threw away every detail and replied with a bare
// "Something went wrong!", which made 500s impossible to diagnose from either
// the UI or the logs. Now:
//   - the log line always identifies the request that failed
//   - a short reference id is returned so a user's screenshot can be matched
//     to a specific log entry
//   - the real message is returned outside production, where leaking internals
//     is not a concern
//   - non-Error throws (strings, undefined) are handled gracefully
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // ponytail: normalize non-Error throws (string, undefined, number, etc.)
    // so the rest of the handler always has a proper Error object.
    if (!(err instanceof Error)) {
        const original = err;
        err = new Error(
            typeof original === 'string' ? original : 'Non-error value thrown'
        );
        err.status = 500;
    }

    const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
    const status = err.status || err.statusCode || 500;

    logger.error({ err, ref, status, method: req.method, url: req.originalUrl },
        `${req.method} ${req.originalUrl} -> ${status}`);

    // Payload too large — body-parser or multer exceeded the configured limit.
    if (err.type === 'entity.too.large' || err.status === 413 ||
        (err.code === 'LIMIT_FILE_SIZE')) {
        return res.status(413).json({
            error: 'Request body exceeds the size limit',
            ref
        });
    }

    // Mongoose validation errors are the caller's fault, not a server fault -
    // report them as 400 with the specific field problem.
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: Object.values(err.errors || {}).map(e => e.message).join('. ') || err.message,
            ref
        });
    }

    res.status(status).json({
        error: process.env.NODE_ENV === 'production'
            ? `Something went wrong. Reference: ${ref}`
            : err.message,
        ref
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, `FIRA Server running on port ${PORT}`);

    // Initialize scheduled jobs (event reminders, etc.)
    const { initScheduledJobs } = require('./jobs/scheduledJobs');
    initScheduledJobs();

    // Signal PM2 that this instance is ready to accept traffic (zero-downtime reload).
    // In cluster mode with wait_ready: true, PM2 won't route requests here until
    // it receives this signal. Outside PM2 (dev), process.send is undefined — no-op.
    if (typeof process.send === 'function') {
        process.send('ready');
    }
});

// Graceful shutdown: drain in-flight requests, close Redis + MongoDB, then exit.
const { setupGracefulShutdown } = require('./lib/shutdown');
setupGracefulShutdown(server);

// Global unhandled rejection handler — log and continue, don't crash.
// ponytail: Node 15+ would terminate on unhandled rejection by default;
// this keeps the server alive while logging the ref for diagnosis.
process.on('unhandledRejection', (reason, promise) => {
    const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
    logger.error(
        { ref, err: reason instanceof Error ? reason : { message: String(reason) } },
        `Unhandled promise rejection [${ref}]`
    );
    // Forward to Sentry if active
    if (process.env.SENTRY_DSN && reason) {
        sentry.Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
    }
});
