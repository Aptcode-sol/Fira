const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const paymentService = require('./paymentService'); // Import payment service
const discountService = require('./discountService'); // Server-side discount re-validation
const { PURCHASE_FALLBACK_TIER } = require('./ticketTiers');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { roundMoney } = require('../utils/money');

// One money branch for both flat and tier paid purchases (ponytail: stays
// in-file, no cross-service abstraction until a third caller appears).
// Runs the shared billing math then the gateway, passing the FULL breakdown
// through so charged == recorded by construction. discountAmount has already
// been re-validated server-side by the caller; it is never taken from a client.
async function requirePaymentFor(priceUnit, quantity, feePct, discountAmount, { userId, referenceId, referenceModel, discountCode, discountBearer = null }) {
    const billing = paymentService.calculateBilling(priceUnit, quantity, feePct, discountAmount);

    return paymentService.initiatePayment({
        userId,
        type: 'ticket',
        referenceId,
        referenceModel,
        amount: billing.totalAmount,
        subtotal: billing.subtotal,
        platformFee: billing.platformFee,
        platformFeePercentage: feePct,
        gstAmount: billing.gstAmount,
        totalAmount: billing.totalAmount,
        discountCode: discountCode || null,
        discountAmount,
        // Flow 4 attribution: who absorbs the discount, and the full listed
        // price (before discount) so settlement can pay the owner correctly.
        discountBearer,
        listedPrice: billing.subtotal
    });
}

const ticketService = {
    // Get all tickets
    async getAllTickets(query = {}) {
        const { page = 1, limit = 10, status } = query;
        const filter = {};
        if (status) filter.status = status;

        const tickets = await Ticket.find(filter)
            .populate('user', 'name email')
            .populate('event', 'name date venue')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 })
            .lean();

        const total = await Ticket.countDocuments(filter);

        return {
            tickets,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        };
    },

    // Get user's tickets
    async getUserTickets(userId) {
        const tickets = await Ticket.find({ user: userId })
            .populate({
                path: 'event',
                select: 'name date startTime startDateTime endDateTime images venue',
                populate: { path: 'venue', select: 'name address' }
            })
            .sort({ createdAt: -1 })
            .lean();
        return tickets;
    },

    // Get event's tickets
    async getEventTickets(eventId) {
        const tickets = await Ticket.find({ event: eventId })
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .lean();
        return tickets;
    },

    // Get ticket by ID
    async getTicketById(id) {
        const ticket = await Ticket.findById(id)
            .populate('user', 'name email')
            .populate({
                path: 'event',
                populate: { path: 'venue', select: 'name address' }
            });
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        return ticket;
    },

    // Purchase ticket
    async purchaseTicket({ userId, eventId, quantity = 1, ticketType = PURCHASE_FALLBACK_TIER, paymentId = null, discountCode = null }) {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        // Check if event is in the past or completed/cancelled
        const now = new Date();
        const eventStart = new Date(event.startDateTime || event.date);
        if (eventStart < now) {
            throw new Error('Tickets cannot be purchased for past events');
        }
        if (event.status === 'completed' || event.status === 'cancelled') {
            throw new Error(`This event is ${event.status}. Tickets are no longer available.`);
        }

        if (event.currentAttendees + quantity > event.maxAttendees) {
            throw new Error('Not enough tickets available');
        }

        /*
         * Resolve the tier the buyer asked for.
         *
         * The tier is client-supplied, and it now decides which door admits the
         * holder (tier-scoped scanners match Ticket.ticketType against it) and what
         * they are charged. So it is a trust boundary twice over: an unrecognised
         * name is rejected rather than stored, and the price comes from the tier
         * record on the event, never from the request.
         *
         * 'general' stays valid on an event with no tiers, which is what every
         * ticket issued before tiers existed is - so no migration is needed.
         */
        const tiers = event.ticketTiers || [];
        const tier = tiers.find(t => t.name === ticketType) || null;
        if (tiers.length > 0 && !tier) {
            throw new Error(`"${ticketType}" is not a ticket tier for this event`);
        }
        if (tiers.length === 0 && ticketType !== PURCHASE_FALLBACK_TIER) {
            throw new Error('This event does not have ticket tiers');
        }

        // A tier's own price is authoritative when one applies; event.ticketPrice is
        // the flat fallback for untiered events.
        const unitPrice = tier ? tier.price : event.ticketPrice;

        console.log('Purchase Request:', {
            eventId,
            ticketType: event.ticketType,
            ticketPrice: event.ticketPrice,
            isPaid: event.ticketType === 'paid',
            hasPrice: event.ticketPrice > 0,
            paymentId
        });

        // PRICE is the source of truth for whether payment is required.
        //
        // This used to also require `ticketType === 'paid'`, so an event with
        // ticketType 'free' but ticketPrice 999 (a real case: "Pending Approval
        // Concert") displayed ₹999 to the buyer, skipped this branch entirely
        // and issued a free ticket - giving away paid inventory.
        //
        // Keying off price alone fails closed: anything with a price above zero
        // must be paid for, whatever the type flag happens to say. The client
        // already decides what to display from `ticketPrice`, so this also
        // makes both sides agree.
        // unitPrice, not event.ticketPrice: on a tiered event the flat field is the
        // base price and says nothing about what a VIP ticket costs. Charging off it
        // sold every tier at the cheapest one's price.
        if (unitPrice > 0 && !paymentId) {
            // Charge the SAME total the buyer sees in the billing summary -
            // ticket price plus platform fee plus GST, minus any discount.
            // calculateBilling is the shared source of truth for both sides.
            const platformFeePercentage = event.platformFeePercentage ?? 5;

            // Re-validate the discount server-side (trust boundary): a
            // client-supplied amount is never trusted. validateAndApplyDiscount
            // throws for invalid/expired/exhausted codes, which propagates and
            // rejects the purchase before any charge (fail closed). No code =>
            // no discount.
            let discountAmount = 0;
            let appliedCode = null;
            let discountBearer = null;
            if (discountCode) {
                ({ discountAmount, discountBearer } = await discountService.validateAndApplyDiscount(
                    discountCode,
                    eventId,
                    unitPrice * quantity
                ));
                appliedCode = discountCode.toUpperCase();
            }

            const paymentResult = await requirePaymentFor(
                unitPrice,
                quantity,
                platformFeePercentage,
                discountAmount,
                {
                    userId,
                    referenceId: eventId,
                    referenceModel: 'Event',
                    discountCode: appliedCode,
                    discountBearer
                }
            );

            return {
                paymentRequired: true,
                paymentData: paymentResult
            };
        }

        // Atomically reserve the seats BEFORE creating the ticket. The check at
        // the top of this function is racy - two buyers can both read the same
        // currentAttendees, both pass, and both increment, overselling past
        // maxAttendees. This conditional update only succeeds while capacity
        // remains, so the last seat can be sold exactly once.
        // A tiered purchase must fit twice over: inside the event's overall capacity
        // AND inside that tier's own allocation. Both increments happen in one
        // conditional update so a tier cannot oversell, and so the two counters can
        // never disagree about the same sale.
        const reservation = tier
            ? {
                filter: {
                    _id: eventId,
                    'ticketTiers.name': ticketType,
                    $expr: { $lte: [{ $add: ['$currentAttendees', quantity] }, '$maxAttendees'] },
                    'ticketTiers.soldCount': { $lte: tier.maxQuantity - quantity }
                },
                update: { $inc: { currentAttendees: quantity, 'ticketTiers.$.soldCount': quantity } },
                soldOut: `"${ticketType}" is sold out`
            }
            : {
                filter: {
                    _id: eventId,
                    $expr: { $lte: [{ $add: ['$currentAttendees', quantity] }, '$maxAttendees'] }
                },
                update: { $inc: { currentAttendees: quantity } },
                soldOut: 'Not enough tickets available'
            };

        const reserved = await Event.findOneAndUpdate(reservation.filter, reservation.update, { new: true });
        if (!reserved) {
            throw new Error(reservation.soldOut);
        }

        // Generate ticket ID
        const ticketId = 'TKT-' + crypto.randomBytes(6).toString('hex').toUpperCase();

        // Generate QR Code content with all ticket data
        const qrData = JSON.stringify({
            ticketId,
            eventId,
            userId,
            quantity,
            ticketType,
            timestamp: Date.now()
        });

        // Seats are already reserved. If issuing the ticket fails, release them
        // so the reservation doesn't leak and shrink capacity permanently.
        let ticket;
        try {
            const qrCodeUrl = await QRCode.toDataURL(qrData);

            ticket = await Ticket.create({
                user: userId,
                event: eventId,
                ticketId,
                qrCode: qrCodeUrl, // Storing the Data URL directly
                ticketType,
                quantity,
                // The tier's price when one applies, so the ticket records what was
                // actually charged rather than the event's base price.
                price: roundMoney(unitPrice * quantity),
                payment: paymentId // Link to payment if exists
            });
        } catch (err) {
            // Release both counters the reservation took, or a failed issue would
            // permanently shrink the tier's allocation as well as the event's.
            await Event.findOneAndUpdate(
                tier ? { _id: eventId, 'ticketTiers.name': ticketType } : { _id: eventId },
                tier
                    ? { $inc: { currentAttendees: -quantity, 'ticketTiers.$.soldCount': -quantity } }
                    : { $inc: { currentAttendees: -quantity } }
            );
            throw err;
        }

        // Attendee count was already incremented atomically above during
        // seat reservation - don't double-count here.

        // Confirm the purchase in-app and on the buyer's devices. Best-effort -
        // a notification failure must never lose someone their ticket.
        const notificationService = require('./notificationService');
        notificationService.createNotification({
            userId,
            type: 'ticket_purchased',
            title: 'Ticket confirmed 🎟️',
            message: `You're going to ${event.name}. Your ticket ${ticketId} is ready.`,
            data: {
                referenceId: ticket._id,
                referenceModel: 'Ticket',
                actionUrl: '/dashboard/tickets',
                extra: { ticketId, eventId, eventName: event.name, quantity }
            },
            priority: 'high',
            channel: 'all'
        }).catch(err => console.error('ticket_purchased notification failed:', err.message));

        // Email the ticket itself - QR, ticket id and the tier they bought. Same
        // best-effort contract as the notification above: a dead SMTP box must
        // never lose someone their ticket, so this is never awaited.
        // The template reads event.venue.name, and `event` here was loaded without
        // populate, so name the venue before handing it over (events with a
        // customVenue have no venue to populate - the template handles that).
        const User = require('../models/User');
        const emailService = require('./emailService');
        User.findById(userId).select('name email').lean()
            .then(async buyer => {
                if (!buyer?.email) return;
                if (event.venue) await event.populate({ path: 'venue', select: 'name' });
                await emailService.sendTicketEmail(buyer.email, buyer.name, event, ticket);
            })
            .catch(err => console.error('ticket email failed:', err.message));

        // Let the organiser know a ticket moved.
        if (event.organizer && event.organizer.toString() !== userId.toString()) {
            notificationService.createNotification({
                userId: event.organizer,
                type: 'ticket_purchased',
                title: 'Ticket sold',
                message: `${quantity} ticket${quantity > 1 ? 's' : ''} just sold for ${event.name}.`,
                data: {
                    referenceId: eventId,
                    referenceModel: 'Event',
                    actionUrl: `/dashboard/events/${eventId}`,
                    extra: { ticketId, quantity }
                },
                priority: 'low',
                channel: 'all'
            }).catch(err => console.error('organiser ticket notification failed:', err.message));
        }

        return {
            success: true,
            ticket
        };
    },

    // Validate ticket (check-in) - enhanced with date and organizer validation
    async validateTicket(ticketId, qrCode) {
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
            throw new Error('Ticket not found');
        }

        if (ticket.isUsed) {
            throw new Error('Ticket already used');
        }

        // Mark as used
        ticket.isUsed = true;
        ticket.usedAt = new Date();
        ticket.status = 'used';
        await ticket.save();

        return { message: 'Ticket validated successfully', ticket };
    },

    // Scan ticket via QR code - for scanner UI
    async scanTicket({ qrData, scannerId, eventId }) {
        // Parse QR data
        let parsedQR;
        try {
            parsedQR = JSON.parse(qrData);
        } catch (e) {
            throw new Error('Invalid QR code format');
        }

        const { ticketId } = parsedQR;
        if (!ticketId) {
            throw new Error('Invalid ticket QR code');
        }

        // Find ticket by ticketId field (not _id)
        const ticket = await Ticket.findOne({ ticketId })
            .populate('user', 'name email phone')
            .populate({
                path: 'event',
                select: 'name date startTime endTime organizer'
            });

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        // Verify this ticket is for the correct event
        if (ticket.event._id.toString() !== eventId) {
            throw new Error('This ticket is for a different event');
        }

        // Check if ticket already used
        if (ticket.isUsed || ticket.status === 'used') {
            const usedTime = ticket.usedAt ? new Date(ticket.usedAt).toLocaleString() : 'Unknown';
            throw new Error(`Ticket already scanned at ${usedTime}`);
        }

        // Check if ticket is cancelled
        if (ticket.status === 'cancelled') {
            throw new Error('This ticket has been cancelled');
        }

        // Date validation - allow scanning on event day (within 24 hour window)
        const eventDate = new Date(ticket.event.date);
        const today = new Date();

        // Set both to start of day for comparison
        const eventDayStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const daysDiff = Math.abs((eventDayStart - todayStart) / (1000 * 60 * 60 * 24));

        if (daysDiff > 0) {
            const eventDateStr = eventDate.toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            });
            throw new Error(`This ticket is only valid on ${eventDateStr}`);
        }

        // Mark ticket as used
        ticket.isUsed = true;
        ticket.usedAt = new Date();
        ticket.status = 'used';
        ticket.checkedInBy = scannerId;
        await ticket.save();

        return {
            success: true,
            message: 'Check-in successful!',
            ticket: {
                ticketId: ticket.ticketId,
                ticketType: ticket.ticketType,
                quantity: ticket.quantity,
                user: ticket.user,
                scannedAt: ticket.usedAt
            }
        };
    },

    // Cancel ticket with refund processing
    async cancelTicket(ticketId, userId, reason = 'User requested cancellation') {
        const refundService = require('./refundService');
        
        // Use refund service for complete cancellation flow
        const result = await refundService.initiateTicketRefund(ticketId, userId, reason);
        
        return result;
    },

    // Check refund eligibility for a ticket
    async checkRefundEligibility(ticketId) {
        const refundService = require('./refundService');
        return await refundService.checkTicketRefundEligibility(ticketId);
    },

    // Tier-based ticket purchase with atomic soldCount increment.
    //
    // Paid tiers (tier.price > 0) route through the SAME requirePaymentFor
    // helper the flat path uses, returning { paymentRequired, paymentData }
    // BEFORE the atomic reservation - so no paid tier is obtainable for free and
    // both paths agree by construction. Free tiers (price 0) keep the original
    // reserve-and-return behaviour untouched. Optional { paymentId, discountCode }
    // keep the four existing positional callers working unchanged.
    async purchaseTicketByTier(eventId, tierName, quantity, userId, { paymentId = null, discountCode = null } = {}) {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        // Check if event is in the past or completed/cancelled (parity with the flat path)
        const now = new Date();
        const eventStart = new Date(event.startDateTime || event.date);
        if (eventStart < now) {
            throw new Error('Tickets cannot be purchased for past events');
        }
        if (event.status === 'completed' || event.status === 'cancelled') {
            throw new Error(`This event is ${event.status}. Tickets are no longer available.`);
        }

        // Gate payment for a priced tier before reserving inventory. Mirrors the
        // flat path: re-validate any discount server-side (never trust a client
        // amount - invalid/expired/exhausted propagates and rejects before any
        // charge), bill through the shared helper, and return the payment data
        // without committing the reservation. Returns null for free tiers /
        // already-paid calls so the caller falls through to reserve.
        const gatePayment = async (unitPrice) => {
            if (!(unitPrice > 0) || paymentId) return null;

            const feePct = event.platformFeePercentage ?? 5;
            let discountAmount = 0;
            let appliedCode = null;
            let discountBearer = null;
            if (discountCode) {
                ({ discountAmount, discountBearer } = await discountService.validateAndApplyDiscount(
                    discountCode,
                    eventId,
                    unitPrice * quantity
                ));
                appliedCode = discountCode.toUpperCase();
            }

            const paymentData = await requirePaymentFor(
                unitPrice,
                quantity,
                feePct,
                discountAmount,
                { userId, referenceId: eventId, referenceModel: 'Event', discountCode: appliedCode, discountBearer }
            );

            return { paymentRequired: true, paymentData };
        };

        // Backward compatibility: if no ticketTiers but has ticketPrice, treat as one "General" tier
        if (!event.ticketTiers || event.ticketTiers.length === 0) {
            if (event.ticketPrice != null) {
                // Synthesize a General tier from legacy fields
                const syntheticTier = {
                    name: 'General',
                    price: event.ticketPrice,
                    maxQuantity: event.maxAttendees,
                    soldCount: event.currentAttendees || 0
                };

                if (tierName !== 'General') {
                    throw new Error('Tier not found');
                }

                // Paid legacy tier: require payment before reserving.
                const gated = await gatePayment(syntheticTier.price);
                if (gated) return gated;

                // Use atomic update on currentAttendees for legacy events
                const updated = await Event.findOneAndUpdate(
                    {
                        _id: eventId,
                        currentAttendees: { $lte: event.maxAttendees - quantity }
                    },
                    { $inc: { currentAttendees: quantity } },
                    { new: true }
                );

                if (!updated) {
                    throw new Error(`Tier '${tierName}' is sold out`);
                }

                return { event: updated, tier: syntheticTier, quantity };
            }
            throw new Error('Tier not found');
        }

        // Find the tier by name
        const tier = event.ticketTiers.find(t => t.name === tierName);
        if (!tier) {
            throw new Error('Tier not found');
        }

        // Paid tier: require payment before committing the reservation.
        const gated = await gatePayment(tier.price);
        if (gated) return gated;

        // Atomic update: only succeeds if soldCount + quantity <= maxQuantity
        const updated = await Event.findOneAndUpdate(
            {
                _id: eventId,
                'ticketTiers.name': tierName,
                'ticketTiers.soldCount': { $lte: tier.maxQuantity - quantity }
            },
            { $inc: { 'ticketTiers.$.soldCount': quantity } },
            { new: true }
        );

        if (!updated) {
            throw new Error(`Tier '${tierName}' is sold out`);
        }

        const updatedTier = updated.ticketTiers.find(t => t.name === tierName);
        return { event: updated, tier: updatedTier, quantity };
    }
};

module.exports = ticketService;
