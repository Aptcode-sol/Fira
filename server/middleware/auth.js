const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user still exists in the database
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(401).json({ error: 'User no longer exists. Please register again.' });
        }

        if (!user.emailVerified) {
            // Optional: Enforce email verification if needed, but for now focusing on existence
            // return res.status(403).json({ error: 'Email not verified' });
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

module.exports = auth;
