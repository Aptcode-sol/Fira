const DiscountCode = require('../models/DiscountCode');
const Payment = require('../models/Payment');

const discountService = {
    /**
     * Create a new discount code for an event.
     */
    async createDiscountCode({ eventId, code, discountType, discountValue, maxUses, validFrom, validUntil, createdBy }) {
        if (!eventId || !code || !discountType || discountValue == null || !validFrom || !validUntil || !createdBy) {
            throw new Error('Missing required fields');
        }

        if (!['percentage', 'flat'].includes(discountType)) {
            throw new Error('discountType must be percentage or flat');
        }

        if (discountType === 'percentage' && (discountValue < 1 || discountValue > 99)) {
            throw new Error('Percentage discount must be between 1 and 99');
        }

        if (discountType === 'flat' && (discountValue < 1 || discountValue > 99999)) {
            throw new Error('Flat discount must be between 1 and 99999');
        }

        const trimmedCode = code.trim();
        if (trimmedCode.length < 3 || trimmedCode.length > 20) {
            throw new Error('Code must be between 3 and 20 characters');
        }

        if (new Date(validUntil) <= new Date(validFrom)) {
            throw new Error('validUntil must be after validFrom');
        }

        if (maxUses != null && (maxUses < 1 || maxUses > 100000)) {
            throw new Error('maxUses must be between 1 and 100000');
        }

        const discount = await DiscountCode.create({
            event: eventId,
            code: trimmedCode.toUpperCase(),
            discountType,
            discountValue,
            maxUses: maxUses || null,
            validFrom,
            validUntil,
            createdBy,
            isActive: true
        });

        return discount;
    },

    /**
     * Edit a discount code. Only the owner can edit.
     */
    async editDiscountCode(codeId, updates, userId) {
        const discount = await DiscountCode.findById(codeId);
        if (!discount) {
            throw new Error('Discount code not found');
        }

        if (discount.createdBy.toString() !== userId.toString()) {
            throw new Error('Not authorized to edit this discount code');
        }

        const allowedFields = ['discountType', 'discountValue', 'maxUses', 'validFrom', 'validUntil'];
        const filtered = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                filtered[key] = updates[key];
            }
        }

        // Validate updated fields
        if (filtered.discountType && !['percentage', 'flat'].includes(filtered.discountType)) {
            throw new Error('discountType must be percentage or flat');
        }

        const type = filtered.discountType || discount.discountType;
        const value = filtered.discountValue != null ? filtered.discountValue : discount.discountValue;

        if (type === 'percentage' && (value < 1 || value > 99)) {
            throw new Error('Percentage discount must be between 1 and 99');
        }
        if (type === 'flat' && (value < 1 || value > 99999)) {
            throw new Error('Flat discount must be between 1 and 99999');
        }

        if (filtered.validFrom || filtered.validUntil) {
            const from = filtered.validFrom ? new Date(filtered.validFrom) : discount.validFrom;
            const until = filtered.validUntil ? new Date(filtered.validUntil) : discount.validUntil;
            if (until <= from) {
                throw new Error('validUntil must be after validFrom');
            }
        }

        if (filtered.maxUses != null && filtered.maxUses !== null && (filtered.maxUses < 1 || filtered.maxUses > 100000)) {
            throw new Error('maxUses must be between 1 and 100000');
        }

        Object.assign(discount, filtered);
        await discount.save();
        return discount;
    },

    /**
     * Deactivate a discount code. Only the owner can deactivate.
     */
    async deactivateDiscountCode(codeId, userId) {
        const discount = await DiscountCode.findById(codeId);
        if (!discount) {
            throw new Error('Discount code not found');
        }

        if (discount.createdBy.toString() !== userId.toString()) {
            throw new Error('Not authorized to deactivate this discount code');
        }

        discount.isActive = false;
        await discount.save();
        return discount;
    },

    /**
     * Validate and apply a discount code to a purchase.
     * Returns { discountAmount, discountType, discountValue }.
     * Only one discount per transaction (caller enforces this).
     */
    async validateAndApplyDiscount(code, eventId, subtotal) {
        // Populate createdBy so the caller can attribute the discount bearer
        // (Flow 4) without a second query: an admin-created code is absorbed by
        // the platform, an owner-created code by the owner's settlement.
        const discount = await DiscountCode.findOne({
            code: code.toUpperCase(),
            event: eventId
        }).populate('createdBy', 'adminRole');

        if (!discount) {
            throw new Error('Discount code not found');
        }

        if (!discount.isActive) {
            throw new Error('Discount code has been deactivated');
        }

        const now = new Date();
        if (now < discount.validFrom || now > discount.validUntil) {
            throw new Error('Discount code has expired');
        }

        if (discount.maxUses != null && discount.usedCount >= discount.maxUses) {
            throw new Error('Discount code usage limit reached');
        }

        // Compute discount amount
        let discountAmount;
        if (discount.discountType === 'percentage') {
            discountAmount = Math.round(subtotal * discount.discountValue / 100);
        } else {
            // flat — cap at subtotal
            discountAmount = Math.min(discount.discountValue, subtotal);
        }

        // Atomic increment usedCount with concurrency guard
        const filter = { _id: discount._id };
        if (discount.maxUses != null) {
            filter.usedCount = { $lt: discount.maxUses };
        }

        const updated = await DiscountCode.findOneAndUpdate(
            filter,
            { $inc: { usedCount: 1 } },
            { new: true }
        );

        if (!updated) {
            throw new Error('Discount code usage limit reached');
        }

        // Bearer attribution (Flow 4): admin-created code => platform absorbs
        // the discount (owner keeps full listed price); owner-created => owner
        // settlement is reduced. createdBy was populated above.
        const discountBearer = (discount.createdBy && discount.createdBy.adminRole) ? 'platform' : 'owner';

        return {
            discountAmount,
            discountType: discount.discountType,
            discountValue: discount.discountValue,
            discountBearer
        };
    },

    /**
     * Get analytics for a discount code: total uses, total revenue, purchase list.
     */
    async getDiscountAnalytics(codeId) {
        const discount = await DiscountCode.findById(codeId);
        if (!discount) {
            throw new Error('Discount code not found');
        }

        const purchases = await Payment.find({
            discountCode: discount.code,
            status: 'success'
        })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });

        const totalRevenue = purchases.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);

        return {
            totalUses: discount.usedCount,
            totalRevenue,
            purchases
        };
    }
};

module.exports = discountService;
