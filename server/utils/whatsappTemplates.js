// Meta WhatsApp template payload helpers
// Each helper returns the components section for a template message request

function bookingConfirmationTemplate({ userName, venueName, date, startTime, endTime, bookingId }) {
    return {
        name: 'booking_confirmation',
        language: { code: 'en' },
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: userName || 'there' },
                    { type: 'text', text: venueName || 'your venue' },
                    { type: 'text', text: date || 'date pending' },
                    { type: 'text', text: `${startTime || 'start'} - ${endTime || 'end'}` },
                    { type: 'text', text: bookingId || 'N/A' }
                ]
            }
        ]
    };
}

function bookingStatusTemplate({ userName, venueName, status, bookingId, note }) {
    return {
        name: 'booking_status_update',
        language: { code: 'en' },
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: userName || 'there' },
                    { type: 'text', text: venueName || 'your venue' },
                    { type: 'text', text: status || 'pending' },
                    { type: 'text', text: bookingId || 'N/A' },
                    { type: 'text', text: note || '—' }
                ]
            }
        ]
    };
}

function eventReminderTemplate({ userName, eventName, startDateTime, venueName }) {
    return {
        name: 'event_reminder',
        language: { code: 'en' },
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: userName || 'there' },
                    { type: 'text', text: eventName || 'your event' },
                    { type: 'text', text: startDateTime || 'soon' },
                    { type: 'text', text: venueName || 'the venue' }
                ]
            }
        ]
    };
}

// Approved template with no parameters (as configured in Meta)
function jaspers_market_plain_text_v1() {
    return {
        name: 'jaspers_market_plain_text_v1',
        language: { code: 'en_US' }
    };
}

// Use existing Meta template: appointment_confirmation_1
// Body: Hello {{1}}, Thank you for booking with {{2}}. Your appointment for {{3}} on {{4}} at {{5}} is confirmed.
function appointment_confirmation_1({ userName, businessName, venueName, date, time }) {
    return {
        name: 'appointment_confirmation_1',
        language: { code: 'en_US' },
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: userName || 'there' },
                    { type: 'text', text: businessName || 'Fira' },
                    { type: 'text', text: venueName || 'venue' },
                    { type: 'text', text: date || 'TBD' },
                    { type: 'text', text: time || 'TBD' }
                ]
            }
        ]
    };
}

// Use existing Meta template: event_details_reminder_1
// Body: Reminder: You RSVP'ed to {{1}} by {{2}}. The event starts on {{3}} at {{4}} at {{5}} location.
function event_details_reminder_1({ eventName, organizerName, date, time, location }) {
    return {
        name: 'event_details_reminder_1',
        language: { code: 'en_US' },
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: eventName || 'event' },
                    { type: 'text', text: organizerName || 'organizer' },
                    { type: 'text', text: date || 'TBD' },
                    { type: 'text', text: time || 'TBD' },
                    { type: 'text', text: location || 'venue' }
                ]
            }
        ]
    };
}

module.exports = {
    bookingConfirmationTemplate,
    bookingStatusTemplate,
    eventReminderTemplate,
    jaspers_market_plain_text_v1,
    appointment_confirmation_1,
    appointment_confirmation: appointment_confirmation_1, // alias
    event_details_reminder_1
};
