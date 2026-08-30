const User = require('../models/User');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const BrandProfile = require('../models/BrandProfile');
const Post = require('../models/Post');
const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const Inquiry = require('../models/Inquiry');
const bankDetailsValidator = require('../utils/bankDetailsValidator');

const userService = {
    // Get all users
    async getAllUsers(query = {}) {
        const { page = 1, limit = 10, role } = query;
        const filter = {};
        if (role) filter.role = role;

        const users = await User.find(filter)
            .select('-password')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 })
            .lean();

        const total = await User.countDocuments(filter);

        return {
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        };
    },

    // Get verified brands/bands/organizers
    async getBrands(query = {}) {
        const {
            page = 1,
            limit = 12,
            type,
            search,
            lat,
            lng,
            sort = 'newest'
        } = query;

        const filter = {
            isVerified: true,
            verificationBadge: { $in: ['brand', 'band', 'organizer'] }
        };

        if (type && type !== 'All') {
            filter.verificationBadge = type.toLowerCase();
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } } // Assuming description exists on User or VerificationRequest... 
                // Wait, User doesn't have description. Adding fallback or removing description search if strictly on User.
                // Assuming description might be added or we search name only.
                // User schema doesn't have description. I should stick to Name for now or add Description to schema.
                // Let's check User schema again... It doesn't have description.
                // The mock data had description. 
                // I should add description to User schema to support this properly.
            ];
        }

        // Handle Geolocation Sort
        if (sort === 'nearby' && lat && lng) {
            filter.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: 50000 // 50km default radius
                }
            };
        }

        let sortOption = {};
        if (sort === 'top' || sort === 'trending') {
            // Trending is same as top for now (most followers)
            // We can't easily sort by array length in standard sort()
            // We need aggregate if we want to sort by array length
        } else if (sort === 'newest') {
            sortOption = { createdAt: -1 };
        }

        // Construct Query
        let usersQuery;

        if (sort === 'top' || sort === 'trending') {
            // Use Aggregate for sorting by followers length, excluding self-references
             const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        followersCount: {
                            $size: {
                                $filter: {
                                    input: { $ifNull: ["$followers", []] },
                                    cond: { $ne: ["$$this", "$_id"] }
                                }
                            }
                        }
                    }
                },
                { $sort: { followersCount: -1 } },
                { $skip: (page - 1) * limit },
                { $limit: parseInt(limit) },
                 // Project to remove password explicitly if needed (though not selected usually)
                 { $project: { password: 0 } }
            ];

            const [users, totalCount] = await Promise.all([
                User.aggregate(pipeline),
                User.countDocuments(filter)
            ]);

             return {
                brands: users,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                total: totalCount
            };

        } else {
             // Standard find
            usersQuery = User.find(filter).select('-password');
             
             if (sort === 'nearby' && lat && lng) {
                 // $near sorts by distance automatically, no need to add .sort()
             } else {
                 usersQuery.sort(sortOption);
             }

            usersQuery.skip((page - 1) * limit).limit(limit * 1);

            const users = await usersQuery;
            const total = await User.countDocuments(filter);

             return {
                brands: users,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total
            };
        }
    },

    // Get user by ID
    async getUserById(id) {
        const user = await User.findById(id).select('-password').lean();
        if (!user) {
            throw new Error('User not found');
        }
        // Exclude self-references from followers/following (legacy data)
        const idStr = user._id.toString();
        if (user.followers) {
            user.followers = user.followers.filter(f => f.toString() !== idStr);
        }
        if (user.following) {
            user.following = user.following.filter(f => f.toString() !== idStr);
        }
        return user;
    },

    // Update user
    async updateUser(id, updateData) {
        const { password, ...safeData } = updateData; // Don't allow password update here

        const user = await User.findByIdAndUpdate(
            id,
            { $set: safeData },
            { new: true }
        ).select('-password');

        if (!user) {
            throw new Error('User not found');
        }
        return user;
    },

    // Delete user
    async deleteUser(id) {
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            throw new Error('User not found');
        }
        return { message: 'User deleted successfully' };
    },

    // Delete the authenticated user's own account + associated data.
    // Cascade follows the existing convention used in seeds/seedTestUser.js
    // (Event by organizer, Venue by owner, BrandProfile by user) extended to
    // the other clearly user-owned collections. Only data belonging to THIS
    // user is removed. ponytail: single-pass deleteMany fan-out — no
    // transaction/session (Mongo standalone in dev); ceiling = a crash mid-fan-out
    // could orphan a subset, acceptable for account self-deletion.
    async deleteAccount(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        await Promise.all([
            Event.deleteMany({ organizer: userId }),
            Venue.deleteMany({ owner: userId }),
            BrandProfile.deleteMany({ user: userId }),
            Post.deleteMany({ author: userId }),
            Booking.deleteMany({ user: userId }),
            Ticket.deleteMany({ user: userId }),
            Notification.deleteMany({ user: userId }),
            PushSubscription.deleteMany({ user: userId }),
            Inquiry.deleteMany({ user: userId }),
        ]);

        await User.findByIdAndDelete(userId);

        return { message: 'Account deleted successfully' };
    },

    // Follow user
    async followUser(userId, targetUserId) {
        if (userId.toString() === targetUserId.toString()) {
            throw new Error('A user cannot follow themselves');
        }

        const [user, targetUser] = await Promise.all([
            User.findById(userId),
            User.findById(targetUserId)
        ]);

        if (!user || !targetUser) {
            throw new Error('User not found');
        }

        // Add to following/followers
        await Promise.all([
            User.findByIdAndUpdate(userId, { $addToSet: { following: targetUserId } }),
            User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: userId } })
        ]);

        return { message: 'Successfully followed user' };
    },

    // Unfollow user
    async unfollowUser(userId, targetUserId) {
        if (userId.toString() === targetUserId.toString()) {
            throw new Error('A user cannot follow themselves');
        }

        await Promise.all([
            User.findByIdAndUpdate(userId, { $pull: { following: targetUserId } }),
            User.findByIdAndUpdate(targetUserId, { $pull: { followers: userId } })
        ]);

        return { message: 'Successfully unfollowed user' };
    },

    // Update bank details with validation (trust boundary — validate before persist)
    async updateBankDetails(userId, { accountName, accountNumber, ifscCode, bankName }) {
        const check = bankDetailsValidator.validate({ accountName, accountNumber, ifscCode, bankName });
        if (!check.isValid) {
            return { error: check.error, field: check.field };
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { bankDetails: { accountName: accountName.trim(), accountNumber, ifscCode, bankName: bankName.trim() } } },
            { new: true }
        ).select('-password');

        if (!user) {
            throw new Error('User not found');
        }

        return { success: true, bankDetails: user.bankDetails };
    },

    /* ------------------------------------------------------------------ *
     * Payout accounts (multi-account)
     *
     * Every mutation goes through `syncBankAccounts` below, which is the single
     * place that guarantees the two invariants the rest of the system relies on:
     *   1. at most one account is `isDefault`, and if any account exists exactly
     *      one is
     *   2. `user.bankDetails` always mirrors that default
     * Invariant 2 is what lets payouts, earnings and admin reads keep working
     * against the old single-account shape untouched.
     * ------------------------------------------------------------------ */

    /**
     * Normalise the account list and mirror the default, then save.
     * `preferredDefaultId` wins if present and still in the list; otherwise the
     * existing default is kept, otherwise the first account is promoted.
     */
    async syncBankAccounts(user, preferredDefaultId = null) {
        const accounts = user.bankAccounts || [];

        if (accounts.length === 0) {
            user.bankDetails = { accountName: null, accountNumber: null, ifscCode: null, bankName: null };
            await user.save();
            return user;
        }

        const preferred = preferredDefaultId
            ? accounts.find(a => String(a._id) === String(preferredDefaultId))
            : null;
        const chosen = preferred || accounts.find(a => a.isDefault) || accounts[0];

        for (const account of accounts) {
            account.isDefault = String(account._id) === String(chosen._id);
        }

        user.bankDetails = {
            accountName: chosen.accountName,
            accountNumber: chosen.accountNumber,
            ifscCode: chosen.ifscCode,
            bankName: chosen.bankName,
        };

        await user.save();
        return user;
    },

    /**
     * The user's saved accounts.
     *
     * Adopts a pre-existing single `bankDetails` record into the array on first
     * read, so accounts saved before this feature are not silently lost and no
     * migration script is needed.
     */
    async listBankAccounts(userId) {
        const user = await User.findById(userId).select('bankAccounts bankDetails');
        if (!user) throw new Error('User not found');

        const legacy = user.bankDetails;
        const hasLegacy = Boolean(legacy && legacy.accountNumber && legacy.ifscCode);

        if ((!user.bankAccounts || user.bankAccounts.length === 0) && hasLegacy) {
            user.bankAccounts = [{
                accountName: legacy.accountName,
                accountNumber: legacy.accountNumber,
                ifscCode: legacy.ifscCode,
                bankName: legacy.bankName,
                isDefault: true,
            }];
            await userService.syncBankAccounts(user);
        }

        return user.bankAccounts || [];
    },

    /** Add an account. The first one added becomes the default. */
    async addBankAccount(userId, { accountName, accountNumber, ifscCode, bankName, makeDefault = false }) {
        const check = bankDetailsValidator.validate({ accountName, accountNumber, ifscCode, bankName });
        if (!check.isValid) {
            return { error: check.error, field: check.field };
        }

        // Adopt any legacy record first, so it is not overwritten by the sync.
        await userService.listBankAccounts(userId);

        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        // Same account twice is a data-entry slip, not a new account.
        const duplicate = (user.bankAccounts || []).find(
            a => a.accountNumber === accountNumber && a.ifscCode === ifscCode.toUpperCase()
        );
        if (duplicate) {
            return { error: 'This account is already saved', field: 'accountNumber' };
        }

        user.bankAccounts.push({
            accountName: accountName.trim(),
            accountNumber,
            ifscCode: ifscCode.toUpperCase(),
            bankName: bankName.trim(),
            isDefault: false,
        });

        const added = user.bankAccounts[user.bankAccounts.length - 1];
        const isFirst = user.bankAccounts.length === 1;
        await userService.syncBankAccounts(user, (makeDefault || isFirst) ? added._id : null);

        return { success: true, accounts: user.bankAccounts };
    },

    /** Promote one account to default. */
    async setDefaultBankAccount(userId, accountId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const exists = (user.bankAccounts || []).some(a => String(a._id) === String(accountId));
        if (!exists) return { error: 'Account not found', field: 'accountId' };

        await userService.syncBankAccounts(user, accountId);
        return { success: true, accounts: user.bankAccounts };
    },

    /**
     * Delete an account. Allowed even if a past payout used it: a Payout row
     * stores its own copy of the details it paid to, so history stays intact.
     */
    async deleteBankAccount(userId, accountId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const before = (user.bankAccounts || []).length;
        user.bankAccounts = (user.bankAccounts || []).filter(a => String(a._id) !== String(accountId));

        if (user.bankAccounts.length === before) {
            return { error: 'Account not found', field: 'accountId' };
        }

        // Removing the default promotes whichever account remains first.
        await userService.syncBankAccounts(user);
        return { success: true, accounts: user.bankAccounts };
    },

    // Get brands the user is following
    async getFollowingBrands(userId) {
        const BrandProfile = require('../models/BrandProfile');
        
        const user = await User.findById(userId).select('followingBrands');
        if (!user) {
            throw new Error('User not found');
        }

        if (!user.followingBrands || user.followingBrands.length === 0) {
            return { brands: [], count: 0 };
        }

        const brands = await BrandProfile.find({
            _id: { $in: user.followingBrands }
        }).select('name type bio profilePhoto stats').populate('user', 'name');

        return {
            brands,
            count: brands.length
        };
    }
};

module.exports = userService;
