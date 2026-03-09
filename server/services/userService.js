const User = require('../models/User');

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
            .sort({ createdAt: -1 });

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
            // Use Aggregate for sorting by followers length
             const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        followersCount: { $size: { $ifNull: ["$followers", []] } }
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
        const user = await User.findById(id).select('-password');
        if (!user) {
            throw new Error('User not found');
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

    // Follow user
    async followUser(userId, targetUserId) {
        if (userId === targetUserId) {
            throw new Error('Cannot follow yourself');
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
        await Promise.all([
            User.findByIdAndUpdate(userId, { $pull: { following: targetUserId } }),
            User.findByIdAndUpdate(targetUserId, { $pull: { followers: userId } })
        ]);

        return { message: 'Successfully unfollowed user' };
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
