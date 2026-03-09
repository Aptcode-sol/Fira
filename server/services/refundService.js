const Refund = require('../models/Refund');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Razorpay = require('razorpay');
const notificationService = require('./notificationService');

/**
 * Refund Service
 * Handles all refund-related operations including Razorpay integration
 */
const refundService = {
    /**
     * Calculate refund amount based on time-based policy
     * @param {number} originalAmount - Original payment amount
     * @param {Date} eventDate - Event date
     * @returns {object} - { amount, refundType, policy }
     */
    calculateRefundAmount(originalAmount, eventDate) {
        const now = new Date();
        const eventTime = new Date(eventDate);
        const hoursUntilEvent = (eventTime - now) / (1000 * 60 * 60);

        let refundPercentage = 0;
        let refundType = 'none';
        let policy = '';

        if (hoursUntilEvent >= 48) {
            refundPercentage = 100;
            refundType = 'full';
            policy = 'Full refund (48+ hours before event)';
        } else if (hoursUntilEvent >= 24) {
            refundPercentage = 50;
            refundType = 'partial';
            policy = '50% refund (24-48 hours before event)';
        } else {
            refundPercentage = 0;
            refundType = 'none';
            policy = 'No refund (less than 24 hours before event)';
        }

        return {
            amount: Math.round(originalAmount * (refundPercentage / 100)),
            refundType,
            policy,
            refundPercentage
        };
    },

    /**
     * Process a refund via Razorpay
     * @param {string} paymentId - Payment document ID
     * @param {object} options - { amount, reason, reasonDetails, refundType, userId }
     * @returns {object} - Refund record
     */
    async processRefund(paymentId, { amount, reason, reasonDetails, refundType = 'full', userId }) {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        if (payment.status !== 'success') {
            throw new Error('Can only refund successful payments');
        }

        // Check if already refunded
        const existingRefund = await Refund.findOne({ 
            payment: paymentId, 
            status: { $in: ['pending', 'processing', 'completed'] } 
        });
        if (existingRefund) {
            throw new Error('Refund already exists for this payment');
        }

        // Validate refund amount
        const refundAmount = amount || payment.amount;
        if (refundAmount > payment.amount) {
            throw new Error('Refund amount cannot exceed payment amount');
        }

        // Create refund record
        const refund = await Refund.create({
            payment: paymentId,
            user: userId || payment.user,
            reason,
            reasonDetails,
            amount: refundAmount,
            refundType: refundAmount === payment.amount ? 'full' : 'partial',
            status: 'processing'
        });

        // Process via Razorpay if credentials exist
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && payment.gatewayTransactionId) {
            try {
                const razorpay = new Razorpay({
                    key_id: process.env.RAZORPAY_KEY_ID,
                    key_secret: process.env.RAZORPAY_KEY_SECRET,
                });

                const razorpayRefund = await razorpay.payments.refund(payment.gatewayTransactionId, {
                    amount: refundAmount * 100, // Convert to paise
                    notes: {
                        reason,
                        refundId: refund._id.toString()
                    }
                });

                // Update refund with gateway response
                refund.gatewayRefundId = razorpayRefund.id;
                refund.gatewayResponse = razorpayRefund;
                refund.status = 'completed';
                refund.processedAt = new Date();
                await refund.save();

                // Update payment status
                payment.status = 'refunded';
                await payment.save();

                console.log(`✅ Refund processed via Razorpay: ${razorpayRefund.id}`);
            } catch (error) {
                console.error('❌ Razorpay refund failed:', error.message);
                refund.status = 'failed';
                refund.gatewayResponse = { error: error.message };
                await refund.save();
                throw new Error(`Failed to process refund: ${error.message}`);
            }
        } else {
            // Mark as completed for testing/demo without Razorpay
            console.log('⚠️ Razorpay not configured - marking refund as completed for demo');
            refund.status = 'completed';
            refund.processedAt = new Date();
            await refund.save();

            payment.status = 'refunded';
            await payment.save();
        }

        return refund;
    },

    /**
     * Initiate refunds for all tickets when an event is cancelled
     * @param {string} eventId - Event ID
     * @param {string} reason - Cancellation reason
     * @returns {object} - { totalRefunds, successCount, failedCount, refunds }
     */
    async initiateEventCancellationRefunds(eventId, reason = 'Event cancelled by organizer') {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        // Find all active tickets for this event
        const tickets = await Ticket.find({ 
            event: eventId, 
            status: 'active' 
        }).populate('payment user');

        const results = {
            totalRefunds: tickets.length,
            successCount: 0,
            failedCount: 0,
            refunds: []
        };

        for (const ticket of tickets) {
            try {
                // Skip if no payment (free ticket)
                if (!ticket.payment || ticket.price === 0) {
                    // Just cancel the ticket
                    ticket.status = 'cancelled';
                    await ticket.save();
                    results.successCount++;
                    continue;
                }

                // Process full refund for paid tickets
                const refund = await this.processRefund(ticket.payment._id || ticket.payment, {
                    amount: ticket.price,
                    reason: 'event_cancelled',
                    reasonDetails: reason,
                    refundType: 'full',
                    userId: ticket.user._id || ticket.user
                });

                // Update ticket status
                ticket.status = 'cancelled';
                await ticket.save();

                // Send notification to user
                await notificationService.createNotification({
                    userId: ticket.user._id || ticket.user,
                    type: 'refund',
                    title: 'Event Cancelled - Refund Processed',
                    message: `The event "${event.name}" has been cancelled. Your refund of ₹${refund.amount} has been initiated.`,
                    data: { eventId, refundId: refund._id, amount: refund.amount },
                    priority: 'high'
                });

                results.refunds.push(refund);
                results.successCount++;
            } catch (error) {
                console.error(`Failed to refund ticket ${ticket._id}:`, error.message);
                results.failedCount++;
            }
        }

        // Update event attendee count
        await Event.findByIdAndUpdate(eventId, {
            $set: { currentAttendees: 0 }
        });

        return results;
    },

    /**
     * Initiate refund for a single ticket cancellation
     * @param {string} ticketId - Ticket ID
     * @param {string} userId - User requesting cancellation
     * @param {string} reason - Cancellation reason
     * @returns {object} - { ticket, refund, refundEligibility }
     */
    async initiateTicketRefund(ticketId, userId, reason = 'User requested cancellation') {
        const ticket = await Ticket.findById(ticketId)
            .populate('event')
            .populate('payment');

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        if (ticket.user.toString() !== userId.toString()) {
            throw new Error('Unauthorized: This ticket belongs to another user');
        }

        if (ticket.status !== 'active') {
            throw new Error('Ticket is not active');
        }

        if (ticket.isUsed) {
            throw new Error('Cannot cancel used ticket');
        }

        // Calculate refund eligibility
        const refundEligibility = this.calculateRefundAmount(ticket.price, ticket.event.date);

        let refund = null;

        // Process refund if eligible and ticket was paid
        if (refundEligibility.amount > 0 && ticket.payment && ticket.price > 0) {
            refund = await this.processRefund(ticket.payment._id || ticket.payment, {
                amount: refundEligibility.amount,
                reason: 'user_request',
                reasonDetails: reason,
                refundType: refundEligibility.refundType,
                userId
            });
        }

        // Update ticket status
        ticket.status = 'cancelled';
        await ticket.save();

        // Decrease event attendee count
        await Event.findByIdAndUpdate(ticket.event._id, {
            $inc: { currentAttendees: -ticket.quantity }
        });

        // Send notification
        await notificationService.createNotification({
            userId,
            type: 'ticket_cancelled',
            title: 'Ticket Cancelled',
            message: refund 
                ? `Your ticket for "${ticket.event.name}" has been cancelled. Refund of ₹${refund.amount} (${refundEligibility.policy}) has been initiated.`
                : `Your ticket for "${ticket.event.name}" has been cancelled. ${refundEligibility.policy}`,
            data: { ticketId, eventId: ticket.event._id, refundId: refund?._id },
            priority: 'medium'
        });

        return {
            ticket,
            refund,
            refundEligibility
        };
    },

    /**
     * Initiate refund for booking cancellation
     * @param {string} bookingId - Booking ID
     * @param {string} userId - User requesting cancellation
     * @param {string} reason - Cancellation reason
     * @returns {object} - { booking, refund }
     */
    async initiateBookingRefund(bookingId, userId, reason = 'User requested cancellation') {
        const booking = await Booking.findById(bookingId).populate('payment venue');

        if (!booking) {
            throw new Error('Booking not found');
        }

        if (booking.user.toString() !== userId.toString()) {
            throw new Error('Unauthorized: This booking belongs to another user');
        }

        if (booking.status === 'cancelled') {
            throw new Error('Booking is already cancelled');
        }

        if (booking.status === 'completed') {
            throw new Error('Cannot cancel completed booking');
        }

        let refund = null;

        // Process refund if payment was made
        if (booking.payment && booking.paymentStatus === 'paid') {
            // Calculate refund based on booking date
            const refundEligibility = this.calculateRefundAmount(
                booking.payment.amount || (booking.totalAmount * 0.10), // Advance was 10%
                booking.bookingDate
            );

            if (refundEligibility.amount > 0) {
                refund = await this.processRefund(booking.payment._id || booking.payment, {
                    amount: refundEligibility.amount,
                    reason: 'booking_cancelled',
                    reasonDetails: reason,
                    refundType: refundEligibility.refundType,
                    userId
                });
            }

            // Update booking payment status
            booking.paymentStatus = 'refunded';
        }

        // Update booking status
        booking.status = 'cancelled';
        booking.rejectionReason = reason;
        await booking.save();

        // Remove blocked date from venue
        if (booking.venue) {
            const Venue = require('../models/Venue');
            const venue = await Venue.findById(booking.venue._id || booking.venue);
            
            if (venue && venue.blockedDates) {
                const bookingDateStr = new Date(booking.bookingDate).toISOString().split('T')[0];
                
                // Find and remove the booking slot
                const dateEntry = venue.blockedDates.find(d => d.date === bookingDateStr);
                if (dateEntry) {
                    dateEntry.slots = dateEntry.slots.filter(
                        slot => !(slot.startTime === booking.startTime && slot.endTime === booking.endTime)
                    );
                    
                    // Remove date entry if no slots left
                    if (dateEntry.slots.length === 0) {
                        venue.blockedDates = venue.blockedDates.filter(d => d.date !== bookingDateStr);
                    }
                    
                    await venue.save();
                }
            }
        }

        // Send notification
        await notificationService.createNotification({
            userId,
            type: 'booking_cancelled',
            title: 'Booking Cancelled',
            message: refund 
                ? `Your venue booking has been cancelled. Refund of ₹${refund.amount} has been initiated.`
                : `Your venue booking has been cancelled.`,
            data: { bookingId, refundId: refund?._id },
            priority: 'medium'
        });

        return { booking, refund };
    },

    /**
     * Get refund by ID
     * @param {string} refundId - Refund ID
     * @returns {object} - Refund document
     */
    async getRefundById(refundId) {
        const refund = await Refund.findById(refundId)
            .populate('payment')
            .populate('user', 'name email');
        
        if (!refund) {
            throw new Error('Refund not found');
        }
        
        return refund;
    },

    /**
     * Get all refunds for a user
     * @param {string} userId - User ID
     * @returns {array} - List of refunds
     */
    async getRefundsByUser(userId) {
        const refunds = await Refund.find({ user: userId })
            .populate('payment')
            .sort({ createdAt: -1 });
        
        return refunds;
    },

    /**
     * Get all refunds (admin)
     * @param {object} query - { page, limit, status }
     * @returns {object} - Paginated refunds
     */
    async getAllRefunds(query = {}) {
        const { page = 1, limit = 10, status } = query;
        const filter = {};
        if (status) filter.status = status;

        const refunds = await Refund.find(filter)
            .populate('user', 'name email')
            .populate('payment')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await Refund.countDocuments(filter);

        return {
            refunds,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        };
    },

    /**
     * Admin: Manually process a pending refund
     * @param {string} refundId - Refund ID
     * @param {string} adminId - Admin user ID
     * @param {string} action - 'approve' or 'reject'
     * @param {string} notes - Admin notes
     * @returns {object} - Updated refund
     */
    async processRefundRequest(refundId, adminId, action, notes = '') {
        const refund = await Refund.findById(refundId).populate('payment');
        
        if (!refund) {
            throw new Error('Refund not found');
        }

        if (refund.status !== 'pending') {
            throw new Error('Refund is not pending');
        }

        refund.reviewedBy = adminId;
        refund.reviewedAt = new Date();
        refund.adminNotes = notes;

        if (action === 'approve') {
            // Process the refund via Razorpay
            if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && refund.payment.gatewayTransactionId) {
                try {
                    const razorpay = new Razorpay({
                        key_id: process.env.RAZORPAY_KEY_ID,
                        key_secret: process.env.RAZORPAY_KEY_SECRET,
                    });

                    const razorpayRefund = await razorpay.payments.refund(refund.payment.gatewayTransactionId, {
                        amount: refund.amount * 100
                    });

                    refund.gatewayRefundId = razorpayRefund.id;
                    refund.gatewayResponse = razorpayRefund;
                    refund.status = 'completed';
                    refund.processedAt = new Date();

                    // Update payment status
                    refund.payment.status = 'refunded';
                    await refund.payment.save();
                } catch (error) {
                    refund.status = 'failed';
                    refund.gatewayResponse = { error: error.message };
                }
            } else {
                refund.status = 'completed';
                refund.processedAt = new Date();
            }
        } else if (action === 'reject') {
            refund.status = 'rejected';
            refund.rejectionReason = notes;
        }

        await refund.save();

        // Notify user
        await notificationService.createNotification({
            userId: refund.user,
            type: 'refund_update',
            title: action === 'approve' ? 'Refund Approved' : 'Refund Rejected',
            message: action === 'approve' 
                ? `Your refund of ₹${refund.amount} has been approved and processed.`
                : `Your refund request has been rejected. Reason: ${notes}`,
            data: { refundId },
            priority: 'high'
        });

        return refund;
    },

    /**
     * Check refund eligibility for a ticket
     * @param {string} ticketId - Ticket ID
     * @returns {object} - Refund eligibility details
     */
    async checkTicketRefundEligibility(ticketId) {
        const ticket = await Ticket.findById(ticketId).populate('event');
        
        if (!ticket) {
            throw new Error('Ticket not found');
        }

        if (ticket.status !== 'active') {
            return {
                eligible: false,
                reason: 'Ticket is not active',
                refundAmount: 0,
                policy: 'N/A'
            };
        }

        if (ticket.isUsed) {
            return {
                eligible: false,
                reason: 'Ticket has already been used',
                refundAmount: 0,
                policy: 'N/A'
            };
        }

        if (ticket.price === 0) {
            return {
                eligible: false,
                reason: 'Free tickets are not eligible for refund',
                refundAmount: 0,
                policy: 'N/A'
            };
        }

        const refundCalc = this.calculateRefundAmount(ticket.price, ticket.event.date);

        return {
            eligible: refundCalc.amount > 0,
            reason: refundCalc.amount > 0 ? 'Eligible for refund' : 'Cancellation too close to event',
            refundAmount: refundCalc.amount,
            originalAmount: ticket.price,
            refundPercentage: refundCalc.refundPercentage,
            policy: refundCalc.policy,
            eventDate: ticket.event.date
        };
    }
};

module.exports = refundService;
