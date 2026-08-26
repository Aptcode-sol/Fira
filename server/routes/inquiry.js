// @ts-check
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Inquiry = require('../models/Inquiry');
const inquiryService = require('../services/inquiryService');
const auth = require('../middleware/auth');

/**
 * @typedef {import('../middleware/types').AuthenticatedRequest} AuthenticatedRequest
 * @typedef {import('express').Response} Response
 */

/**
 * Optional auth middleware — attaches req.user if a valid token is present,
 * but does NOT reject the request when the token is missing or invalid.
 */
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(/** @type {any} */ (decoded).userId).select('-password');
            if (user) {
                /** @type {any} */ (req).user = user;
            }
        }
    } catch (_) {
        // Token invalid/expired — proceed without user context
    }
    next();
};

// POST /api/inquiries — submit an inquiry (public, optional auth to capture userId)
router.post('/', optionalAuth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { referenceType, referenceId, message } = req.body;

        const inquiry = await inquiryService.submitInquiry({
            referenceType,
            referenceId,
            message,
            user: req.user
        });

        res.status(201).json(inquiry);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ error: error.message });
    }
});

// GET /api/inquiries/:id — get inquiry by ID (requires auth)
router.get('/:id', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) {
            return res.status(404).json({ error: 'Inquiry not found' });
        }
        res.json(inquiry);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
