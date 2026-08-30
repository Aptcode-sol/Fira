/**
 * Scheduled Jobs for FIRA
 * Uses node-cron to run periodic tasks
 */

const cron = require('node-cron');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');

/**
 * Event statuses that mean "live and not yet started/finished". `approved` is what
 * the approval flow sets; `upcoming` is an equally valid schema value used by the
 * seeds. Both jobs below key off this one list so they cannot disagree.
 */
const LIVE_EVENT_STATUSES = ['approved', 'upcoming'];

/**
 * Send event reminders 1 hour before events start
 * Runs every 10 minutes
 *
 * ponytail: Batch-fetches all tickets for all upcoming events in a single query
 * (eliminates N+1 per-event ticket lookup). Notifications are still created
 * individually because Mongoose doesn't return per-doc errors from insertMany
 * with ordered:false in a useful way, but the heavy DB reads are O(1) not O(N).
 */
async function sendEventReminders() {
    try {
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const fiftyMinutesFromNow = new Date(now.getTime() + 50 * 60 * 1000);

        // Find events starting within 50-70 minutes (1 hour ± 10 minutes)
        // 'approved' is what the approval flow sets, but 'upcoming' is an equally
        // valid live status (the seeds use it) - matching only 'approved' silently
        // skipped reminders for those events.
        const upcomingEvents = await Event.find({
            startDateTime: {
                $gte: fiftyMinutesFromNow,
                $lte: oneHourFromNow
            },
            status: { $in: LIVE_EVENT_STATUSES }
        }).populate('venue', 'name address');

        if (upcomingEvents.length === 0) {
            return;
        }

        const eventIds = upcomingEvents.map(e => e._id);
        const eventMap = new Map(upcomingEvents.map(e => [e._id.toString(), e]));

        console.log(`📅 Found ${upcomingEvents.length} events starting in ~1 hour`);

        // Single query for ALL tickets across all upcoming events (eliminates N+1)
        const tickets = await Ticket.find({
            event: { $in: eventIds },
            status: 'active',
            reminderSent: { $ne: true }
        }).populate('user', 'name email');

        if (tickets.length === 0) {
            console.log('✅ No pending reminders to send');
            return;
        }

        console.log(`  📧 Sending ${tickets.length} reminders across ${upcomingEvents.length} events`);

        // Bulk-create notifications
        const notifications = tickets.map(ticket => ({
            user: ticket.user._id,
            type: 'event_reminder_1h',
            title: 'Event Starting Soon!',
            message: `${eventMap.get(ticket.event.toString()).name} starts in 1 hour! Don't forget your ticket.`,
            data: {
                referenceId: ticket.event,
                referenceModel: 'Event',
                actionUrl: `/events/${ticket.event}`,
                extra: { ticketId: ticket.ticketId }
            },
            priority: 'high',
            channel: 'all'
        }));

        await Notification.insertMany(notifications, { ordered: false }).catch(err => {
            // Log but don't abort — some may have succeeded
            console.error('  ⚠️ Some notifications failed to insert:', err.message);
        });

        // Send emails (IO-bound, can't avoid per-ticket, but DB reads are done)
        for (const ticket of tickets) {
            const event = eventMap.get(ticket.event.toString());
            try {
                await emailService.sendEventReminderEmail(
                    ticket.user.email,
                    ticket.user.name,
                    event,
                    ticket
                );
            } catch (err) {
                console.error(`  ❌ Failed to email reminder for ticket ${ticket.ticketId}:`, err.message);
            }
        }

        // Bulk-mark all tickets as reminded (single query)
        const ticketIds = tickets.map(t => t._id);
        await Ticket.updateMany(
            { _id: { $in: ticketIds } },
            { $set: { reminderSent: true } }
        );

        console.log('✅ Event reminders job completed');
    } catch (error) {
        console.error('❌ Event reminders job failed:', error.message);
    }
}

/**
 * Initialize all scheduled jobs
 */
function initScheduledJobs() {
    console.log('⏰ Initializing scheduled jobs...');

    // Run event reminders every 10 minutes
    cron.schedule('*/10 * * * *', () => {
        console.log('🔄 Running event reminders job...');
        sendEventReminders();
        syncEventLifecycle();
    });

    // Once on boot as well: without this, every event that ended while the process
    // was down (or before this job existed) stays mislabelled until the next tick.
    syncEventLifecycle();

    console.log('✅ Scheduled jobs initialized:');
    console.log('   - Event reminders: Every 10 minutes');
    console.log('   - Event lifecycle (ongoing/completed): Every 10 minutes + on boot');
}

module.exports = {
    initScheduledJobs,
    sendEventReminders, // Export for manual testing
    syncEventLifecycle,
    // Exported so the filters can be checked without a database.
    LIVE_EVENT_STATUSES,
    completedEventFilter,
    ongoingEventFilter,
};

/**
 * Move events through their time-based lifecycle: ongoing while they are running,
 * completed once they have ended.
 *
 * Nothing in the app ever wrote these two statuses. Approval set `approved` and it
 * stayed `approved` forever, so the admin dashboard's Ongoing and Completed filters
 * matched zero documents no matter how many events had finished, and
 * `ticketService`'s "this event is completed" guard could never fire. The fix
 * belongs here rather than in the admin query: every consumer of Event.status was
 * reading a value that was never maintained.
 *
 * Only time-driven states are touched. cancelled / rejected / blocked / draft /
 * pending are terminal or manual decisions and are left alone.
 */
/** Events that have ended and are still labelled as live. */
function completedEventFilter(now) {
    return {
        status: { $in: [...LIVE_EVENT_STATUSES, 'ongoing'] },
        endDateTime: { $lte: now },
        isDeleted: { $ne: true },
    };
}

/** Events that have started but not yet ended. */
function ongoingEventFilter(now) {
    return {
        status: { $in: LIVE_EVENT_STATUSES },
        startDateTime: { $lte: now },
        endDateTime: { $gt: now },
        isDeleted: { $ne: true },
    };
}

async function syncEventLifecycle() {
    try {
        const now = new Date();

        // Ended first, so an event that both started and ended since the last run
        // lands on its final state in one pass.
        const completed = await Event.updateMany(
            completedEventFilter(now),
            { $set: { status: 'completed' } }
        );

        const ongoing = await Event.updateMany(
            ongoingEventFilter(now),
            { $set: { status: 'ongoing' } }
        );

        if (completed.modifiedCount || ongoing.modifiedCount) {
            console.log(`🗓️  Event lifecycle: ${ongoing.modifiedCount} → ongoing, ${completed.modifiedCount} → completed`);
        }
        return { ongoing: ongoing.modifiedCount, completed: completed.modifiedCount };
    } catch (error) {
        console.error('❌ Event lifecycle job failed:', error.message);
        return { ongoing: 0, completed: 0 };
    }
}
