const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const Refund = require('../models/Refund');
const User = require('../models/User');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Owner bank details must be real before a payout is recorded (fail closed).
// ponytail: inline check here; the shared API-boundary validator is task 8.
const isValidBankDetails = (b) =>
    !!b &&
    /^[0-9]{9,18}$/.test(b.accountNumber || '') &&
    /^[A-Z]{4}0[A-Z0-9]{6}$/.test(b.ifscCode || '');

const paymentService = {
    // Pure billing calculation with GST breakdown
    calculateBilling(ticketPrice, quantity, platformFeePercentage, discountAmount = 0) {
        const subtotal = ticketPrice * quantity;
        const discountedSubtotal = Math.max(0, subtotal - discountAmount);
        const platformFee = Math.round(discountedSubtotal * platformFeePercentage / 100);
        const gstAmount = Math.round(platformFee * 0.18);
        const totalAmount = discountedSubtotal + platformFee + gstAmount;

        return {
            subtotal,
            discountAmount,
            discountedSubtotal,
            platformFee,
            platformFeePercentage,
            gstAmount,
            totalAmount
        };
    },

    // Get all payments
    async getAllPayments(query = {}) {
        const { page = 1, limit = 10, status, type } = query;
        const filter = {};
        if (status) filter.status = status;
        if (type) filter.type = type;

        const payments = await Payment.find(filter)
            .populate('user', 'name email')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await Payment.countDocuments(filter);

        return {
            payments,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        };
    },

    // Get user's payments
    async getUserPayments(userId) {
        const payments = await Payment.find({ user: userId })
            .sort({ createdAt: -1 });
        return payments;
    },

    // Get payment by ID
    async getPaymentById(id) {
        const payment = await Payment.findById(id).populate('user', 'name email');
        if (!payment) {
            throw new Error('Payment not found');
        }
        return payment;
    },

    // Initiate payment
    async initiatePayment({ userId, type, referenceId, referenceModel, amount, subtotal, platformFee, platformFeePercentage, gstAmount, totalAmount, discountCode, discountAmount, discountBearer, listedPrice }) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay credentials not configured');
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Use totalAmount if provided (from billing calculation), otherwise fall back to amount
        const chargeAmount = totalAmount || amount;

        const options = {
            amount: Math.round(chargeAmount * 100), // amount in the smallest currency unit (paise)
            currency: "INR",
            receipt: `rcpt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            notes: {
                userId: userId.toString(),
                type,
                referenceId: referenceId.toString()
            }
        };

        const order = await razorpay.orders.create(options);

        const payment = await Payment.create({
            user: userId,
            type,
            referenceId,
            referenceModel,
            amount: chargeAmount,
            subtotal: subtotal || 0,
            platformFee: platformFee || 0,
            platformFeePercentage: platformFeePercentage || 5,
            gstAmount: gstAmount || 0,
            totalAmount: totalAmount || chargeAmount,
            discountCode: discountCode || null,
            discountAmount: discountAmount || 0,
            // Flow 4: who absorbs the discount ('platform'|'owner'|null) and the
            // full listed price the owner set. listedPrice defaults to subtotal
            // so platform-side records preserve intent even when no discount.
            discountBearer: discountBearer || null,
            listedPrice: listedPrice != null ? listedPrice : (subtotal || 0),
            status: 'pending',
            gatewayOrderId: order.id,
            gatewayResponse: order
        });

        return {
            payment,
            gatewayOrderId: order.id,
            keyId: process.env.RAZORPAY_KEY_ID,
            amount: options.amount,
            currency: options.currency
        };
    },

    // Verify payment (callback from gateway)
    async verifyPayment({ paymentId, gatewayOrderId, gatewayPaymentId, gatewaySignature }) {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(gatewayOrderId + "|" + gatewayPaymentId)
            .digest('hex');

        if (generated_signature === gatewaySignature) {
            payment.gatewayTransactionId = gatewayPaymentId;
            payment.status = 'success'; // Changed from 'paid' to 'success' to match initiatePayment status
            payment.paidAt = new Date();
            await payment.save();

            return { success: true, payment };
        } else {
            payment.status = 'failed';
            await payment.save();
            throw new Error('Payment verification failed: Invalid signature');
        }
    },

    // Request refund - processes refund through Razorpay
    async requestRefund(paymentId, { reason, reasonDetails, amount = null }) {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        if (payment.status !== 'success') {
            throw new Error('Can only refund successful payments');
        }

        if (!payment.gatewayTransactionId) {
            throw new Error('No gateway transaction ID found - cannot process refund');
        }

        // Use provided amount or full payment amount
        const refundAmount = amount || payment.amount;

        // Create refund record first with pending status
        const refund = await Refund.create({
            payment: paymentId,
            user: payment.user,
            reason,
            reasonDetails,
            amount: refundAmount,
            status: 'pending'
        });

        // Process refund through Razorpay
        try {
            if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
                throw new Error('Razorpay credentials not configured');
            }

            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });

            // Call Razorpay refund API
            const razorpayRefund = await razorpay.payments.refund(payment.gatewayTransactionId, {
                amount: Math.round(refundAmount * 100), // Amount in paise
                speed: 'normal', // 'normal' or 'optimum'
                notes: {
                    reason: reason,
                    refundId: refund._id.toString()
                },
                receipt: `refund_${refund._id}`
            });

            // Update refund record with gateway response
            refund.gatewayRefundId = razorpayRefund.id;
            refund.gatewayResponse = razorpayRefund;
            refund.status = razorpayRefund.status === 'processed' ? 'completed' : 'processing';
            refund.processedAt = new Date();
            await refund.save();

            // Update payment status
            payment.status = 'refunded';
            payment.refundedAt = new Date();
            await payment.save();

            return refund;

        } catch (error) {
            // Update refund record with failure
            refund.status = 'failed';
            refund.failureReason = error.message;
            await refund.save();

            console.error('Razorpay refund failed:', error);
            throw new Error(`Refund processing failed: ${error.message}`);
        }
    },

    // Get all payouts
    async getAllPayouts(query = {}) {
        const { page = 1, limit = 10, status } = query;
        const filter = {};
        if (status) filter.status = status;

        const payouts = await Payout.find(filter)
            .populate('recipient', 'name email')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await Payout.countDocuments(filter);

        return {
            payouts,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        };
    },

    // Process payout (manual, not yet disbursed)
    //
    // Owner-gross contract (Flow 4): the CALLER derives `grossAmount` from the
    // settled Payment(s) and passes it in — processPayout does not read Payments.
    // The owner's gross is based on the FULL LISTED PRICE the owner set
    // (Payment.listedPrice), NOT the discounted amount the buyer was charged:
    //   discountBearer === 'platform' → gross = listedPrice
    //       (the platform absorbs the discount; owner keeps the full listed price)
    //   discountBearer === 'owner'    → gross = listedPrice - discountAmount
    //       (the owner absorbs the discount; their settlement is reduced)
    //   no discount (discountBearer null) → gross = listedPrice
    // Platform-side records always reflect the full listed price. When the
    // settlement caller is wired (task 11), it computes grossAmount per this
    // contract and passes it here; commission below then applies to that gross.
    async processPayout({ recipientId, type, referenceId, referenceModel, grossAmount, platformFeePercentage }) {
        // Commission from config; fall back to 5 only if genuinely absent.
        const commissionPercentage = platformFeePercentage ?? 5;
        const platformCommission = Math.round(grossAmount * (commissionPercentage / 100));
        const netAmount = grossAmount - platformCommission;

        // Bank details are authoritative from the owner, not the caller. Fail
        // closed if the owner has no valid stored details — a payout must be
        // tied to real, valid bank details.
        const owner = await User.findById(recipientId).select('bankDetails');
        if (!isValidBankDetails(owner && owner.bankDetails)) {
            throw new Error('Recipient has no valid bank details on file; cannot process payout');
        }

        const payout = await Payout.create({
            recipient: recipientId,
            type,
            referenceId,
            referenceModel,
            grossAmount,
            platformCommission,
            platformCommissionPercentage: commissionPercentage,
            netAmount,
            bankDetails: owner.bankDetails,
            method: 'manual',
            gatewayPayoutId: null,
            status: 'pending'
        });

        return payout;
    }
};

module.exports = paymentService;
