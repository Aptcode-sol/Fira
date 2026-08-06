const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const connectDB = require('./config/db');

const app = express();

// Nginx sits in front of this in production, so without trusting the proxy
// every request would appear to come from 127.0.0.1 - the rate limiters would
// then see all traffic as one client and lock out every user at once.
// `1` = trust exactly one hop (our own Nginx), not an arbitrary X-Forwarded-For
// chain a client could forge.
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📥 [${timestamp}] ${req.method} ${req.url}`);
    if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
        console.log('   Body:', JSON.stringify(req.body).substring(0, 200));
    }
    next();
});

// Connect to Database
connectDB();

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
// CHAT DISABLED - messaging routes are not mounted for now
// const messageRoutes = require('./routes/message');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/brands', brandRoutes); // Add this
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/whatsapp', whatsappRoutes);
// CHAT DISABLED
// app.use('/api/messages', messageRoutes);

// Health Check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'FIRA API is running' });
});

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
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
    const status = err.status || err.statusCode || 500;

    console.error(
        `❌ [${ref}] ${req.method} ${req.originalUrl} -> ${status}: ${err.message}`
    );
    if (err.stack) console.error(err.stack);

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
app.listen(PORT, () => {
    console.log(`🚀 FIRA Server running on port ${PORT}`);

    // Initialize scheduled jobs (event reminders, etc.)
    const { initScheduledJobs } = require('./jobs/scheduledJobs');
    initScheduledJobs();
});
