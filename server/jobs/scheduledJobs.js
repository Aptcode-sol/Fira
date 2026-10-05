/**
 * Scheduled Jobs for FIRA
 * Uses node-cron to run periodic tasks
 */

const cron = require('node-cron');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const { REMINDER_WINDOW_HOURS, BALANCE_DUE_HOURS_BEFORE } = require('../utils/paymentSchedule');
const { releaseBookingDays } = require('../utils/venueAvailability');

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Send daily balance-payment reminders for installment bookings whose 90% balance
 * is still pending and whose deadline has not yet passed (Req 7).
 *
 * Reminders only start once the event is within REMINDER_WINDOW_HOURS (7 days).
 * The deadline itself is 24h before the event, so the window is expressed on
 * balanceDueAt: due within (7 days − 24h) of now. A guest who books two months
 * out is not nagged daily for seven weeks.
 *
 * `lastReminderOn` ('YYYY-MM-DD', server local date) dedupes to at most one email +
 * one push per booking per calendar day (Req 7.1) and makes the job idempotent
 * within a day. Bookings past their deadline are skipped here and left for
 * enforceBalanceDeadlines (Req 7.3). Once balanceStatus leaves 'pending' the query
 * excludes the booking, so reminders stop automatically (Req 7.4, Property 5).
 *
 * ponytail: mirrors sendEventReminders — batch read, per-item email in try/catch,
 * exported for tests.
 */
async function sendBalanceReminders() {
    try {
        const now = new Date();
        // en-CA yields YYYY-MM-DD in server local time — stable string key for once-per-day dedupe.
        const today = now.toLocaleDateString('en-CA');
        const remindFrom = new Date(
            now.getTime() + (REMINDER_WINDOW_HOURS - BALANCE_DUE_HOURS_BEFORE) * 3600 * 1000
        );

        const bookings = await Booking.find({
            'paymentSchedule.type': 'installment',
            'paymentSchedule.balanceStatus': 'pending',
            paymentStatus: 'paid', // the deposit was actually paid - no balance chasing for an abandoned checkout
            // Req 7.3: skip past-deadline (left for enforcement); and not before the
            // event is 7 days out.
            'paymentSchedule.balanceDueAt': { $gt: now, $lte: remindFrom },
            'paymentSchedule.lastReminderOn': { $ne: today }    // Req 7.1: at most once per calendar day
        })
            .populate('user', 'name email')
            .populate('venue', 'name');

        if (bookings.length === 0) {
            return;
        }

        console.log(`💰 Sending balance reminders for ${bookings.length} booking(s)`);

        for (const booking of bookings) {
            const { balanceAmount, balanceDueAt } = booking.paymentSchedule;
            const daysLeft = Math.ceil((new Date(balanceDueAt) - now) / MS_PER_DAY); // whole days remaining (Req 7.2)

            // In-app + push (Req 7.1)
            await notificationService.createNotification({
                userId: booking.user._id,
                type: 'balance_due_reminder',
                title: 'Balance payment due',
                message: `Your remaining balance of ₹${balanceAmount} is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Pay now to keep your booking.`,
                data: {
                    referenceId: booking._id,
                    referenceModel: 'Booking',
                    actionUrl: `/venues/${booking.venue._id}`
                },
                priority: 'high',
                channel: 'all'
            });

            // Req 7.5: log and continue on email failure
            try {
                await emailService.sendBalanceReminderEmail(booking.user.email, booking.user.name, {
                    venueName: booking.venue.name,
                    daysLeft,
                    balanceAmount,
                    balanceDueAt,
                    bookingId: booking._id
                });
            } catch (e) {
                console.error(`  ❌ Failed to email balance reminder for booking ${booking._id}:`, e.message);
            }

            // Set after the attempt so a hard email failure doesn't suppress the whole batch (Req 7.5).
            await Booking.updateOne(
                { _id: booking._id },
                { $set: { 'paymentSchedule.lastReminderOn': today } }
            );
        }

        console.log('✅ Balance reminders job completed');
    } catch (error) {
        console.error('❌ Balance reminders job failed:', error.message);
    }
}

/**
 * Enforce balance-payment deadlines for installment bookings whose 90% balance is
 * still pending at or past its deadline: cancel the booking, forfeit the deposit,
 * release the venue's booked date, and notify the customer (Req 4 & 5).
 *
 * The claim and the state transition are ONE atomic findOneAndUpdate: the selector
 * requires balanceStatus 'pending', and the same $set clears it to 'forfeited'. So
 * a concurrent or subsequent run can never match the same doc — exactly one cancel
 * and one forfeit per booking (Req 5.2, Property 6). We .populate user+venue so the
 * (pre-update) returned doc carries the email/name/venue name for notification.
 *
 * ponytail: mirrors sendBalanceReminders/sendEventReminders — atomic claim loop,
 * side-effects in try/catch that never undo the cancel (Req 5.3), exported for tests.
 */
async function enforceBalanceDeadlines() {
    try {
        const now = new Date();

        while (true) {
            const claimed = await Booking.findOneAndUpdate(
                {
                    'paymentSchedule.type': 'installment',
                    'paymentSchedule.balanceStatus': 'pending',
                    'paymentSchedule.balanceDueAt': { $lte: now }
                },
                {
                    $set: {
                        status: 'cancelled',
                        'paymentSchedule.balanceStatus': 'forfeited',
                        cancellationReason: 'missed_payment_deadline' // Req 4.1; never touches cancellationPolicy (Req 4.3, Property 4)
                    }
                },
                { new: false } // pre-update doc; its 'pending' claim predicate is what we just cleared → no double-process (Property 6)
            )
                .populate('user', 'name email')
                .populate('venue', 'name');

            if (!claimed) break;

            // Req 4.4: release every day the booking held so others can book them.
            try {
                const venueId = claimed.venue?._id || claimed.venue;
                const venue = await Venue.findById(venueId);
                if (venue) {
                    releaseBookingDays(venue, claimed);
                    await venue.save();
                }
            } catch (e) {
                console.error(`  ❌ Failed to release venue date for booking ${claimed._id}:`, e.message);
            }

            // Req 4.5: notify the customer (in-app + push + email). Req 5.3: on
            // failure, log only — the cancellation/forfeiture is already committed
            // and must NOT be undone or retried.
            try {
                const depositAmount = claimed.paymentSchedule?.depositAmount;
                await notificationService.createNotification({
                    userId: claimed.user?._id || claimed.user,
                    type: 'booking_forfeited',
                    title: 'Booking cancelled — deposit forfeited',
                    message: `Your booking was cancelled and your ₹${depositAmount} deposit forfeited because the remaining balance was not paid by the deadline.`,
                    data: {
                        referenceId: claimed._id,
                        referenceModel: 'Booking',
                        actionUrl: '/dashboard/bookings'
                    },
                    priority: 'high',
                    channel: 'all'
                });

                await emailService.sendBalanceForfeitEmail(claimed.user?.email, claimed.user?.name, {
                    venueName: claimed.venue?.name,
                    depositAmount,
                    bookingId: claimed._id
                });
            } catch (e) {
                console.error(`  ❌ Failed to notify forfeiture for booking ${claimed._id}:`, e.message);
            }
        }

        console.log('✅ Balance deadline enforcement job completed');
    } catch (error) {
        console.error('❌ Balance deadline enforcement job failed:', error.message);
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

    // Daily balance-payment reminders at 09:00 server time
    cron.schedule('0 9 * * *', () => {
        console.log('🔄 Running balance reminders job...');
        sendBalanceReminders();
    });

    // Hourly balance-deadline enforcement at :05 of every hour. No on-boot run:
    // that would risk surprising cancellations right at deploy; the next tick is
    // at most an hour away, well within a deadline measured in days.
    cron.schedule('5 * * * *', () => {
        console.log('🔄 Running balance deadline enforcement job...');
        enforceBalanceDeadlines();
    });

    console.log('✅ Scheduled jobs initialized:');
    console.log('   - Event reminders: Every 10 minutes');
    console.log('   - Event lifecycle (ongoing/completed): Every 10 minutes + on boot');
    console.log('   - Balance reminders: Daily at 09:00');
    console.log('   - Balance deadline enforcement: Hourly at :05');
}

module.exports = {
    initScheduledJobs,
    sendEventReminders, // Export for manual testing
    sendBalanceReminders, // Export for manual testing
    enforceBalanceDeadlines, // Export for manual testing
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
