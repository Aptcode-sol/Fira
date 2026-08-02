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
            const registration = await navigator.serviceWorker.register('/sw.js');
            // A freshly-registered worker may still be installing; pushManager
            // is only usable once it is active.
            await navigator.serviceWorker.ready;

            const result = await Notification.requestPermission();
            setPermission(result as PushPermission);

            if (result !== 'granted') {
                setError(
                    result === 'denied'
                        ? 'Notifications are blocked. Enable them for this site in your browser settings.'
                        : 'Permission was dismissed.'
                );
                return false;
            }

            // Reuse an existing subscription if the browser already has one -
            // re-subscribing with a different key throws.
            const existing = await registration.pushManager.getSubscription();
            const subscription =
                existing ??
                (await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
                }));

            await notificationsApi.subscribePush(subscription.toJSON());
            setIsSubscribed(true);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not enable notifications.';
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
