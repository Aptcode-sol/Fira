'use client';

import { useCallback, useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Web Push subscription lifecycle.
 *
 * Flow: register the service worker -> ask the browser for permission ->
 * subscribe with our VAPID public key -> hand the subscription to the server so
 * it can push to this device later.
 *
 * Platform notes that shape this code:
 *  - iOS Safari only allows Web Push when the site is installed to the home
 *    screen (16.4+). `isSupported` will be false in a normal iOS tab, so the UI
 *    needs to explain that rather than silently hiding the toggle.
 *  - Permission is per-origin and cannot be re-prompted once denied; the user
 *    has to change it in browser settings. Hence the distinct 'denied' state.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/** VAPID keys are base64url; PushManager wants a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

/**
 * Does an existing subscription use the VAPID key we are configured with?
 * If not it is stale and the server can never deliver to it.
 */
function keyMatches(subscription: PushSubscription, expected: Uint8Array): boolean {
    const actual = subscription.options?.applicationServerKey;
    if (!actual) return false;

    const bytes = new Uint8Array(actual as ArrayBuffer);
    if (bytes.length !== expected.length) return false;
    return bytes.every((byte, i) => byte === expected[i]);
}

export type PushPermission = 'default' | 'granted' | 'denied';

export function usePushNotifications() {
    const { isAuthenticated } = useAuth();
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<PushPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Detect support and read the current subscription state on mount.
    useEffect(() => {
        const supported =
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window;

        setIsSupported(supported);
        if (!supported) return;

        setPermission(Notification.permission as PushPermission);

        navigator.serviceWorker
            .getRegistration()
            .then(reg => reg?.pushManager.getSubscription())
            .then(sub => setIsSubscribed(Boolean(sub)))
            .catch(() => setIsSubscribed(false));
    }, []);

    const subscribe = useCallback(async () => {
        setError(null);

        if (!isSupported) {
            setError('This browser does not support push notifications.');
            return false;
        }
        if (!isAuthenticated) {
            setError('Sign in to enable notifications.');
            return false;
        }
        if (!VAPID_PUBLIC_KEY) {
            setError('Push is not configured. NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing.');
            return false;
        }

        setIsBusy(true);
        try {
            // Ask for permission FIRST, before any await.
            //
            // Mobile browsers (Chrome on Android especially) require
            // requestPermission() to run inside the user-gesture that started
            // the interaction. Awaiting the service worker registration first
            // spends that gesture, so the call was being rejected outright -
            // which is why the prompt appeared but enabling then failed.
            const result = await Notification.requestPermission();
            setPermission(result as PushPermission);

            if (result !== 'granted') {
                setError(
                    result === 'denied'
                        ? 'Notifications are blocked. Enable them for this site in your browser settings, then reload.'
                        : 'Permission was dismissed. Tap again to retry.'
                );
                return false;
            }

            await navigator.serviceWorker.register('/sw.js');
            // A freshly-registered worker may still be installing; pushManager
            // is only usable once one is active.
            const registration = await navigator.serviceWorker.ready;

            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

            // An existing subscription may have been created with a previous
            // VAPID key (or by a different deployment). Re-subscribing with a
            // different key throws, and keeping the stale one means the server
            // can never actually deliver to this device - so drop it.
            const existing = await registration.pushManager.getSubscription();
            let subscription = existing;

            if (existing && !keyMatches(existing, applicationServerKey)) {
                await existing.unsubscribe().catch(() => undefined);
                subscription = null;
            }

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey as BufferSource,
                });
            }

            await notificationsApi.subscribePush(subscription.toJSON());
            setIsSubscribed(true);
            return true;
        } catch (err) {
            const raw = err instanceof Error ? err.message : String(err);
            // Browser errors here are opaque ("Registration failed - push
            // service error"), so translate the common ones.
            let message = raw;
            if (/permission/i.test(raw)) {
                message = 'Notification permission was refused for this site.';
            } else if (/push service|AbortError|Registration failed/i.test(raw)) {
                message =
                    'Your browser could not reach its push service. This is usually a network or Google Play Services issue - try again on a different network.';
            } else if (/applicationServerKey|InvalidAccessError/i.test(raw)) {
                message = 'Push key mismatch. Turn notifications off and on again to re-register this device.';
            }
            setError(message);
            return false;
        } finally {
            setIsBusy(false);
        }
    }, [isSupported, isAuthenticated]);

    const unsubscribe = useCallback(async () => {
        setError(null);
        if (!isSupported) return false;

        setIsBusy(true);
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            const subscription = await registration?.pushManager.getSubscription();

            if (subscription) {
                // Tell the server first: if the browser unsubscribes but the
                // request fails, we would keep pushing to a dead endpoint until
                // it 410s.
                await notificationsApi.unsubscribePush(subscription.endpoint).catch(() => undefined);
                await subscription.unsubscribe();
            }

            setIsSubscribed(false);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not turn off notifications.');
            return false;
        } finally {
            setIsBusy(false);
        }
    }, [isSupported]);

    const sendTest = useCallback(async () => {
        setError(null);
        try {
            await notificationsApi.sendTestPush();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send a test notification.');
            return false;
        }
    }, []);

    return {
        isSupported,
        permission,
        isSubscribed,
        isBusy,
        error,
        subscribe,
        unsubscribe,
        sendTest,
    };
}
