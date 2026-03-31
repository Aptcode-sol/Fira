const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const connectDB = require('./config/db');

const app = express();

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
const messageRoutes = require('./routes/message');

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
app.use('/api/messages', messageRoutes);

// Health Check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'FIRA API is running' });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 FIRA Server running on port ${PORT}`);

    // Initialize scheduled jobs (event reminders, etc.)
    const { initScheduledJobs } = require('./jobs/scheduledJobs');
    initScheduledJobs();
});
