const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify venue owner role
 * Must be used after the auth middleware
 */
const venueOwnerAuth = async (req, res, next) => {
    try {
        // First verify token and get user
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(401).json({ error: 'User no longer exists. Please register again.' });
        }

        // Check if user is a venue owner
        if (user.role !== 'venue_owner') {
            return res.status(403).json({ 
                error: 'Access denied. Only venue owners can perform this action.',
                code: 'NOT_VENUE_OWNER'
            });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }
        res.status(401).json({ error: 'Invalid authentication token.' });
    }
};

/**
 * Middleware to check if user is authenticated (any role)
 * Same as auth.js but exported alongside venueOwnerAuth
 */
const requireAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(401).json({ error: 'User no longer exists. Please register again.' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }
        res.status(401).json({ error: 'Invalid authentication token.' });
    }
};

module.exports = { venueOwnerAuth, requireAuth };
