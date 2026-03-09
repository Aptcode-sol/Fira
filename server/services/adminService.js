const User = require('../models/User');
const Venue = require('../models/Venue');
const Event = require('../models/Event');
const BrandProfile = require('../models/BrandProfile');
const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');

const adminService = {
    // ================== DASHBOARD STATS ==================
    async getStats() {
        const [
            totalUsers,
            totalVenues,
            totalEvents,
            totalBrands,
            pendingVenues,
            pendingEvents,
            pendingBrands,
            blockedUsers,
            totalTickets,
            revenueData
        ] = await Promise.all([
            User.countDocuments(),
            Venue.countDocuments(),
            Event.countDocuments(),
            BrandProfile.countDocuments(),
            Venue.countDocuments({ status: 'pending' }),
            Event.countDocuments({ status: 'pending' }),
            BrandProfile.countDocuments({ status: 'pending' }),
            User.countDocuments({ isBlocked: true }),
            Ticket.countDocuments(),
            Ticket.aggregate([
                { $group: { _id: null, totalRevenue: { $sum: '$price' } } }
            ])
        ]);

        return {
            totalUsers,
            totalVenues,
            totalEvents,
            totalBrands,
            pendingVenues,
            pendingEvents,
            pendingBrands,
            blockedUsers,
            totalTickets,
            totalRevenue: revenueData[0]?.totalRevenue || 0
        };
    },

    // ================== USERS ==================
    async getAllUsers(query = {}) {
        const { page = 1, limit = 20, search, role, status } = query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') }
            ];
        }
        if (role && role !== 'all') filter.role = role;
        if (status === 'blocked') filter.isBlocked = true;
        if (status === 'active') filter.isBlocked = { $ne: true };

        const users = await User.find(filter)
            .select('-password')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(filter);

        return {
            users,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    async getUserById(id) {
        const user = await User.findById(id).select('-password');
        if (!user) throw new Error('User not found');

        const tickets = await Ticket.find({ user: id }).populate('event', 'name date venue');
        const bookings = await Booking.find({ user: id }).populate('venue', 'name address');

        return {
            ...user.toObject(),
            tickets,
            bookings,
            stats: {
                totalTickets: tickets.length,
                totalBookings: bookings.length,
                totalSpent: tickets.reduce((sum, t) => sum + (t.price || 0), 0) + bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
            }
        };
    },

    async blockUser(userId) {
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { isBlocked: true } },
            { new: true }
        ).select('-password');
        if (!user) throw new Error('User not found');
        return user;
    },

    async unblockUser(userId) {
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { isBlocked: false } },
            { new: true }
        ).select('-password');
        if (!user) throw new Error('User not found');
        return user;
    },

    // ================== VENUES ==================
    async getVenues(query = {}) {
        const { page = 1, limit = 20, search, status } = query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { 'address.city': new RegExp(search, 'i') }
            ];
        }
        if (status && status !== 'all') filter.status = status;

        const venues = await Venue.find(filter)
            .populate('owner', 'name email')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Venue.countDocuments(filter);

        return {
            venues,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    async getVenueById(id) {
        const venue = await Venue.findById(id).populate('owner', 'name email phone');
        if (!venue) throw new Error('Venue not found');

        // Get booking stats
        const bookings = await Booking.find({ venue: id });
        const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        return {
            ...venue.toObject(),
            stats: {
                totalBookings: bookings.length,
                totalRevenue,
                completedBookings: bookings.filter(b => b.status === 'completed').length
            }
        };
    },

    async updateVenueStatus(venueId, status) {
        const venue = await Venue.findByIdAndUpdate(
            venueId,
            { $set: { status } },
            { new: true }
        );
        if (!venue) throw new Error('Venue not found');
        return venue;
    },

    // ================== EVENTS ==================
    async getEvents(query = {}) {
        const { page = 1, limit = 20, search, status, eventType } = query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') }
            ];
        }
        if (status && status !== 'all') filter.status = status;
        if (eventType && (eventType === 'public' || eventType === 'private')) {
            filter.eventType = eventType;
        }

        const events = await Event.find(filter)
            .populate('organizer', 'name email')
            .populate('venue', 'name address')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Event.countDocuments(filter);

        return {
            events,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    async getEventById(id) {
        const event = await Event.findById(id)
            .populate('organizer', 'name email phone')
            .populate('venue', 'name address');
        if (!event) throw new Error('Event not found');

        // Get ticket stats
        const tickets = await Ticket.find({ event: id }).populate('user', 'name email phone');
        const totalRevenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
        const ticketsSold = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);

        return {
            ...event.toObject(),
            tickets,
            stats: {
                ticketsSold,
                totalRevenue,
                totalBookings: tickets.length
            }
        };
    },

    async updateEventStatus(eventId, status) {
        const event = await Event.findByIdAndUpdate(
            eventId,
            { $set: { status } },
            { new: true }
        );
        if (!event) throw new Error('Event not found');
        return event;
    },

    // ================== BRANDS ==================
    async getBrands(query = {}) {
        const { page = 1, limit = 20, search, status } = query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') }
            ];
        }
        if (status && status !== 'all') filter.status = status;

        const brands = await BrandProfile.find(filter)
            .populate('user', 'name email')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await BrandProfile.countDocuments(filter);

        return {
            brands,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    async getBrandById(id) {
        const brand = await BrandProfile.findById(id).populate('user', 'name email phone');
        if (!brand) throw new Error('Brand not found');

        // Get events hosted by this brand's user
        const events = await Event.find({ organizer: brand.user._id })
            .populate('venue', 'name')
            .sort({ date: -1 })
            .limit(10);

        // Get revenue from events
        const eventIds = events.map(e => e._id);
        const ticketRevenue = await Ticket.aggregate([
            { $match: { event: { $in: eventIds } } },
            { $group: { _id: null, total: { $sum: '$price' } } }
        ]);

        return {
            ...brand.toObject(),
            events,
            stats: {
                eventsHosted: events.length,
                totalRevenue: ticketRevenue[0]?.total || 0
            }
        };
    },

    async updateBrandStatus(brandId, status) {
        const brand = await BrandProfile.findByIdAndUpdate(
            brandId,
            { $set: { status } },
            { new: true }
        );
        if (!brand) throw new Error('Brand not found');
        return brand;
    }
};

module.exports = adminService;
