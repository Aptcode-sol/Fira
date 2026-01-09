const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const templates = require('../utils/whatsappTemplates');

// Webhook verification
router.get('/webhook', (req, res) => {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ WhatsApp webhook verified');
        return res.status(200).send(challenge);
    }

    console.warn('❌ WhatsApp webhook verification failed');
    return res.sendStatus(403);
});

// Webhook receiver
router.post('/webhook', (req, res) => {
    try {
        const entry = req.body?.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (value?.statuses) {
            console.log('📡 WA status event:', JSON.stringify(value.statuses, null, 2));
        }

        if (value?.messages) {
            console.log('📨 WA inbound message:', JSON.stringify(value.messages, null, 2));
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('❌ WhatsApp webhook processing failed', err.message);
        res.sendStatus(500);
    }
});

// Simple health/send test endpoint (optional)
router.post('/send-test', async (req, res) => {
    const { to, text } = req.body;
    try {
        const response = await whatsappService.sendText({ to, text: text || 'Hello from FIRA' });
        res.json(response);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Send a template message (helper for testing)
router.post('/send-template', async (req, res) => {
    const { to, templateName, variables = {} } = req.body;
    try {
        if (!templates[templateName]) {
            return res.status(400).json({ error: 'Unknown template name' });
        }

        const template = templates[templateName](variables);
        const response = await whatsappService.sendTemplate({ to, template });
        res.json(response);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
