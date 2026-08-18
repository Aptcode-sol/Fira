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
        const upcomingEvents = await Event.find({
            startDateTime: {
                $gte: fiftyMinutesFromNow,
                $lte: oneHourFromNow
            },
            status: 'approved'
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
    });

    console.log('✅ Scheduled jobs initialized:');
    console.log('   - Event reminders: Every 10 minutes');
}

module.exports = {
    initScheduledJobs,
    sendEventReminders // Export for manual testing
};
