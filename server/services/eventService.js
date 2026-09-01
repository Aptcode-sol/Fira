const Event = require('../models/Event');
const PrivateEventAccess = require('../models/PrivateEventAccess');
const ScanningCode = require('../models/ScanningCode');
const Ticket = require('../models/Ticket');
const { PURCHASE_FALLBACK_TIER } = require('./ticketTiers');
const { citySlug } = require('../utils/citySlug');
const crypto = require('crypto');
const { escapeRegex } = require('../utils/escapeRegex');

/**
 * Statuses a public listing will show. `approved` is what the approval flow
 * actually sets, but `upcoming` and `ongoing` are valid values in the schema
 * enum - matching only `approved` meant anything moved to one of those was
 * silently invisible with no indication why.
 */
const PUBLICLY_VISIBLE_STATUSES = ['approved', 'upcoming', 'ongoing'];

const eventService = {
    // Get all events
    async getAllEvents(query = {}) {
        const { page = 1, limit = 10, eventType, status, category, organizer, sort, search, city, showCompleted, todayOnly, weekend, ticketType, dateFilter } = query;
        const filter = { isDeleted: { $ne: true } }; // Always exclude deleted events
        if (eventType) filter.eventType = eventType;
        if (category && category !== 'All') filter.category = category;

        // Conditions that each need their own $or are collected here and combined
        // with $and at the end. Assigning filter.$or directly (as city and search
        // both used to) means whichever runs second silently discards the first.
        const andConditions = [];

        if (city && city !== 'All') {
            const Venue = require('../models/Venue');
            // Slug match, so "Bengaluru" and "Bangalore" find the same events and
            // the caller's string never reaches a regex engine.
            const slug = citySlug(city);
            const venuesInCity = await Venue.find({ 'address.citySlug': slug }).select('_id');
            // An event is in a city either because its listed venue is there, or
            // because it carries its own custom venue with the city on the event.
            // Matching on venue id alone dropped every custom-venue event (they
            // have venue: null) whenever a city was applied - and a city is applied
            // automatically on first load, so those events were never visible at
            // all.
            andConditions.push({
                $or: [
                    { venue: { $in: venuesInCity.map(v => v._id) } },
                    { 'customVenue.citySlug': slug }
                ]
            });
        }

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
            // Public listing - show only fully approved events that have not ended.
            // Gate on endDateTime (not startDateTime) so an event that has started
            // but already finished isn't listed, and exclude completed events
            // explicitly (approved is required, completed is never listed).
            filter.status = { $in: PUBLICLY_VISIBLE_STATUSES };
            filter.isActive = { $ne: false };
            filter.endDateTime = { $gte: new Date() }; // Not yet ended (upcoming or ongoing)
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
            const searchRegex = new RegExp(escapeRegex(search), 'i');
            andConditions.push({
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
            });
        }

        if (andConditions.length > 0) filter.$and = andConditions;

        // Sorting options
        let sortOption = { startDateTime: 1 }; // default: upcoming (earliest first)
        if (sort === 'upcoming') sortOption = { startDateTime: 1 };
        // `top` sorted on stats.attendees / stats.interested, neither of which
        // exists on the Event schema - so "Popular" silently fell back to Mongo's
        // natural order. currentAttendees is the real counter.
        else if (sort === 'top') sortOption = { currentAttendees: -1, createdAt: -1 };
        else if (sort === 'latest') sortOption = { createdAt: -1 };

        // Featured events lead every public listing, whatever the secondary sort.
        // A promoted event is worth surfacing above the chronological/popular order,
        // but only on the public list - the organizer's own dashboard should stay in
        // plain date order so they can find a specific event. Object key order is the
        // tiebreak order Mongo applies, so isFeatured first means "featured, then the
        // chosen sort within each group".
        if (!organizer) {
            sortOption = { isFeatured: -1, ...sortOption };
        }

        const events = await Event.find(filter)
            .populate('organizer', 'name email avatar verificationBadge')
            .populate('venue', 'name address images')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort(sortOption)
            .lean();

        await eventService.attachOrganizerBrands(events);

        const total = await Event.countDocuments(filter);

        return {
            events,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    /**
     * Attach each organizer's approved brand identity to a list of lean events.
     *
     * An event run under a brand should carry the brand's name and photo, not the
     * personal account behind it - that is the identity the audience follows and the
     * one on the poster. The organizer object is still returned untouched, so
     * anything that needs the real account (admin queues, payouts, ownership checks)
     * is unaffected; this only adds `organizerBrand` for presentation.
     *
     * Only `status: 'approved'` brands qualify. A pending applicant billing their
     * events under an unreviewed brand name is the same self-verification hole that
     * was just closed on the badge.
     *
     * ponytail: one batched query for the whole page rather than a lookup per event.
     * Ceiling: it is a second round trip. If event listings ever need to filter or
     * sort by brand, this becomes a $lookup in the aggregation instead.
     */
    async attachOrganizerBrands(events) {
        const list = Array.isArray(events) ? events : [events];
        const organizerId = e => String(e?.organizer?._id || e?.organizer || '');

        const ids = [...new Set(list.map(organizerId).filter(Boolean))];
        if (!ids.length) return events;

        const BrandProfile = require('../models/BrandProfile');
        const brands = await BrandProfile.find({ user: { $in: ids }, status: 'approved' })
            .select('user name type profilePhoto')
            .lean();

        const byUser = new Map(brands.map(b => [String(b.user), b]));
        for (const event of list) {
            const brand = byUser.get(organizerId(event));
            if (!brand) continue;
            event.organizerBrand = {
                _id: brand._id,
                name: brand.name,
                type: brand.type,
                profilePhoto: brand.profilePhoto || null,
            };
        }

        return events;
    },

    // Get upcoming events (public, approved/upcoming)
    async getUpcomingEvents(query = {}) {
        const { limit = 10, category } = query;
        const filter = {
            startDateTime: { $gte: new Date() },
            // Same visibility rule as getAllEvents - kept on the shared constant so
            // the two listings cannot disagree about what counts as live.
            status: { $in: PUBLICLY_VISIBLE_STATUSES },
            eventType: 'public',
            isActive: { $ne: false },
            isDeleted: { $ne: true }
        };
        if (category) filter.category = category;

        const events = await Event.find(filter)
            .populate('organizer', 'name avatar verificationBadge')
            .populate('venue', 'name address')
            .limit(limit * 1)
            .sort({ startDateTime: 1 })
            .lean();

        await eventService.attachOrganizerBrands(events);

        return events;
    },

    // Get event by ID.
    // viewerId (optional): the id of the authenticated viewer, if any. A private
    // event is only resolvable by link for a NON-owner viewer once it is admin-
    // approved; the organizer viewing their own private event always sees it.
    // Fail closed: an anonymous / non-owner viewer of an unapproved private event
    // gets "Event not found" rather than a leaked draft.
    async getEventById(id, viewerId = null) {
        const event = await Event.findById(id)
            .populate('organizer', 'name email avatar verificationBadge')
            .populate('venue', 'name description address images capacity')
            .lean();
        if (!event) {
            throw new Error('Event not found');
        }

        if (event.eventType === 'private' && event.adminApproval?.status !== 'approved') {
            const organizerId = (event.organizer?._id || event.organizer)?.toString();
            const isOwner = viewerId && organizerId && organizerId === viewerId.toString();
            if (!isOwner) {
                throw new Error('Event not found');
            }
        }

        await eventService.attachOrganizerBrands(event);

        return event;
    },

    // Create event
    async createEvent(data) {
        // Check for time slot conflicts at the venue
        let { venue, startDateTime, endDateTime } = data;
        
        // Handle empty string venue (from frontend) to avoid ObjectId cast errors
        if (venue === '') {
            venue = null;
            data.venue = null;
        }

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

        // --- NEW: Auto-approval for Tagged Organizers ---
        try {
            const User = require('../models/User');
            const organizerUser = await User.findById(data.organizer);
            
            if (organizerUser && (organizerUser.isVerified === true || (organizerUser.verificationBadge && organizerUser.verificationBadge !== 'none'))) {
                console.log(`🚀 Fast Track: Auto-approving admin part for tagged organizer: ${organizerUser.name} (${organizerUser.verificationBadge})`);
                
                data.adminApproval = {
                    status: 'approved',
                    respondedAt: new Date(),
                    respondedBy: 'system'
                };

                // If venue is ALSO approved (like for custom venues), mark entire event as approved
                if (data.venueApproval && data.venueApproval.status === 'approved') {
                    data.status = 'approved';
                }
            }
        } catch (err) {
            console.error('Error during auto-approval check:', err.message);
            // Don't fail the create process, just default to manual approval
        }
        // ----------------------------------------------

        // Trust boundary: payoutAccount arrives from the client, so verify it is one
        // of this organizer's own saved accounts. Anything else becomes null, which
        // the payout path reads as "use my default".
        const { sanitizePayoutAccount } = require('../utils/payoutAccount');
        data.payoutAccount = await sanitizePayoutAccount(data.organizer, data.payoutAccount);

        const event = await Event.create(data);

        // If fully approved, update venue availability
        if (event.status === 'approved') {
            await this.updateVenueAvailability(event);
            const booking = await this.createBookingForEvent(event);
            if (booking) {
                event.booking = booking._id;
                await event.save();
            }
        }

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
        const event = await Event.findById(id);
        if (!event) {
            throw new Error('Event not found');
        }

        // Check if date/time is being changed and tickets are already sold
        if (updateData.startDateTime || updateData.endDateTime) {
            const currentStart = event.startDateTime ? event.startDateTime.toISOString() : null;
            const newStart = updateData.startDateTime ? new Date(updateData.startDateTime).toISOString() : null;
            
            const currentEnd = event.endDateTime ? event.endDateTime.toISOString() : null;
            const newEnd = updateData.endDateTime ? new Date(updateData.endDateTime).toISOString() : null;
            
            if ((newStart && currentStart !== newStart) || (newEnd && currentEnd !== newEnd)) {
                if (event.currentAttendees > 0) {
                    throw new Error('Cannot change event date or time after tickets have been sold. Please contact support.');
                }
            }
        }

        // Same trust boundary as createEvent: the id arrives through a
        // .passthrough() schema, so an update can carry a payout account belonging to
        // someone else. Checked against this organizer's own saved accounts.
        if ('payoutAccount' in updateData) {
            const { sanitizePayoutAccount } = require('../utils/payoutAccount');
            updateData = {
                ...updateData,
                payoutAccount: await sanitizePayoutAccount(event.organizer, updateData.payoutAccount),
            };
        }

        const updatedEvent = await Event.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );
        return updatedEvent;
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
            // startDateTime, not `date`: the schema has no `date` path, so this sort
            // was a no-op and the list came back in Mongo's natural order.
            .sort({ startDateTime: 1 })
            .limit(parseInt(limit))
            .lean();
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

            // Create booking automatically
            const booking = await this.createBookingForEvent(event);
            if (booking) {
                event.booking = booking._id;
            }
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

                // Create booking automatically
                const booking = await this.createBookingForEvent(event);
                if (booking) {
                    event.booking = booking._id;
                }
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
            .sort({ createdAt: -1 })
            .lean();

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
        // Exclude venue-less events so they aren't counted/listed as pending (8.1).
        const filter = {
            venue: { $exists: true, $ne: null },
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
            .sort({ createdAt: -1 })
            .lean();

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
    },

    // Generate a 12-character alphanumeric code using crypto
    generateAccessCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const bytes = crypto.randomBytes(12);
        let code = '';
        for (let i = 0; i < 12; i++) {
            code += chars[bytes[i] % chars.length];
        }
        return code;
    },

    /**
     * Create scanning codes for an event (max 20 total per event).
     *
     * `entries` accepts either plain label strings (the original shape) or
     * `{ label, ticketTier }` objects. A ticketTier scopes the resulting scanner to
     * one tier, so a door handed the VIP link cannot admit a general ticket - which
     * is the only thing that made separate links mean anything. An empty tier keeps
     * the old behaviour: admits every tier for this event.
     */
    async createScanningCodes(eventId, entries = [], organizerId) {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }
        if (event.organizer.toString() !== organizerId.toString()) {
            throw new Error('Only the event organizer can create scanning codes');
        }

        // Normalise both accepted shapes into one. `allTiers` marks the intentional
        // combined link (empty tier, but kept through the unscoped-link sweep).
        const requested = (entries.length ? entries : ['']).map(entry =>
            typeof entry === 'string'
                ? { label: entry, ticketTier: '', allTiers: false }
                : { label: entry?.label || '', ticketTier: entry?.ticketTier || '', allTiers: entry?.allTiers === true }
        );

        // A tier that does not exist on the event would produce a scanner that
        // rejects every ticket - a door that silently admits nobody is worse than
        // an error at creation time.
        const tierNames = (event.ticketTiers || []).map(t => t.name);
        for (const { ticketTier } of requested) {
            if (ticketTier && !tierNames.includes(ticketTier)) {
                throw new Error(`"${ticketTier}" is not a ticket tier on this event`);
            }
        }

        const existingCount = await ScanningCode.countDocuments({ event: eventId });
        if (existingCount + requested.length > 20) {
            throw new Error(`Cannot exceed 20 scanning codes per event. Currently ${existingCount} exist, requested ${requested.length}.`);
        }

        const codes = [];
        for (const { label, ticketTier, allTiers } of requested) {
            let code;
            let attempts = 0;
            // Ensure uniqueness — retry if collision (extremely unlikely with 12 chars)
            while (attempts < 5) {
                code = this.generateAccessCode();
                const exists = await ScanningCode.findOne({ code });
                if (!exists) break;
                attempts++;
            }
            if (attempts >= 5) {
                throw new Error('Failed to generate unique code');
            }

            const scanningCode = await ScanningCode.create({
                event: eventId,
                code,
                // Default the label to the tier, or name the combined link so it is
                // never unnamed in the list.
                label: label || ticketTier || (allTiers ? 'All Tiers' : ''),
                ticketTier,
                allTiers,
                createdBy: organizerId
            });
            codes.push(scanningCode);
        }

        return codes;
    },

    /**
     * Pull the human ticket reference out of whatever the scanner sent.
     *
     * A ticket QR encodes a JSON payload, so the raw decoded text is the whole
     * object, not an id. Manual entry at the door sends the bare `TKT-...` string.
     * Both are accepted; anything else returns null.
     *
     * Only `ticketId` is taken from the payload. The tier and event it also carries
     * are the buyer's own printable copy and are never trusted here - a QR is
     * client-supplied data, so it could claim any tier. Everything the gate decides
     * on is re-read from the ticket record below.
     */
    parseScannedTicket(scanned) {
        if (typeof scanned !== 'string') return null;
        const raw = scanned.trim();
        if (!raw) return null;
        if (raw.startsWith('{')) {
            try {
                const parsed = JSON.parse(raw);
                return typeof parsed?.ticketId === 'string' ? parsed.ticketId.trim() : null;
            } catch {
                return null;
            }
        }
        return raw;
    },

    /**
     * Make sure every ticket tier on this event has a live scanner link, then return
     * all of the event's codes.
     *
     * Provisioned on read rather than behind a "Generate" button: a tier always needs
     * a door, so making the organiser ask for one was a step with no decision in it.
     * Tiers added by a later edit get their link the next time this is read, and
     * events with no tiers get a single all-tiers link.
     *
     * Idempotent - a tier with an active code is left alone. A tier whose only code
     * was deactivated is re-provisioned, which is what revoking a leaked link should
     * do: the old one stays dead and on the record, a fresh one takes its place.
     */
    async listScanningCodes(eventId, organizerId) {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }
        if (event.organizer.toString() !== organizerId.toString()) {
            throw new Error('Only the event organizer can view scanning codes');
        }

        const tierNames = (event.ticketTiers || []).map(t => t.name).filter(Boolean);

        /*
         * Retire STRAY unscoped links - ones with an empty tier that are NOT the
         * intentional combined link (allTiers !== true).
         *
         * A stray unscoped link exists only because it was generated before tier
         * scoping, and left live it is a way round the per-tier links. The one
         * combined link the organiser is meant to have carries allTiers:true and is
         * excluded here, so this sweep no longer kills it.
         *
         * `$ne: true` covers both false and the absent field on legacy documents.
         */
        await ScanningCode.updateMany(
            { event: eventId, isActive: true, ticketTier: { $in: ['', null] }, allTiers: { $ne: true } },
            { $set: { isActive: false } }
        );

        const existing = await ScanningCode.find({ event: eventId });
        const activeTiers = new Set(existing.filter(c => c.isActive && !c.allTiers).map(c => c.ticketTier));
        const hasActiveCombined = existing.some(c => c.isActive && c.allTiers);

        /*
         * Every event gets one combined "All Tiers" link PLUS a link per tier.
         *
         * The combined link admits any tier (ticketTier ''), for a single door that
         * lets everyone in; the per-tier links scope entry to one tier each. The
         * organiser chooses which to hand out. A tier is compulsory at creation now,
         * so tierNames is non-empty for new events; older tier-less events fall back
         * to PURCHASE_FALLBACK_TIER, the name their tickets were actually issued under.
         */
        const wantedTiers = tierNames.length > 0 ? tierNames : [PURCHASE_FALLBACK_TIER];

        const toCreate = [];
        if (!hasActiveCombined) {
            toCreate.push({ label: 'All Tiers', ticketTier: '', allTiers: true });
        }
        for (const name of wantedTiers) {
            if (!activeTiers.has(name)) {
                toCreate.push({ label: name, ticketTier: name, allTiers: false });
            }
        }

        if (toCreate.length > 0 && existing.length + toCreate.length <= 20) {
            await this.createScanningCodes(eventId, toCreate, organizerId);
        }

        return ScanningCode.find({ event: eventId }).sort({ createdAt: -1 });
    },

    // Validate an access code and check in a ticket
    async validateScanAndCheckIn(accessCode, scannedValue) {
        const scanningCode = await ScanningCode.findOne({ code: accessCode });
        if (!scanningCode) {
            throw new Error('Access code is invalid');
        }
        if (!scanningCode.isActive) {
            throw new Error('Access code has been deactivated');
        }

        const ticketRef = this.parseScannedTicket(scannedValue);
        if (!ticketRef) {
            throw new Error('Unreadable ticket code');
        }

        // findOne on the ticketId field, not findById. The scanner sends the
        // 'TKT-...' reference printed on the ticket, which is not the document _id -
        // findById could only ever throw a cast error on it, so no real ticket QR
        // could be checked in at all.
        const ticket = await Ticket.findOne({ ticketId: ticketRef }).populate('user', 'name email');
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        if (ticket.event.toString() !== scanningCode.event.toString()) {
            throw new Error('Ticket belongs to a different event');
        }
        // A tier-scoped scanner admits only its own tier. Named in the message so the
        // person on the door knows where to send the guest instead of just "no".
        if (scanningCode.ticketTier && ticket.ticketType !== scanningCode.ticketTier) {
            throw new Error(`This scanner only admits "${scanningCode.ticketTier}" tickets. This one is "${ticket.ticketType}".`);
        }
        /*
         * An unscoped link on an event that has tiers is refused outright.
         *
         * Retiring these when the organiser views the list is not enough on its own:
         * a link already sitting in someone's browser would keep working until then,
         * and it bypasses every per-tier restriction. Checked against the event as it
         * is now, so an event that gains its first tier closes the hole immediately.
         */
        if (!scanningCode.ticketTier) {
            const event = await Event.findById(scanningCode.event).select('ticketTiers');
            if ((event?.ticketTiers || []).length > 0) {
                throw new Error('This scanner link is out of date. Ask the organiser for the link for this tier.');
            }
        }
        if (ticket.status === 'cancelled') {
            throw new Error('This ticket has been cancelled');
        }
        if (ticket.isUsed) {
            const when = ticket.usedAt ? new Date(ticket.usedAt).toLocaleString('en-IN') : 'earlier';
            throw new Error(`Ticket has already been used (${when})`);
        }

        ticket.isUsed = true;
        ticket.usedAt = new Date();
        ticket.checkedInBy = accessCode;
        ticket.status = 'used';
        await ticket.save();

        return ticket;
    },

    // Deactivate a scanning code (organizer only)
    async deactivateScanningCode(codeId, organizerId) {
        const scanningCode = await ScanningCode.findById(codeId);
        if (!scanningCode) {
            throw new Error('Scanning code not found');
        }
        if (scanningCode.createdBy.toString() !== organizerId.toString()) {
            throw new Error('Only the code creator can deactivate this code');
        }

        scanningCode.isActive = false;
        await scanningCode.save();
        return scanningCode;
    },

    // Helper: Create booking automatically when event is approved
    async createBookingForEvent(event) {
        const Booking = require('../models/Booking');
        const Venue = require('../models/Venue');

        if (!event.venue) return null;

        const venueId = event.venue._id || event.venue;
        const venue = await Venue.findById(venueId);

        // Check if a booking already exists for this event
        const existingBooking = await Booking.findOne({ event: event._id });
        if (existingBooking) {
            console.log(`[createBookingForEvent] Booking already exists for event ${event._id}`);
            return existingBooking;
        }

        // Calculate hours/days and pricing
        const start = new Date(event.startDateTime);
        const end = new Date(event.endDateTime);
        const durationHours = Math.ceil((end - start) / (1000 * 60 * 60)) || 1;

        let totalAmount = 0;
        if (venue) {
            const basePrice = venue.pricing?.basePrice || 0;
            const pricePerHour = venue.pricing?.pricePerHour || 0;
            totalAmount = pricePerHour > 0 ? (pricePerHour * durationHours) : basePrice;
        }

        // Helper to format time
        const formatTime = (dt) => {
            const hours = dt.getHours().toString().padStart(2, '0');
            const mins = dt.getMinutes().toString().padStart(2, '0');
            return `${hours}:${mins}`;
        };

        const bookingData = {
            user: event.organizer,
            venue: venueId,
            event: event._id,
            bookingType: 'event',
            bookingDate: start,
            startTime: formatTime(start),
            endTime: formatTime(end),
            purpose: event.description || `Event: ${event.name}`,
            expectedGuests: event.maxAttendees || 0,
            status: 'accepted',
            totalAmount: totalAmount,
            paymentStatus: 'pending'
        };

        const booking = await Booking.create(bookingData);
        console.log(`[createBookingForEvent] Created booking ${booking._id} for event ${event._id}`);
        return booking;
    }
};

module.exports = eventService;
