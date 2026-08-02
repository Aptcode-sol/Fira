/* eslint-disable no-undef */
/**
 * FIRA service worker - Web Push only.
 *
 * Deliberately does NOT cache anything. Adding offline caching here would let a
 * stale build serve indefinitely, which is a much worse bug than not having
 * offline support. Keep this file about notifications.
 *
 * Served from /sw.js so its scope is the whole origin.
 */

// Take over immediately rather than waiting for every old tab to close -
// otherwise a user who just granted permission keeps the previous worker.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        // A push with a non-JSON body still deserves to be shown.
        payload = { title: 'FIRA', body: event.data ? event.data.text() : '' };
    }

    const title = payload.title || 'FIRA';
    const options = {
        body: payload.body || '',
        icon: payload.icon || '/logo white.png',
        badge: '/logo white.png',
        // `tag` collapses repeats of the same subject into one notification
        // instead of stacking five reminders for the same event.
        tag: payload.tag || undefined,
        renotify: Boolean(payload.tag),
        data: { url: payload.url || '/inbox', ...(payload.data || {}) },
        vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/inbox';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus an existing tab if one is already open, rather than piling
            // up a new tab every time a notification is tapped.
            for (const client of clientList) {
                if ('focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
            return undefined;
        })
    );
});
