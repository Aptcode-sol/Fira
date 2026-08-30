const DiscountCode = require('../models/DiscountCode');
const Payment = require('../models/Payment');
const Event = require('../models/Event');
const { roundMoney } = require('../utils/money');

const discountService = {
    /**
     * The window a discount code is usable in, derived from its event.
     *
     * A code is checked at PURCHASE time, and tickets are bought before the event
     * runs - so the window is "from now until the event finishes", not the event's
     * own start-to-end span. The client used to collect validFrom/validUntil by hand
     * and constrain them to [eventStart, eventEnd], which meant a code created for
     * next month's event could not legally start before that event began: unusable
     * for the whole selling period, which is the only period that matters.
     *
     * Derived rather than entered, so the two can't disagree.
     */
    discountWindow(event) {
        const validUntil = event?.endDateTime || event?.startDateTime;
        if (!validUntil) throw new Error('Event has no end date, cannot derive discount validity');
        return { validFrom: new Date(), validUntil: new Date(validUntil) };
    },

    /**
     * Create a new discount code for an event.
     */
    async createDiscountCode({ eventId, code, discountType, discountValue, maxUses, createdBy }) {
        if (!eventId || !code || !discountType || discountValue == null || !createdBy) {
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

        if (maxUses != null && (maxUses < 1 || maxUses > 100000)) {
            throw new Error('maxUses must be between 1 and 100000');
        }

        // The window comes from the event, never from the request - so a client that
        // still sends validFrom/validUntil cannot widen a code past its event.
        const event = await Event.findById(eventId).select('startDateTime endDateTime').lean();
        if (!event) throw new Error('Event not found');
        const { validFrom, validUntil } = discountService.discountWindow(event);

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

        // validFrom/validUntil are deliberately not editable: the window is derived
        // from the event (see discountWindow). Leaving them here would let an edit
        // reintroduce exactly the out-of-range window that create no longer accepts.
        const allowedFields = ['discountType', 'discountValue', 'maxUses'];
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
            discountAmount = roundMoney(subtotal * discount.discountValue / 100);
        } else {
            // flat — cap at subtotal
            discountAmount = roundMoney(Math.min(discount.discountValue, subtotal));
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
