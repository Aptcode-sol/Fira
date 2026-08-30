const VerificationRequest = require('../models/VerificationRequest');
const User = require('../models/User');
const BrandProfile = require('../models/BrandProfile');

const verificationService = {
    // Get all requests (admin)
    async getAllRequests(query = {}) {
        const { page = 1, limit = 10, status, type } = query;
        const filter = {};
        if (status) filter.status = status;
        if (type) filter.type = type;

        const requests = await VerificationRequest.find(filter)
            .populate('user', 'name email avatar')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await VerificationRequest.countDocuments(filter);

        return {
            requests,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        };
    },

    // Get user's request
    async getUserRequest(userId) {
        const request = await VerificationRequest.findOne({ user: userId })
            .sort({ createdAt: -1 });
        return request;
    },

    // Get request by ID
    async getRequestById(id) {
        const request = await VerificationRequest.findById(id)
            .populate('user', 'name email avatar')
            .populate('reviewedBy', 'name');
        if (!request) {
            throw new Error('Verification request not found');
        }
        return request;
    },

    // Submit request
    async submitRequest(data) {
        // Check if user already has a pending request
        const existing = await VerificationRequest.findOne({
            user: data.user,
            status: { $in: ['pending', 'under_review'] }
        });

        if (existing) {
            throw new Error('You already have a pending verification request');
        }

        const request = await VerificationRequest.create(data);
        return request;
    },

    // Update request
    async updateRequest(id, updateData) {
        const request = await VerificationRequest.findById(id);
        if (!request) {
            throw new Error('Verification request not found');
        }

        if (request.status !== 'pending') {
            throw new Error('Cannot update request that is already being reviewed');
        }

        Object.assign(request, updateData);
        await request.save();
        return request;
    },

    // Review request (admin)
    async reviewRequest(id, { status, rejectionReason, adminNotes, reviewedBy }) {
        const request = await VerificationRequest.findById(id).populate('user', 'email');
        if (!request) {
            throw new Error('Verification request not found');
        }

        request.status = status;
        request.reviewedBy = reviewedBy;
        request.reviewedAt = new Date();

        if (rejectionReason) {
            request.rejectionReason = rejectionReason;
        }
        if (adminNotes) {
            request.adminNotes = adminNotes;
        }

        await request.save();

        // If approved, update user's verification status and create/update BrandProfile
        if (status === 'approved') {
            try {
                // Query existing user by email (case-insensitive) — NEVER create a new User
                const applicantEmail = request.user.email.toLowerCase();
                const existingUser = await User.findOne({ email: applicantEmail });

                if (!existingUser) {
                    throw new Error('User account not found for this application');
                }

                // Update the existing user's verification fields
                existingUser.isVerified = true;
                existingUser.verificationBadge = request.type;
                await existingUser.save();

                // Create or update BrandProfile — don't create a duplicate.
                //
                // `status` is set explicitly: this branch runs only on approval, and
                // BrandProfile.status defaults to 'pending' on insert. Leaving it to the
                // default badged the account while its profile still read "pending
                // review", so the dashboard told an approved creator their application
                // was still in the queue.
                const brandProfileData = {
                    user: existingUser._id,
                    name: request.name,
                    type: request.type,
                    status: 'approved',
                    bio: request.description || '',
                    socialLinks: request.socialLinks || {}
                };

                await BrandProfile.findOneAndUpdate(
                    { user: existingUser._id },
                    { $set: brandProfileData },
                    { upsert: true, new: true }
                );
            } catch (error) {
                // Revert the request status to avoid partial state
                request.status = 'pending';
                request.reviewedBy = null;
                request.reviewedAt = null;
                await request.save();
                throw new Error(`Application processing failed: ${error.message}`);
            }
        }

        // TODO: Send notification to user

        return request;
    }
};

module.exports = verificationService;
