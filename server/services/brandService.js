const BrandProfile = require('../models/BrandProfile');
const { escapeRegex } = require('../utils/escapeRegex');

/**
 * Map a BrandProfile.type onto a User.verificationBadge.
 *
 * The two enums are different sizes on purpose: a profile can be any of ten
 * types (dj, photographer, caterer...) while the badge only distinguishes
 * three. Everything that is not a band or an organiser is badged 'brand'.
 */
const BADGE_BY_TYPE = { band: 'band', organizer: 'organizer' };

function badgeForBrandType(type) {
    return BADGE_BY_TYPE[String(type || '').toLowerCase()] || 'brand';
}

const brandService = {
    // Get brands with advanced filtering and sorting
    async getBrands(query = {}) {
        const {
            page = 1,
            limit = 12,
            type,
            search,
            city,
            lat,
            lng,
            sort = 'newest'
        } = query;

        const filter = { isActive: true, status: 'approved' };

        if (type && type !== 'All') {
            filter.type = type.toLowerCase();
        }

        const andConditions = [];

        if (search) {
            // Use regex for more reliable search (works without text index)
            const searchRegex = new RegExp(escapeRegex(search), 'i');
            andConditions.push({
                $or: [
                    { name: searchRegex },
                    { bio: searchRegex }
                ]
            });
        }

        if (city && city !== 'All') {
            const cityRegex = new RegExp(`^${escapeRegex(city)}$`, 'i');
            andConditions.push({
                $or: [
                    { primaryCity: cityRegex },
                    { cities: cityRegex }
                ]
            });
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        // Handle Geolocation with aggregation pipeline
        if (sort === 'nearby' && lat && lng) {
            const pipeline = [
                {
                    $geoNear: {
                        near: {
                            type: 'Point',
                            coordinates: [parseFloat(lng), parseFloat(lat)]
                        },
                        distanceField: 'distance',
                        maxDistance: 50000, // 50km in meters
                        query: filter,
                        spherical: true
                    }
                },
                { $skip: skip },
                { $limit: limitNum },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user',
                        foreignField: '_id',
                        as: 'user',
                        pipeline: [{ $project: { name: 1, email: 1, verificationBadge: 1 } }]
                    }
                },
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
            ];

            const brands = await BrandProfile.aggregate(pipeline);
            const total = await BrandProfile.countDocuments(filter);

            return {
                brands,
                totalPages: Math.ceil(total / limitNum),
                currentPage: parseInt(page),
                total
            };
        }

        // Non-geospatial queries
        let sortOption = {};
        if (sort === 'top' || sort === 'trending') {
            sortOption = { 'stats.followers': -1 };
        } else if (sort === 'newest') {
            sortOption = { createdAt: -1 };
        }

        const brands = await BrandProfile.find(filter)
            .populate('user', 'name email verificationBadge')
            .sort(sortOption)
            .limit(limitNum)
            .skip(skip)
            .lean();

        const total = await BrandProfile.countDocuments(filter);

        return {
            brands,
            totalPages: Math.ceil(total / limitNum),
            currentPage: parseInt(page),
            total
        };
    },

    // Get brand by ID
    async getBrandById(id) {
        // Atomically increment views and return the updated document
        const brand = await BrandProfile.findByIdAndUpdate(
            id,
            { $inc: { 'stats.views': 1 } },
            { new: true }
        ).populate('user', 'name email verificationBadge');

        if (!brand) throw new Error('Brand not found');

        // Live events count, overriding the denormalised stats.events.
        //
        // stats.events was only ever a stored number that nothing kept in step -
        // approving an event never incremented it - so a brand with live events
        // still read "0 Events". Counting the owner's visible events at read time
        // is always correct and cheap (one indexed count on a single profile view).
        // Followers stays denormalised: follow/unfollow already maintain it.
        const brandObj = brand.toObject();
        brandObj.stats = { ...brandObj.stats, events: await brandService.countBrandEvents(brand.user?._id || brand.user) };
        return brandObj;
    },

    /**
     * How many publicly visible events this brand's owner has.
     *
     * "Visible" = the same statuses the public events list shows, minus deleted -
     * so the number matches what a visitor can actually click through to, not a
     * count that includes drafts and rejected events.
     */
    async countBrandEvents(userId) {
        if (!userId) return 0;
        const Event = require('../models/Event');
        return Event.countDocuments({
            organizer: userId,
            isDeleted: { $ne: true },
            status: { $in: ['approved', 'upcoming', 'ongoing', 'completed'] },
        });
    },

    // Get brand by User ID
    async getBrandByUserId(userId) {
        const brand = await BrandProfile.findOne({ user: userId });
        // Return null if not found (don't throw), UI might handle "create profile" flow
        return brand;
    },

    // Fields the account holder does not own on their own brand profile.
    //
    // `status` is the admin's decision, and the badge grant below follows it - so a
    // profile save carrying `status: 'approved'` approved itself and collected the
    // verified badge on the same request, with the admin queue bypassed entirely.
    // `stats` are the follower/view counters, only ever $inc'd by the platform.
    // `user` is the ownership link. Same list shape as PROTECTED_VENUE_FIELDS.
    PROTECTED_BRAND_FIELDS: ['status', 'stats', 'user', 'isVerified', 'verificationBadge', '_id', 'createdAt', 'updatedAt'],

    // Pure: a copy of an update payload with the protected fields removed. Kept
    // separate so it is unit-testable without a DB round-trip.
    stripProtectedFields(data = {}) {
        const safe = { ...data };
        for (const field of brandService.PROTECTED_BRAND_FIELDS) delete safe[field];
        return safe;
    },

    // Create or Update Brand Profile
    async updateProfile(userId, data) {
        // The request body reached `$set` whole, with only `userId` removed at the
        // route. Guarded here rather than there so every caller is covered once -
        // this is the only write path onto a self-owned profile.
        const safe = brandService.stripProtectedFields(data);

        // Editing a rejected profile IS the resubmission - that is what the client's
        // "Reapply" control does. Without this the strip above leaves it rejected
        // forever, so reapplying changed nothing and the profile could never come
        // back to the admin queue.
        //
        // Only from 'rejected'. 'approved' must not drop back to pending or an
        // approved creator would lose their badge by editing their own bio, and
        // 'blocked' must not be escapable by editing - that is the whole point of it
        // being separate from rejected.
        const existing = await BrandProfile.findOne({ user: userId }).select('status').lean();
        if (existing?.status === 'rejected') safe.status = 'pending';

        const profile = await BrandProfile.findOneAndUpdate(
            { user: userId },
            { $set: safe },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // The badge is granted by ADMIN APPROVAL, never by creating the profile.
        //
        // This used to set `verificationBadge` here unconditionally, which meant the
        // moment anyone submitted a creator application they were shown as a "Verified
        // Creator" - the badge is what the whole client reads to decide that. Self-
        // service verification, with the admin queue reduced to decoration.
        //
        // The badge now follows `status`, and only adminService.updateBrandStatus
        // moves that. A profile awaiting review keeps whatever badge the account
        // already had, so an approved creator who edits their profile does not lose
        // their badge mid-edit.
        if (profile.status === 'approved') {
            const User = require('../models/User');
            await User.findByIdAndUpdate(userId, {
                $set: { verificationBadge: badgeForBrandType(profile.type) }
            });
        }

        return profile;
    },

    // Follow a brand
    async followBrand(userId, brandId) {
        const User = require('../models/User');

        const [brand, user] = await Promise.all([
            BrandProfile.findById(brandId).select('_id name user').lean(),
            User.findById(userId).select('followingBrands name').lean()
        ]);
        if (!brand) throw new Error('Brand not found');
        if (!user) throw new Error('User not found');

        // Check if already following (guard against missing field for older users)
        if ((user.followingBrands || []).some(id => id.toString() === brandId.toString())) {
            throw new Error('Already following this brand');
        }

        // Add brand to user's followingBrands + increment follower count in parallel
        await Promise.all([
            User.findByIdAndUpdate(userId, { $addToSet: { followingBrands: brandId } }),
            BrandProfile.findByIdAndUpdate(brandId, { $inc: { 'stats.followers': 1 } })
        ]);

        // Tell the creator they gained a follower. Best-effort: a notification
        // failure must not make the follow itself look like it failed.
        if (brand.user && brand.user.toString() !== userId.toString()) {
            const notificationService = require('./notificationService');
            notificationService.createNotification({
                userId: brand.user,
                type: 'new_follower',
                title: 'New follower',
                message: `${user.name || 'Someone'} started following ${brand.name}.`,
                data: {
                    referenceId: brandId,
                    referenceModel: 'BrandProfile',
                    actionUrl: `/creators/${brandId}`,
                    extra: { followerId: userId, followerName: user.name }
                },
                priority: 'low',
                channel: 'all'
            }).catch(err => console.error('new_follower notification failed:', err.message));
        }

        return { success: true, message: 'Now following this brand' };
    },

    // Unfollow a brand
    async unfollowBrand(userId, brandId) {
        const User = require('../models/User');

        const user = await User.findById(userId).select('followingBrands').lean();
        if (!user) throw new Error('User not found');

        // Check if actually following (guard against missing field for older users)
        if (!(user.followingBrands || []).some(id => id.toString() === brandId.toString())) {
            throw new Error('Not following this brand');
        }

        // Remove from followingBrands + decrement follower count in parallel
        await Promise.all([
            User.findByIdAndUpdate(userId, { $pull: { followingBrands: brandId } }),
            BrandProfile.findByIdAndUpdate(brandId, { $inc: { 'stats.followers': -1 } })
        ]);

        return { success: true, message: 'Unfollowed this brand' };
    },

    // Check if user follows a brand
    async isFollowingBrand(userId, brandId) {
        const User = require('../models/User');

        const user = await User.findById(userId).select('followingBrands').lean();
        if (!user) return { isFollowing: false };

        return { isFollowing: (user.followingBrands || []).some(id => id.toString() === brandId.toString()) };
    }
};

module.exports = brandService;

