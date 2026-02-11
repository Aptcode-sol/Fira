const Event = require('../models/Event');
const PrivateEventAccess = require('../models/PrivateEventAccess');

const eventService = {
    // Get all events
    async getAllEvents(query = {}) {
        const { page = 1, limit = 10, eventType, status, category, organizer, sort, search, showCompleted, todayOnly, weekend, ticketType, dateFilter } = query;
        const filter = { isDeleted: { $ne: true } }; // Always exclude deleted events
        if (eventType) filter.eventType = eventType;
        if (category && category !== 'All') filter.category = category;

        // Ticket type filter (free/paid)
        if (ticketType === 'free') {
            filter.ticketType = 'free';
        } else if (ticketType === 'paid') {
            filter.ticketType = 'paid';
        }

        // If querying by organizer (dashboard), show their events excluding deleted
        // Otherwise, only show approved/upcoming and active events (public listing)
        if (organizer) {
            filter.organizer = organizer;
            if (status) filter.status = status;
            // By default, hide completed/past events in dashboard unless showCompleted=true
            if (showCompleted !== 'true' && showCompleted !== true) {
                filter.endDateTime = { $gte: new Date() }; // Only upcoming/ongoing events
            }
        } else {
            // Public listing - show only fully approved events that are in the future
            filter.status = 'approved';
            filter.isActive = { $ne: false };
            filter.startDateTime = { $gte: new Date() }; // Only future events
        }

        // Today Only filter (events within next 24 hours)
        if (todayOnly === 'true' || todayOnly === true) {
            const now = new Date();
            const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            filter.startDateTime = { $gte: now, $lte: in24Hours };
        }

        // Weekend filter (Friday 6PM to Sunday midnight)
        if (weekend === 'true' || weekend === true) {
            const now = new Date();
            const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
            
            // Calculate next Friday 6PM
            let fridayStart = new Date(now);
            const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
            if (daysUntilFriday === 0 && now.getHours() >= 18) {
                // It's Friday after 6PM, use today
            } else if (daysUntilFriday === 0) {
                // It's Friday before 6PM, use today at 6PM
            } else {
                fridayStart.setDate(now.getDate() + daysUntilFriday);
            }
            fridayStart.setHours(18, 0, 0, 0);

            // Calculate Sunday midnight (end of Sunday)
            let sundayEnd = new Date(fridayStart);
            sundayEnd.setDate(fridayStart.getDate() + (7 - fridayStart.getDay()) % 7); // Move to Sunday
            if (sundayEnd <= fridayStart) {
                sundayEnd.setDate(sundayEnd.getDate() + 7);
            }
            sundayEnd.setHours(23, 59, 59, 999);

            // If we're already past Sunday, get next weekend
            if (now > sundayEnd) {
                fridayStart.setDate(fridayStart.getDate() + 7);
                sundayEnd.setDate(sundayEnd.getDate() + 7);
            }

            filter.startDateTime = { $gte: fridayStart, $lte: sundayEnd };
        }

        // Date filter (today, tomorrow, thisWeek)
        if (dateFilter === 'today') {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            filter.startDateTime = { $gte: todayStart, $lte: todayEnd };
        } else if (dateFilter === 'tomorrow') {
            const tomorrowStart = new Date();
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);
            tomorrowStart.setHours(0, 0, 0, 0);
            const tomorrowEnd = new Date(tomorrowStart);
            tomorrowEnd.setHours(23, 59, 59, 999);
            filter.startDateTime = { $gte: tomorrowStart, $lte: tomorrowEnd };
        }

        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        // Sorting options
        let sortOption = { startDateTime: 1 }; // default: upcoming (earliest first)
        if (sort === 'upcoming') sortOption = { startDateTime: 1 };
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

    // Get upcoming events (public, approved/upcoming)
    async getUpcomingEvents(query = {}) {
        const { limit = 10, category } = query;
        const filter = {
            startDateTime: { $gte: new Date() },
            status: 'approved', // Only show fully approved events
            eventType: 'public',
            isActive: { $ne: false },
            isDeleted: { $ne: true }
        };
        if (category) filter.category = category;

        const events = await Event.find(filter)
            .populate('organizer', 'name verificationBadge')
            .populate('venue', 'name address')
            .limit(limit * 1)
            .sort({ startDateTime: 1 });

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
        // Check for time slot conflicts at the venue
        const { venue, startDateTime, endDateTime } = data;

        // Validate startDateTime is not in the past
        const now = new Date();
        const eventStart = new Date(startDateTime);
        const eventEnd = new Date(endDateTime);

        if (eventStart < now) {
            throw new Error('Event start date/time cannot be in the past');
        }

        // Validate end datetime is after start datetime
        if (eventEnd <= eventStart) {
            throw new Error('End date/time must be after start date/time');
        }

        if (venue && startDateTime && endDateTime) {
            // Find events at the same venue that overlap with this time range
            const conflictingEvents = await Event.find({
                venue: venue,
                status: { $nin: ['cancelled', 'rejected'] },
                // Check for any overlap: existing event overlaps if:
                // existingStart < newEnd AND existingEnd > newStart
                $and: [
                    { startDateTime: { $lt: eventEnd } },
                    { endDateTime: { $gt: eventStart } }
                ]
            });

            if (conflictingEvents.length > 0) {
                const conflict = conflictingEvents[0];
                const conflictStart = new Date(conflict.startDateTime).toLocaleString();
                const conflictEnd = new Date(conflict.endDateTime).toLocaleString();
                throw new Error(`Time slot conflict: This venue is already booked from ${conflictStart} to ${conflictEnd} for "${conflict.name}"`);
            }
        }

        // Auto-approve venue for personal (custom) venue events
        if (data.customVenue && (data.customVenue.isCustom === true || data.customVenue.isCustom === 'true')) {
            data.venueApproval = {
                status: 'approved',
                respondedAt: new Date(),
                respondedBy: 'system',
            };
            // Ensure admin approval stays pending (default), and no venue ID is required
        }

        const event = await Event.create(data);

        // Send email notification to venue owner (only for non-custom venues)
        if (venue && !data.customVenue?.isCustom) {
            const Venue = require('../models/Venue');
            const User = require('../models/User');
            const emailService = require('./emailService');

            // Fetch venue with owner details
            const venueWithOwner = await Venue.findById(venue).populate('owner', 'name email');
            const organizer = await User.findById(data.organizer).select('name email');

            console.log('🎫 Event created, notifying venue owner...');
            console.log('🏢 Venue:', venueWithOwner?.name);
            console.log('👤 Owner:', venueWithOwner?.owner?.name, venueWithOwner?.owner?.email);
            console.log('🎉 Organizer:', organizer?.name, organizer?.email);

            if (venueWithOwner?.owner?.email && organizer) {
                try {
                    await emailService.sendEventRequestEmail(
                        venueWithOwner.owner.email,
                        venueWithOwner.owner.name || 'Venue Owner',
                        { name: venueWithOwner.name },
                        {
                            name: event.name,
                            startDateTime: event.startDateTime,
                            endDateTime: event.endDateTime,
                            category: event.category,
                            maxAttendees: event.maxAttendees
                        },
                        {
                            name: organizer.name,
                            email: organizer.email
                        }
                    );
                    console.log('✅ Event request email sent to venue owner:', venueWithOwner.owner.email);
                } catch (emailErr) {
                    console.error('❌ Failed to send event request email:', emailErr.message);
                }
            } else {
                console.log('⚠️ Skipping email - venue owner or organizer not found');
            }
        }

        return event;
    },

    // Helper to convert time string to minutes
    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + (minutes || 0);
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

    // Delete event (soft delete)
    async deleteEvent(id) {
        const event = await Event.findByIdAndUpdate(
            id,
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date(),
                    isActive: false
                }
            },
            { new: true }
        );
        if (!event) {
            throw new Error('Event not found');
        }
        return { message: 'Event deleted successfully', event };
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
        event.cancelledAt = new Date();
        event.cancellationReason = reason;
        event.isDeleted = true;
        event.deletedAt = new Date();
        event.isActive = false;
        event.currentAttendees = 0;
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
    },

    // Venue owner approves/rejects event
    async venueApproveEvent(eventId, venueOwnerId, { status, rejectionReason }) {
        const Venue = require('../models/Venue');
        const Notification = require('../models/Notification');

        const event = await Event.findById(eventId).populate('venue');
        if (!event) {
            throw new Error('Event not found');
        }

        // Verify venue ownership
        if (event.venue.owner.toString() !== venueOwnerId) {
            throw new Error('You do not own this venue');
        }

        event.venueApproval = {
            status,
            respondedAt: new Date(),
            respondedBy: venueOwnerId,
            rejectionReason: status === 'rejected' ? rejectionReason : undefined
        };

        // If venue rejected, update event status
        if (status === 'rejected') {
            event.status = 'rejected';
        }
        // If both approved, set to approved
        else if (status === 'approved' && event.adminApproval?.status === 'approved') {
            event.status = 'approved';

            // Mark event dates as booked in venue daySlots
            await this.updateVenueAvailability(event);
        }

        await event.save();

        // Notify organizer
        await Notification.create({
            user: event.organizer,
            title: status === 'approved' ? 'Venue Approved Your Event' : 'Venue Rejected Your Event',
            message: status === 'approved'
                ? `The venue has approved your event "${event.name}". Waiting for admin approval.`
                : `The venue has rejected your event "${event.name}". Reason: ${rejectionReason || 'Not specified'}`,
            type: 'system',
            data: { referenceId: event._id, referenceModel: 'Event' }
        });

        return event;
    },

    // Admin approves/rejects event
    async adminApproveEvent(eventId, adminId, { status, rejectionReason }) {
        const Notification = require('../models/Notification');

        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        event.adminApproval = {
            status,
            respondedAt: new Date(),
            respondedBy: adminId,
            rejectionReason: status === 'rejected' ? rejectionReason : undefined
        };

        // If admin rejected, update event status
        if (status === 'rejected') {
            event.status = 'rejected';
        }
        // If admin approved, set to approved (backward compat: if venueApproval not set, consider it approved)
        else if (status === 'approved') {
            const venueApproved = !event.venueApproval || event.venueApproval.status === 'approved' || !event.venueApproval.status;
            if (venueApproved) {
                event.status = 'approved';

                // Mark event dates as booked in venue daySlots
                await this.updateVenueAvailability(event);
            }
        }

        await event.save();

        // Notify organizer
        await Notification.create({
            user: event.organizer,
            title: status === 'approved' ? 'Event Approved by Admin' : 'Event Rejected by Admin',
            message: status === 'approved'
                ? `Your event "${event.name}" has been approved and is now live!`
                : `Your event "${event.name}" was rejected by admin. Reason: ${rejectionReason || 'Not specified'}`,
            type: 'system',
            data: { referenceId: event._id, referenceModel: 'Event' }
        });

        // If event is approved, notify brand followers
        console.log(`🔍 Debug: Admin status=${status}, Event status=${event.status}, Organizer=${event.organizer}`);
        if (status === 'approved' && event.status === 'approved') {
            console.log('✅ Event fully approved, checking for brand profile...');
            try {
                const BrandProfile = require('../models/BrandProfile');
                const notificationService = require('./notificationService');

                // Check if organizer has a brand profile
                const brandProfile = await BrandProfile.findOne({ user: event.organizer });
                console.log(`🔍 Brand profile found: ${brandProfile ? brandProfile.name : 'NONE'}`);
                
                if (brandProfile) {
                    // Populate event with venue for email
                    const populatedEvent = await Event.findById(event._id).populate('venue', 'name address');
                    
                    const result = await notificationService.notifyBrandFollowers(
                        brandProfile._id,
                        'brand_new_event',
                        {
                            title: `${brandProfile.name} New Event`,
                            message: `${brandProfile.name} just announced "${populatedEvent.name}"! Get your tickets now.`,
                            referenceId: populatedEvent._id,
                            referenceModel: 'Event',
                            actionUrl: `/events/${populatedEvent._id}`,
                            extra: {
                                event: {
                                    _id: populatedEvent._id,
                                    name: populatedEvent.name,
                                    date: populatedEvent.startDateTime,
                                    startDateTime: populatedEvent.startDateTime,
                                    images: populatedEvent.images,
                                    ticketPrice: populatedEvent.ticketPrice,
                                    venue: populatedEvent.venue
                                }
                            }
                        },
                        true // send email
                    );
                    console.log(`✅ Notified ${brandProfile.name}'s followers about new event:`, result);
                } else {
                    console.log('⚠️ Organizer does not have a brand profile - no followers to notify');
                }
            } catch (notifErr) {
                console.error('Failed to notify brand followers:', notifErr.message);
            }
        } else {
            console.log(`⚠️ Event not fully approved: admin status=${status}, event.status=${event.status}`);
        }

        return event;
    },

    // Get events pending venue approval (for venue owners)
    async getVenueEventRequests(venueOwnerId, query = {}) {
        const Venue = require('../models/Venue');
        const { page = 1, limit = 10, status = 'pending' } = query;

        // Get venues owned by this user
        const venues = await Venue.find({ owner: venueOwnerId }).select('_id');
        const venueIds = venues.map(v => v._id);

        const filter = {
            venue: { $in: venueIds },
            'venueApproval.status': status
        };

        const events = await Event.find(filter)
            .populate('organizer', 'name email avatar verificationBadge')
            .populate('venue', 'name address images')
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

    // Get events pending admin approval
    async getPendingAdminApproval(query = {}) {
        const { page = 1, limit = 10, status = 'pending' } = query;

        // Show all events that need admin review
        // Events are pending if they're not already approved/cancelled/rejected
        const filter = {
            status: { $nin: ['approved', 'cancelled', 'rejected', 'blocked'] },
            $or: [
                { 'adminApproval.status': { $ne: 'approved' } },
                { 'adminApproval.status': { $exists: false } },
                { adminApproval: { $exists: false } }
            ]
        };

        const events = await Event.find(filter)
            .populate('organizer', 'name email avatar verificationBadge')
            .populate('venue', 'name address images owner')
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

    // Helper: Update venue availability when event is approved
    async updateVenueAvailability(event) {
        const Venue = require('../models/Venue');

        if (!event.venue) return;

        const venueId = event.venue._id || event.venue;
        const venue = await Venue.findById(venueId);
        if (!venue) return;

        // Ensure arrays exist to avoid runtime errors on older docs
        if (!Array.isArray(venue.daySlots)) venue.daySlots = [];
        if (!Array.isArray(venue.blockedDates)) venue.blockedDates = [];

        // Get all dates between event start and end using combined datetime fields
        const startDateTime = new Date(event.startDateTime);
        const endDateTime = new Date(event.endDateTime);

        // Extract date part for iteration
        const startDate = new Date(startDateTime);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(endDateTime);
        endDate.setHours(23, 59, 59, 999);

        const datesToBook = [];
        const currentDate = new Date(startDate);

        // Iterate through all days from start to end (inclusive)
        while (currentDate <= endDate) {
            datesToBook.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log(`[updateVenueAvailability] Event: ${event.name}, Dates to book:`, datesToBook.map(d => d.toISOString().split('T')[0]));

        // Helper to format time from Date object
        const formatTime = (dt) => {
            const hours = dt.getHours().toString().padStart(2, '0');
            const mins = dt.getMinutes().toString().padStart(2, '0');
            return `${hours}:${mins}`;
        };

        // Update or add daySlots for each event date
        const totalDays = datesToBook.length;
        for (let i = 0; i < totalDays; i++) {
            const date = datesToBook[i];
            const dateStr = date.toISOString().split('T')[0];
            const isFirstDay = i === 0;
            const isLastDay = i === totalDays - 1;
            const isSingleDay = totalDays === 1;

            // Determine the correct time slot for this day
            let slotStartTime, slotEndTime;

            if (isSingleDay) {
                // Single day event: use actual start and end times from datetime
                slotStartTime = formatTime(startDateTime);
                slotEndTime = formatTime(endDateTime);
            } else if (isFirstDay) {
                // First day: from event start time to end of day
                slotStartTime = formatTime(startDateTime);
                slotEndTime = '23:59';
            } else if (isLastDay) {
                // Last day: from start of day to event end time
                slotStartTime = '00:00';
                slotEndTime = formatTime(endDateTime);
            } else {
                // Middle days: full 24 hours
                slotStartTime = '00:00';
                slotEndTime = '23:59';
            }

            // Find existing slot for this date
            const existingSlotIndex = venue.daySlots.findIndex(slot => {
                const slotDate = new Date(slot.date).toISOString().split('T')[0];
                return slotDate === dateStr;
            });

            if (existingSlotIndex >= 0) {
                // Update existing slot
                venue.daySlots[existingSlotIndex].isAvailable = false;
                venue.daySlots[existingSlotIndex].isBooked = true;
                venue.daySlots[existingSlotIndex].bookedBy = event.organizer;
            } else {
                // Add new slot
                venue.daySlots.push({
                    date: date,
                    isAvailable: false,
                    isBooked: true,
                    bookedBy: event.organizer
                });
            }

            // Also add to blockedDates for backward compatibility
            const existingBlockedIndex = venue.blockedDates.findIndex(blocked => blocked.date === dateStr);
            const bookedSlot = {
                startTime: slotStartTime,
                endTime: slotEndTime,
                type: 'booked'
            };

            if (existingBlockedIndex === -1) {
                // Add new blockedDate entry
                venue.blockedDates.push({
                    date: dateStr,
                    slots: [bookedSlot]
                });
            } else {
                // Update existing entry - add booked slot if not already there
                const existingSlots = venue.blockedDates[existingBlockedIndex].slots;
                const hasBookedSlot = existingSlots.some(s =>
                    s.startTime === slotStartTime && s.endTime === slotEndTime && s.type === 'booked'
                );
                if (!hasBookedSlot) {
                    venue.blockedDates[existingBlockedIndex].slots.push(bookedSlot);
                }
            }

            console.log(`[updateVenueAvailability] Added blockedDate: ${dateStr} with slot ${slotStartTime}-${slotEndTime}`);
        }

        await venue.save();
    }
};

module.exports = eventService;
