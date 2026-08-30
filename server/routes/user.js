const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const auth = require('../middleware/auth');
const { noStoreCache } = require('../middleware/httpCache');

// GET /api/users - Get all users (admin only)
router.get('/', auth, noStoreCache, async (req, res) => {
    try {
        const users = await userService.getAllUsers(req.query);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/brands - Get verified brands
router.get('/brands', async (req, res) => {
    try {
        // Pass query params: type, search, sort, lat, lng, page, limit
        const result = await userService.getBrands(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/users/me/bank-details - Update bank details
router.patch('/me/bank-details', auth, async (req, res) => {
    try {
        const { accountName, accountNumber, ifscCode, bankName } = req.body;
        const result = await userService.updateBankDetails(req.user._id, { accountName, accountNumber, ifscCode, bankName });
        if (result.error) {
            return res.status(400).json(result);
        }
        res.json(result.bankDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/* ------------------------------------------------------------------ *
 * Payout accounts. All declared before '/:id' so the literal segments are not
 * captured as an id param.
 * ------------------------------------------------------------------ */

// GET /api/users/me/bank-accounts - list saved payout accounts
router.get('/me/bank-accounts', auth, async (req, res) => {
    try {
        const accounts = await userService.listBankAccounts(req.user._id);
        res.json({ accounts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/users/me/bank-accounts - add one
router.post('/me/bank-accounts', auth, async (req, res) => {
    try {
        const { accountName, accountNumber, ifscCode, bankName, makeDefault } = req.body;
        const result = await userService.addBankAccount(req.user._id, {
            accountName, accountNumber, ifscCode, bankName, makeDefault,
        });
        // Field-level error so the client can mark the offending input rather than
        // showing a detached toast.
        if (result.error) return res.status(400).json(result);
        res.status(201).json({ accounts: result.accounts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/users/me/bank-accounts/:accountId/default - promote to default
router.patch('/me/bank-accounts/:accountId/default', auth, async (req, res) => {
    try {
        const result = await userService.setDefaultBankAccount(req.user._id, req.params.accountId);
        if (result.error) return res.status(404).json(result);
        res.json({ accounts: result.accounts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/users/me/bank-accounts/:accountId
router.delete('/me/bank-accounts/:accountId', auth, async (req, res) => {
    try {
        const result = await userService.deleteBankAccount(req.user._id, req.params.accountId);
        if (result.error) return res.status(404).json(result);
        res.json({ accounts: result.accounts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/users/me - Delete the authenticated user's own account + associated data
// Declared before '/:id' so "me" is not captured as an id param.
router.delete('/me', auth, async (req, res) => {
    try {
        const result = await userService.deleteAccount(req.user._id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// PUT /api/users/:id - Update user
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const user = await userService.updateUser(req.params.id, req.body);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        await userService.deleteUser(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/users/:id/follow - Follow a user
router.post('/:id/follow', auth, async (req, res) => {
    try {
        const result = await userService.followUser(req.user._id, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/users/:id/unfollow - Unfollow a user
router.post('/:id/unfollow', auth, async (req, res) => {
    try {
        const result = await userService.unfollowUser(req.user._id, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/users/:id/following-brands - Get brands the user is following
router.get('/:id/following-brands', auth, noStoreCache, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const brands = await userService.getFollowingBrands(req.params.id);
        res.json(brands);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
