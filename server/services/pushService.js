const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

/**
 * Web Push delivery.
 *
 * Sending is always best-effort: a push that fails must never break the action
 * that triggered it (buying a ticket, following a creator). Every public method
 * here swallows its own errors and reports counts instead of throwing.
 */

let isConfigured = false;

function configure() {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.warn('⚠️  Web Push disabled: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set.');
        console.warn('   Generate them with: node server/scripts/generateVapidKeys.js');
        return false;
    }

    webpush.setVapidDetails(
        VAPID_SUBJECT || 'mailto:no-reply@letsfira.com',
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
    console.log('✅ Web Push configured');
    return true;
}

isConfigured = configure();

const pushService = {
    isEnabled() {
        return isConfigured;
    },

    getPublicKey() {
        return process.env.VAPID_PUBLIC_KEY || null;
    },

    /**
     * Register (or refresh) a browser subscription for a user.
     * Upsert on endpoint: the same browser re-subscribing must not create a
     * duplicate, and a device that changed hands should re-point to the new user.
     */
    async saveSubscription(userId, subscription, userAgent = null) {
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            throw new Error('Invalid push subscription payload');
        }

        return PushSubscription.findOneAndUpdate(
            { endpoint: subscription.endpoint },
            {
                $set: {
                    user: userId,
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.keys.p256dh,
                        auth: subscription.keys.auth
                    },
                    userAgent,
                    lastUsedAt: new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    },

    async removeSubscription(endpoint) {
        if (!endpoint) return { removed: 0 };
        const result = await PushSubscription.deleteOne({ endpoint });
        return { removed: result.deletedCount };
    },

    /** Drop every subscription for a user - used on logout-everywhere. */
    async removeAllForUser(userId) {
        const result = await PushSubscription.deleteMany({ user: userId });
        return { removed: result.deletedCount };
    },

    /**
     * Push to every device belonging to one user.
     *
     * `payload` is what the service worker receives, so keep it small - push
     * services cap the encrypted body (~4KB) and reject anything larger.
     */
    async sendToUser(userId, payload) {
        if (!isConfigured) return { sent: 0, failed: 0, skipped: true };

        const subscriptions = await PushSubscription.find({ user: userId }).lean();
        if (subscriptions.length === 0) return { sent: 0, failed: 0 };

        return this._dispatch(subscriptions, payload);
    },

    /** Push to many users at once (followers of a brand, attendees of an event). */
    async sendToUsers(userIds, payload) {
        if (!isConfigured || !userIds?.length) return { sent: 0, failed: 0, skipped: !isConfigured };

        const subscriptions = await PushSubscription.find({ user: { $in: userIds } }).lean();
        if (subscriptions.length === 0) return { sent: 0, failed: 0 };

        return this._dispatch(subscriptions, payload);
    },

    async _dispatch(subscriptions, payload) {
        const body = JSON.stringify({
            title: payload.title || 'FIRA',
            body: payload.body || '',
            url: payload.url || '/inbox',
            tag: payload.tag || undefined,
            icon: payload.icon || '/logo white.png',
            data: payload.data || {}
        });

        // Endpoints the push service told us are dead. Collected and deleted in
        // one go rather than N deletes interleaved with the sends.
        const expired = [];
        let sent = 0;
        let failed = 0;

        await Promise.all(subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: sub.keys },
                    body
                );
                sent++;
            } catch (error) {
                // 404/410 mean the subscription is permanently gone. Anything
                // else (network, 429, 500) is transient - keep the row.
                if (error.statusCode === 404 || error.statusCode === 410) {
                    expired.push(sub.endpoint);
                } else {
                    failed++;
                    console.error(`Push failed (${error.statusCode || 'no status'}):`, error.message);
                }
            }
        }));

        if (expired.length > 0) {
            await PushSubscription.deleteMany({ endpoint: { $in: expired } });
            console.log(`🧹 Pruned ${expired.length} expired push subscription(s)`);
        }

        return { sent, failed, expired: expired.length };
    }
};

module.exports = pushService;
