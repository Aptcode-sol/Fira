const Booking = require('../models/Booking');

const bookingService = {
    // Get all bookings
    async getAllBookings(query = {}) {
        const { page = 1, limit = 10, status } = query;
        const filter = {};
        if (status) filter.status = status;

        const bookings = await Booking.find(filter)
            .populate('user', 'name email')
            .populate('venue', 'name address')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const total = await Booking.countDocuments(filter);

        return {
            bookings,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        };
    },

    // Get user's bookings
    async getUserBookings(userId) {
        const bookings = await Booking.find({ user: userId })
            .populate('venue', 'name address images')
            .sort({ bookingDate: -1 });
        return bookings;
    },

    // Get venue's bookings
    async getVenueBookings(venueId) {
        const bookings = await Booking.find({ venue: venueId })
            .populate('user', 'name email phone')
            .sort({ bookingDate: -1 });
        return bookings;
    },

    // Get booking by ID
    async getBookingById(id) {
        const booking = await Booking.findById(id)
            .populate('user', 'name email phone')
            .populate('venue', 'name address images pricing');
        if (!booking) {
            throw new Error('Booking not found');
        }
        return booking;
    },

    // Create booking
    async createBooking(data) {
        const booking = await Booking.create(data);
        // TODO: Send notification to venue owner
        return booking;
    },

    // Update booking
    async updateBooking(id, updateData) {
        const booking = await Booking.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );
        if (!booking) {
            throw new Error('Booking not found');
        }
        return booking;
    },

    // Update booking status (accept/reject)
    async updateBookingStatus(id, { status, rejectionReason, modifiedDates }) {
        const Venue = require('../models/Venue');

        const updateData = {
            status,
            'ownerResponse.respondedAt': new Date()
        };

        if (rejectionReason) {
            updateData.rejectionReason = rejectionReason;
        }

        if (modifiedDates) {
            updateData['ownerResponse.modifiedDates'] = modifiedDates;
        }

        const booking = await Booking.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        ).populate('venue');

        if (!booking) {
            throw new Error('Booking not found');
        }

        // If accepted, add to venue's blockedDates
        if (status === 'accepted' && booking.venue) {
            const bookingDateStr = new Date(booking.bookingDate).toISOString().split('T')[0];
            const venue = await Venue.findById(booking.venue._id || booking.venue);

            if (venue) {
                // Find existing date entry or create new one
                let dateEntry = venue.blockedDates?.find(d => d.date === bookingDateStr);

                if (dateEntry) {
                    // Add slot to existing date
                    dateEntry.slots.push({
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                        type: 'booked'
                    });
                } else {
                    // Create new date entry
                    if (!venue.blockedDates) venue.blockedDates = [];
                    venue.blockedDates.push({
                        date: bookingDateStr,
                        slots: [{
                            startTime: booking.startTime,
                            endTime: booking.endTime,
                            type: 'booked'
                        }]
                    });
                }

                await venue.save();
            }
        }

        return booking;
    },

    // Cancel booking with refund processing
    async cancelBooking(id, userId, reason = 'User requested cancellation') {
        const refundService = require('./refundService');
        
        // Use refund service for complete cancellation flow
        const result = await refundService.initiateBookingRefund(id, userId, reason);
        
        return result;
    },

    // Initiate payment for an accepted booking
    async initiateBookingPayment(bookingId, userId) {
        const paymentService = require('./paymentService');
        
        const booking = await Booking.findById(bookingId)
            .populate('venue', 'name');
        
        if (!booking) {
            throw new Error('Booking not found');
        }

        if (booking.user.toString() !== userId.toString()) {
            throw new Error('Unauthorized: This booking belongs to another user');
        }

        if (booking.status !== 'accepted') {
            throw new Error('Booking must be accepted before payment');
        }

        if (booking.paymentStatus === 'paid') {
            throw new Error('Advance already paid');
        }

        // Calculate 10% advance payment
        const advanceAmount = Math.round(booking.totalAmount * 0.10);
        const platformFee = Math.round(advanceAmount * 0.05);
        
        // Initiate payment via Razorpay for ADVANCE amount only
        const paymentData = await paymentService.initiatePayment({
            userId,
            type: 'venue_booking',
            referenceId: bookingId,
            referenceModel: 'Booking',
            amount: advanceAmount // 10% advance
        });

        // Update booking with platform fee
        booking.platformFee = platformFee;
        await booking.save();

        return {
            ...paymentData,
            booking: {
                _id: booking._id,
                venueName: booking.venue?.name,
                totalAmount: booking.totalAmount,
                advanceAmount: advanceAmount,
                remainingAmount: booking.totalAmount - advanceAmount,
                bookingDate: booking.bookingDate
            }
        };
    },

    // Complete payment after Razorpay verification
    async completeBookingPayment(bookingId, { gatewayOrderId, gatewayPaymentId, gatewaySignature }) {
        const paymentService = require('./paymentService');
        const Payment = require('../models/Payment');

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }

        // Find the payment record
        const payment = await Payment.findOne({
            referenceId: bookingId,
            referenceModel: 'Booking',
            status: 'pending'
        });

        if (!payment) {
            throw new Error('Payment record not found');
        }

        // Verify payment with Razorpay
        const result = await paymentService.verifyPayment({
            paymentId: payment._id,
            gatewayOrderId,
            gatewayPaymentId,
            gatewaySignature
        });

        if (result.success) {
            // Update booking payment status
            booking.paymentStatus = 'paid';
            booking.payment = payment._id;
            await booking.save();

            return { success: true, booking, payment: result.payment };
        }

        throw new Error('Payment verification failed');
    }
};

module.exports = bookingService;

