const axios = require('axios');

const META_PHONE_ID = process.env.META_WHATSAPP_PHONE_ID;
const META_TOKEN = process.env.META_WHATSAPP_TOKEN;
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';

if (!META_PHONE_ID || !META_TOKEN) {
    console.warn('⚠️ META WhatsApp env missing: META_WHATSAPP_PHONE_ID and/or META_WHATSAPP_TOKEN');
}

const client = axios.create({
    baseURL: `https://graph.facebook.com/${META_API_VERSION}`,
    headers: {
        Authorization: `Bearer ${META_TOKEN}`,
        'Content-Type': 'application/json'
    },
    timeout: 10000
});

function formatPhone(number) {
    if (!number) return null;
    // Basic E.164 enforcement; assumes numbers already include country code.
    const raw = number.toString().trim();
    if (raw.startsWith('+')) {
        return `+${raw.replace(/[^\d]/g, '')}`; // keep leading +, strip other non-digits
    }
    const digits = raw.replace(/\D/g, '');
    return digits ? `+${digits}` : null;
}

async function sendMessage(payload) {
    if (!META_PHONE_ID || !META_TOKEN) {
        throw new Error('Missing META WhatsApp credentials');
    }

    try {
        const { data } = await client.post(`/${META_PHONE_ID}/messages`, payload);
        console.log('✅ WhatsApp message sent', data.messages?.[0]?.id || 'no-id');
        return data;
    } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data || err.message;
        console.error('❌ WhatsApp send failed', status, msg);
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
}

async function sendText({ to, text }) {
    const toNumber = formatPhone(to);
    if (!toNumber) throw new Error('Recipient phone is required');

    return sendMessage({
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'text',
        text: { body: text }
    });
}

async function sendTemplate({ to, template }) {
    const toNumber = formatPhone(to);
    if (!toNumber) throw new Error('Recipient phone is required');
    if (!template?.name) throw new Error('Template name is required');

    return sendMessage({
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'template',
        template
    });
}

module.exports = {
    sendText,
    sendTemplate,
    formatPhone
};
