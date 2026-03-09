const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const paymentService = require('./paymentService'); // Import payment service
const QRCode = require('qrcode');
const crypto = require('crypto');

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
                select: 'name date startTime images venue',
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
    async purchaseTicket({ userId, eventId, quantity = 1, ticketType = 'general', paymentId = null }) {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.currentAttendees + quantity > event.maxAttendees) {
            throw new Error('Not enough tickets available');
        }

        console.log('Purchase Request:', {
            eventId,
            ticketType: event.ticketType,
            ticketPrice: event.ticketPrice,
            isPaid: event.ticketType === 'paid',
            hasPrice: event.ticketPrice > 0,
            paymentId
        });

        // If paid event and no payment flow yet, initiate payment
        if (event.ticketType === 'paid' && event.ticketPrice > 0 && !paymentId) {
            const totalPrice = event.ticketPrice * quantity;

            // Initiate payment
            const paymentResult = await paymentService.initiatePayment({
                userId,
                type: 'ticket',
                referenceId: eventId,
                referenceModel: 'Event',
                amount: totalPrice
            });

            return {
                paymentRequired: true,
                paymentData: paymentResult
            };
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

        // Generate QR Code Image (Data URL)
        const qrCodeUrl = await QRCode.toDataURL(qrData);

        // Create ticket
        const ticket = await Ticket.create({
            user: userId,
            event: eventId,
            ticketId,
            qrCode: qrCodeUrl, // Storing the Data URL directly
            ticketType,
            quantity,
            price: event.ticketPrice * quantity,
            payment: paymentId // Link to payment if exists
        });

        // Update event attendee count
        await Event.findByIdAndUpdate(eventId, {
            $inc: { currentAttendees: quantity }
        });

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
    }
};

module.exports = ticketService;
