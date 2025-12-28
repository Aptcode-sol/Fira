const Event = require('../models/Event');
const PrivateEventAccess = require('../models/PrivateEventAccess');

const eventService = {
    // Get all events
    async getAllEvents(query = {}) {
        const { page = 1, limit = 10, eventType, status, category, organizer, sort, search } = query;
        const filter = {};
        if (eventType) filter.eventType = eventType;
        if (status) filter.status = status;
        if (category && category !== 'All') filter.category = category;
        if (organizer) filter.organizer = organizer;
        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        // Sorting options
        let sortOption = { date: 1 }; // default: upcoming (earliest first)
        if (sort === 'upcoming') sortOption = { date: 1 };
        else if (sort === 'top') sortOption = { 'stats.attendees': -1, 'stats.interested': -1 };
        else if (sort === 'latest') sortOption = { createdAt: -1 };

        const events = await Event.find(filter)
            .populate('organizer', 'name email verificationBadge')
            .populate('venue', 'name address images')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort(sortOption);

        const total = await Event.countDocuments(filter);

        return {
            events,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    // Get upcoming events
    async getUpcomingEvents(query = {}) {
        const { limit = 10, category } = query;
        const filter = {
            date: { $gte: new Date() },
            status: 'upcoming',
            eventType: 'public'
        };
        if (category) filter.category = category;

        const events = await Event.find(filter)
            .populate('organizer', 'name verificationBadge')
            .populate('venue', 'name address')
            .limit(limit * 1)
            .sort({ date: 1 });

        return events;
    },

    // Get event by ID
    async getEventById(id) {
        const event = await Event.findById(id)
            .populate('organizer', 'name email avatar verificationBadge')
            .populate('venue', 'name description address images capacity');
        if (!event) {
            throw new Error('Event not found');
        }
        return event;
    },

    // Create event
    async createEvent(data) {
        const event = await Event.create(data);
        return event;
    },

    // Update event
    async updateEvent(id, updateData) {
        const event = await Event.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );
        if (!event) {
            throw new Error('Event not found');
        }
        return event;
    },

    // Delete event
    async deleteEvent(id) {
        const event = await Event.findByIdAndDelete(id);
        if (!event) {
            throw new Error('Event not found');
        }
        return { message: 'Event deleted successfully' };
    },

    // Cancel event with automatic refunds
    async cancelEvent(id, reason = 'Event cancelled by organizer') {
        const refundService = require('./refundService');
        const notificationService = require('./notificationService');
        
        const event = await Event.findById(id);
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.status === 'cancelled') {
            throw new Error('Event is already cancelled');
        }

        // Update event status
        event.status = 'cancelled';
        await event.save();

        // Process refunds for all ticket holders
        let refundResults = null;
        try {
            refundResults = await refundService.initiateEventCancellationRefunds(id, reason);
            console.log(`✅ Event cancellation refunds: ${refundResults.successCount}/${refundResults.totalRefunds} processed`);
        } catch (error) {
            console.error('❌ Error processing event cancellation refunds:', error.message);
        }

        return {
            event,
            refundResults
        };
    },

    // Request private event access
    async requestPrivateAccess(eventId, { userId, accessCode, message }) {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }
        if (event.eventType !== 'private') {
            throw new Error('This is not a private event');
        }
        if (event.privateCode !== accessCode) {
            throw new Error('Invalid access code');
        }

        const request = await PrivateEventAccess.create({
            user: userId,
            event: eventId,
            accessCode,
            requestMessage: message
        });

        return request;
    },

    // Get events by organizer (User ID)
    async getEventsByOrganizer(userId, limit = 10) {
        const events = await Event.find({ organizer: userId, status: { $ne: 'cancelled' } })
            .populate('venue', 'name address images')
            .sort({ date: 1 }) // Upcoming first
            .limit(parseInt(limit));
        return events;
    },

    // Handle access request
    async handleAccessRequest(requestId, status) {
        const request = await PrivateEventAccess.findByIdAndUpdate(
            requestId,
            {
                $set: {
                    status,
                    respondedAt: new Date()
                }
            },
            { new: true }
        );
        if (!request) {
            throw new Error('Access request not found');
        }
        return request;
    }
};

module.exports = eventService;
