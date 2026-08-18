// @ts-check
const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const auth = require('../middleware/auth');
const { registerLimiter, otpLimiter, loginLimiter } = require('../middleware/rateLimiters');

/**
 * @typedef {import('../middleware/types').AuthenticatedRequest} AuthenticatedRequest
 * @typedef {import('express').Response} Response
 */

// POST /api/auth/register - Register new user
router.post('/register', registerLimiter, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // `city` is collected on the signup form and is what powers city-based
        // discovery, so it has to be forwarded to the service.
        const { email, password, name, city } = req.body;
        const result = await authService.register({ email, password, name, city });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/register-venue-owner - Register new venue owner
router.post('/register-venue-owner', registerLimiter, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { 
            email, 
            password, 
            name, 
            businessName, 
            businessPhone,
            govIdType,
            govIdNumber,
            govIdDocument,
            bankAccountName,
            bankAccountNumber,
            bankIfscCode,
            bankName
        } = req.body;
        const result = await authService.register({ 
            email, 
            password, 
            name, 
            role: 'venue_owner',
            businessName,
            businessPhone,
            govIdType,
            govIdNumber,
            govIdDocument,
            bankDetails: {
                accountName: bankAccountName,
                accountNumber: bankAccountNumber,
                ifscCode: bankIfscCode,
                bankName: bankName
            }
        });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/verify-otp - Verify OTP and activate account
router.post('/verify-otp', otpLimiter, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and verification code are required' });
        }

        const result = await authService.verifyOTP({ email, code });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/resend-otp - Resend OTP
router.post('/resend-otp', otpLimiter, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const result = await authService.resendOTP({ email });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/login - Login user
router.post('/login', loginLimiter, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login({ email, password });
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// POST /api/auth/logout - Logout user (adds token to blocklist)
router.post('/logout', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { blockToken } = require('../services/tokenBlocklist');
        const { blocked, error } = await blockToken(req.token);

        if (!blocked) {
            return res.status(503).json({ error: error || 'Unable to invalidate session' });
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

// GET /api/auth/me - Get current user
router.get('/me', /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        // TODO: Add auth middleware to get user from token
        res.json({ message: 'Auth middleware required' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', otpLimiter, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const result = await authService.forgotPassword({ email });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/verify-reset-otp - Verify reset code
router.post('/verify-reset-otp', otpLimiter, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }

        const result = await authService.verifyResetOTP({ email, code });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', loginLimiter, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({ error: 'Reset token and new password are required' });
        }

        const result = await authService.resetPassword({ resetToken, newPassword });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/auth/change-password - Change password while signed in.
// Requires auth: the user id comes from the token, never from the body, so a
// caller cannot change somebody else's password by passing their id.
router.post('/change-password', auth, /** @param {AuthenticatedRequest} req @param {Response} res */ async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const result = await authService.changePassword({
            userId: req.user._id,
            currentPassword,
            newPassword
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
