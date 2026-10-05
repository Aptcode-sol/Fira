const Booking = require('../models/Booking');
const whatsappService = require('./whatsappService');
const whatsappTemplates = require('../utils/whatsappTemplates');
const { roundMoney } = require('../utils/money');

/**
 * Mark every day `booking` covers as 'booked' on its venue's calendar.
 * Best-effort: the booking itself is already committed, and the Booking-range
 * check in createBooking is what actually prevents a double booking.
 */
async function blockVenueCalendar(booking) {
    try {
        const Venue = require('../models/Venue');
        const { blockBookingDays } = require('../utils/venueAvailability');
        const venue = await Venue.findById(booking.venue?._id || booking.venue);
        if (!venue) return;
        blockBookingDays(venue, booking);
        await venue.save();
    } catch (err) {
        console.error(`Failed to block calendar for booking ${booking._id}:`, err.message);
    }
}

const bookingService = {
    // Get all bookings
    async getAllBookings(query = {}) {
        const { page = 1, limit = 10, status, user, venue } = query;
        const filter = {};
        if (status) filter.status = String(status);
        if (user) filter.user = String(user);
        if (venue) filter.venue = String(venue);

        const bookings = await Booking.find(filter)
            .populate('user', 'name email')
            .populate('venue', 'name address')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 })
            .lean();

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
            .sort({ bookingDate: -1 })
            .lean();
        return bookings;
    },

    // Get venue's bookings
    async getVenueBookings(venueId) {
        const bookings = await Booking.find({ venue: venueId })
            .populate('user', 'name email phone')
            .sort({ bookingDate: -1 })
            .lean();
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
        const Venue = require('../models/Venue');
        const User = require('../models/User');
        const emailService = require('./emailService');
        const paymentSchedule = require('../utils/paymentSchedule');

        // A same-day booking with startTime >= endTime is zero-duration (or
        // inverted) - nothing on the client enforced this, so a booking naming
        // e.g. 14:00-14:00 could reach here and be "confirmed" as valid. Only
        // rejected when start and end fall on the same calendar day: a multi-day
        // booking's end time is a different day, so any end time is legitimate.
        if (data.bookingDate && data.startTime && data.endTime) {
            const bookingDay = new Date(data.bookingDate).toISOString().split('T')[0];
            const endDay = data.endDate
                ? new Date(data.endDate).toISOString().split('T')[0]
                : bookingDay;
            if (endDay < bookingDay) {
                throw new Error('End date must be on or after the start date');
            }
            if (endDay === bookingDay && data.endTime <= data.startTime) {
                throw new Error('End time must be after start time');
            }
        }

        // A client must not be able to create a booking that is already
        // accepted/paid, or carries its own schedule - those are server decisions.
        data.status = 'pending';
        delete data.paymentStatus;
        delete data.payment;
        delete data.paymentSchedule;
        delete data.platformFee;
        if (!data.endDate) data.endDate = null;

        // Booking here is day-rate, not per-slot (see venuePricing.js), so any
        // other non-terminal booking that touches ANY day of this one's range
        // blocks it - regardless of the times either one names. Only the start
        // day used to be checked, so a 21st-22nd request sailed past a booking
        // that already held the 22nd.
        if (data.venue && data.bookingDate) {
            const {
                bookingDayKeys, isDayTaken, overlappingBookingFilter, MAX_BOOKING_DAYS,
            } = require('../utils/venueAvailability');

            const dayKeys = bookingDayKeys(data.bookingDate, data.endDate);
            if (dayKeys.length === 0) {
                throw new Error('End date must be on or after the start date');
            }
            const startKey = dayKeys[0];
            const endKey = data.endDate
                ? new Date(data.endDate).toISOString().split('T')[0]
                : startKey;
            if (endKey !== dayKeys[dayKeys.length - 1]) {
                throw new Error(`A booking can cover at most ${MAX_BOOKING_DAYS} days`);
            }

            const unavailable = dayKeys.length > 1
                ? 'One or more of the selected dates is no longer available for this venue'
                : 'This date is no longer available for this venue';

            const todayKey = new Date().toISOString().split('T')[0];
            if (startKey < todayKey) {
                throw new Error('Bookings cannot start in the past');
            }

            const existing = await Booking.findOne(overlappingBookingFilter(data.venue, startKey, endKey));
            if (existing) {
                throw new Error(unavailable);
            }

            // Calendar blocks: owner 'busy' days (offline/external bookings) and
            // system 'booked' days (events, confirmed bookings). Without this the
            // UI showed the day as unavailable but a direct submit still went in.
            const venueDoc = await Venue.findById(data.venue).select('blockedDates daySlots pricing');
            const bookedDaySlot = new Set(
                (venueDoc?.daySlots || [])
                    .filter(s => s.isBooked)
                    .map(s => new Date(s.date).toISOString().split('T')[0])
            );
            if (dayKeys.some(k => isDayTaken(venueDoc?.blockedDates, k) || bookedDaySlot.has(k))) {
                throw new Error(unavailable);
            }

            // The amount is priced here, not taken from the request: day rate ×
            // days covered, the same rule the client shows (venuePricing.ts).
            const dayRate = venueDoc?.pricing?.pricePerDay ?? venueDoc?.pricing?.basePrice ?? 0;
            if (dayRate > 0) {
                data.totalAmount = roundMoney(dayRate * dayKeys.length);
            }
        }

        // Freeze the date-aware payment schedule at submission time (Req 10.3):
        // > 7 days to event ⇒ 10% deposit now + 90% balance due 24h before start;
        // ≤ 7 days ⇒ full amount now. Decided once here and never recomputed.
        data.paymentSchedule = paymentSchedule.build(new Date(), data.bookingDate, data.startTime, data.totalAmount);

        console.log('📝 Creating booking for venue:', data.venue);
        let booking;
        try {
            booking = await Booking.create(data);
        } catch (err) {
            // The unique {venue, bookingDate} index is the race backstop for the
            // check above; surface it as the same availability error.
            if (err && err.code === 11000) {
                throw new Error('This date is no longer available for this venue');
            }
            throw err;
        }
        console.log('✅ Booking created:', booking._id);

        // Fetch venue with owner details
        const venue = await Venue.findById(data.venue).populate('owner', 'name email');
        console.log('🏢 Venue found:', venue ? venue.name : 'NOT FOUND');
        console.log('👤 Venue owner:', venue?.owner ? `${venue.owner.name} (${venue.owner.email})` : 'NOT FOUND/POPULATED');

        // Function scope, not inside the `if (venue)` block below.
        //
        // This was declared inside that block while the owner-notification block after
        // it also reads `booker.name` - so every booking with a venue owner threw
        // "ReferenceError: booker is not defined". It threw *after* Booking.create, so
        // the booking was saved and the caller still got a 500: the user saw an error
        // for a booking that had actually gone through.
        const booker = await User.findById(data.user).select('name email phone');
        console.log('🎫 Booker:', booker ? `${booker.name} (${booker.email})` : 'NOT FOUND');

        if (venue) {
            // Check if venue has auto-approve enabled
            if (venue.autoApproveBookings) {
                await Booking.findByIdAndUpdate(
                    booking._id,
                    { $set: { status: 'accepted' } },
                    { new: true }
                );
                booking.status = 'accepted';
                await blockVenueCalendar(booking);
            }

            // Send WhatsApp confirmation to booker if phone is available
            if (booker?.phone) {
                try {
                    const template = whatsappTemplates.appointment_confirmation_1({
                        userName: booker.name,
                        businessName: 'Fira',
                        venueName: venue.name,
                        date: new Date(data.bookingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        time: `${data.startTime} - ${data.endTime}`
                    });
                    await whatsappService.sendTemplate({ to: booker.phone, template });
                    console.log('✅ WhatsApp booking confirmation sent to', booker.phone);
                } catch (waErr) {
                    console.warn('⚠️ Failed to send WhatsApp booking confirmation:', waErr.message);
                }
            }

            // Send email notification to venue owner
            if (venue.owner && venue.owner.email && booker) {
                console.log('📧 Attempting to send email to venue owner:', venue.owner.email);
                try {
                    await emailService.sendVenueBookingEmail(
                        venue.owner.email,
                        venue.owner.name || 'Venue Owner',
                        { name: venue.name },
                        {
                            date: data.bookingDate,
                            startTime: data.startTime,
                            endTime: data.endTime,
                            guestCount: data.expectedGuests,
                            totalPrice: data.totalAmount,
                            message: data.specialRequests
                        },
                        {
                            name: booker.name,
                            email: booker.email,
                            phone: booker.phone
                        }
                    );
                    console.log('✅ Venue booking notification sent successfully to:', venue.owner.email);
                } catch (emailErr) {
                    console.error('❌ Failed to send booking notification email:', emailErr.message);
                    console.error('Email error details:', emailErr);
                }
            } else {
                console.log('⚠️ Skipping email - missing data:', {
                    hasOwner: !!venue.owner,
                    hasOwnerEmail: !!venue.owner?.email,
                    hasBooker: !!booker
                });
            }
        } else {
            console.log('⚠️ No venue found, skipping email notification');
        }

        // In-app + push for the venue owner. Email already goes out above, but
        // an owner who lives in the dashboard should not have to check mail.
        if (venue?.owner?._id) {
            const notificationService = require('./notificationService');
            notificationService.createNotification({
                userId: venue.owner._id,
                type: 'booking_request',
                title: 'New booking request',
                message: `${booker?.name || 'Someone'} wants to book ${venue.name} on ${new Date(data.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
                data: {
                    referenceId: booking._id,
                    referenceModel: 'Booking',
                    actionUrl: '/dashboard/requests',
                    extra: { venueName: venue.name, bookingDate: data.bookingDate }
                },
                priority: 'high',
                channel: 'all'
            }).catch(err => console.error('booking_request notification failed:', err.message));
        }

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

        // If accepted, mark every day the booking covers as booked on the
        // venue calendar.
        if (status === 'accepted' && booking.venue) {
            await blockVenueCalendar(booking);
        }

        // Tell the person who made the request what the owner decided.
        if (status === 'accepted' || status === 'rejected') {
            const notificationService = require('./notificationService');
            const venueName = booking.venue?.name || 'the venue';
            const accepted = status === 'accepted';

            notificationService.createNotification({
                userId: booking.user,
                type: accepted ? 'booking_accepted' : 'booking_rejected',
                title: accepted ? 'Booking confirmed 🎉' : 'Booking declined',
                message: accepted
                    ? `${venueName} accepted your booking for ${new Date(booking.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`
                    : `${venueName} could not take your booking${rejectionReason ? `: ${rejectionReason}` : '.'}`,
                data: {
                    referenceId: booking._id,
                    referenceModel: 'Booking',
                    actionUrl: '/dashboard/bookings',
                    extra: { venueName, status, rejectionReason: rejectionReason || null }
                },
                priority: 'high',
                channel: 'all'
            }).catch(err => console.error(`booking_${status} notification failed:`, err.message));
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
            .populate('venue', 'name platformFeePercentage');

        if (!booking) {
            throw new Error('Booking not found');
        }

        if (booking.user.toString() !== userId.toString()) {
            throw new Error('Unauthorized: This booking belongs to another user');
        }

        if (booking.status !== 'accepted' && booking.status !== 'pending') {
            throw new Error('Booking must be pending or accepted before payment');
        }

        if (booking.paymentStatus === 'paid') {
            throw new Error('Advance already paid');
        }

        // The charge at booking time is driven by the frozen payment schedule:
        // installment ⇒ deposit only (10%); full (or legacy docs) ⇒ whole total
        // (Req 2.1/2.2). Route it through the single money source (calculateBilling)
        // so it is charged and recorded with a full breakdown: subtotal, qty 1.
        // Fail closed — if billing throws, we abort before any Razorpay order.
        const schedule = booking.paymentSchedule || {};
        const chargeSubtotal = schedule.type === 'installment'
            ? roundMoney(schedule.depositAmount)
            : roundMoney(booking.totalAmount); // 'full' or legacy → whole total (Req 2.2)
        const feePct = booking.venue?.platformFeePercentage ?? 5; // config, not hardcoded
        const billing = paymentService.calculateBilling(chargeSubtotal, 1, feePct);

        // Initiate payment via Razorpay for the ADVANCE billing breakdown.
        const paymentData = await paymentService.initiatePayment({
            userId,
            type: 'venue_booking',
            referenceId: bookingId,
            referenceModel: 'Booking',
            amount: billing.totalAmount,
            subtotal: billing.subtotal,
            platformFee: billing.platformFee,
            platformFeePercentage: feePct,
            gstAmount: billing.gstAmount,
            totalAmount: billing.totalAmount
        });

        // Update booking with the platform fee that was actually charged.
        booking.platformFee = billing.platformFee;
        await booking.save();

        return {
            ...paymentData,
            booking: {
                _id: booking._id,
                venueName: booking.venue?.name,
                totalAmount: booking.totalAmount,
                paymentScheduleType: schedule.type || 'full',
                depositAmount: schedule.depositAmount ?? chargeSubtotal,
                balanceAmount: schedule.balanceAmount ?? 0,
                balanceDueAt: schedule.balanceDueAt ?? null,
                advanceAmount: chargeSubtotal, // backward compat: amount charged now
                remainingAmount: roundMoney(booking.totalAmount - chargeSubtotal),
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
            // Update booking payment status and set booking to accepted since advance is paid
            booking.paymentStatus = 'paid';
            booking.status = 'accepted'; // Transition from pending to accepted
            booking.payment = payment._id;
            await booking.save();

            // A paid booking holds its dates: show them as booked on the
            // venue calendar. This path never went through updateBookingStatus,
            // so paid bookings used to leave the calendar green.
            await blockVenueCalendar(booking);

            return { success: true, booking, payment: result.payment };
        }

        throw new Error('Payment verification failed');
    },

    // Initiate payment for the outstanding balance of an installment booking.
    // Mirrors initiateBookingPayment, but charges exactly the frozen
    // balanceAmount (Req 3.4 — no partials; the amount comes from the booking,
    // never from the client).
    async initiateBalancePayment(bookingId, userId) {
        const paymentService = require('./paymentService');

        const booking = await Booking.findById(bookingId)
            .populate('venue', 'name platformFeePercentage');

        if (!booking) {
            throw new Error('Booking not found');
        }

        if (booking.user.toString() !== userId.toString()) {
            throw new Error('Unauthorized: This booking belongs to another user');
        }

        // Only an installment booking with a still-pending balance can be paid
        // (Req 3.3). Anything else — full schedule, already paid, or forfeited —
        // has no balance due.
        const s = booking.paymentSchedule || {};
        if (s.type !== 'installment' || s.balanceStatus !== 'pending') {
            throw new Error('No balance payment is currently due');
        }

        // Charge exactly the balance, routed through the single money source so it
        // is recorded with a full breakdown (subtotal, qty 1). Fail closed — if
        // billing throws, we abort before any Razorpay order.
        const chargeSubtotal = roundMoney(s.balanceAmount);
        const feePct = booking.venue?.platformFeePercentage ?? 5;
        const billing = paymentService.calculateBilling(chargeSubtotal, 1, feePct);

        const paymentData = await paymentService.initiatePayment({
            userId,
            type: 'venue_booking',
            referenceId: bookingId,
            referenceModel: 'Booking',
            amount: billing.totalAmount,
            subtotal: billing.subtotal,
            platformFee: billing.platformFee,
            platformFeePercentage: feePct,
            gstAmount: billing.gstAmount,
            totalAmount: billing.totalAmount
        });

        return {
            ...paymentData,
            booking: {
                _id: booking._id,
                venueName: booking.venue?.name,
                balanceAmount: s.balanceAmount,
                balanceDueAt: s.balanceDueAt,
                bookingDate: booking.bookingDate
            }
        };
    },

    // Complete a balance payment after Razorpay verification. Mirrors
    // completeBookingPayment.
    async completeBalancePayment(bookingId, { gatewayOrderId, gatewayPaymentId, gatewaySignature }) {
        const paymentService = require('./paymentService');
        const Payment = require('../models/Payment');

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }

        // Find the pending payment record for this booking's balance charge.
        const payment = await Payment.findOne({
            referenceId: bookingId,
            referenceModel: 'Booking',
            status: 'pending'
        });

        if (!payment) {
            throw new Error('Payment record not found');
        }

        const result = await paymentService.verifyPayment({
            paymentId: payment._id,
            gatewayOrderId,
            gatewayPaymentId,
            gatewaySignature
        });

        if (result.success) {
            // Re-check the guard so a race with the enforcement job can't
            // double-apply: only flip to paid if the balance is still pending and
            // the deadline hasn't passed. If enforcement already forfeited it (or
            // the deadline lapsed), leave the status untouched and surface it for
            // manual handling rather than reviving a cancelled booking.
            const s = booking.paymentSchedule || {};
            const notPastDeadline = s.balanceDueAt == null
                || Date.now() < new Date(s.balanceDueAt).getTime();

            if (s.balanceStatus === 'pending' && notPastDeadline) {
                booking.paymentSchedule.balanceStatus = 'paid';
                booking.paymentSchedule.balancePayment = payment._id;
                await booking.save();
                return { success: true, booking, payment: result.payment };
            }

            return {
                success: true,
                booking,
                payment: result.payment,
                note: 'balance status unchanged'
            };
        }

        throw new Error('Payment verification failed');
    }
};

module.exports = bookingService;

