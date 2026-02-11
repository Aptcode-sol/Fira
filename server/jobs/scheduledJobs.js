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

        console.log(`📅 Found ${upcomingEvents.length} events starting in ~1 hour`);

        for (const event of upcomingEvents) {
            // Find active tickets for this event that haven't had reminders sent
            const tickets = await Ticket.find({
                event: event._id,
                status: 'active',
                reminderSent: { $ne: true }
            }).populate('user', 'name email');

            if (tickets.length === 0) continue;

            console.log(`  📧 Sending ${tickets.length} reminders for "${event.name}"`);

            for (const ticket of tickets) {
                try {
                    // Create in-app notification
                    await Notification.create({
                        user: ticket.user._id,
                        type: 'event_reminder_1h',
                        title: 'Event Starting Soon!',
                        message: `${event.name} starts in 1 hour! Don't forget your ticket.`,
                        data: {
                            referenceId: event._id,
                            referenceModel: 'Event',
                            actionUrl: `/events/${event._id}`,
                            extra: { ticketId: ticket.ticketId }
                        },
                        priority: 'high',
                        channel: 'all'
                    });

                    // Send email reminder
                    await emailService.sendEventReminderEmail(
                        ticket.user.email,
                        ticket.user.name,
                        event,
                        ticket
                    );

                    // Mark reminder as sent
                    await Ticket.findByIdAndUpdate(ticket._id, { reminderSent: true });
                } catch (err) {
                    console.error(`  ❌ Failed to send reminder for ticket ${ticket.ticketId}:`, err.message);
                }
            }
        }

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
