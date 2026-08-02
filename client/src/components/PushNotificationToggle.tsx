'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/components/ui/Toast';

/**
 * Enable/disable browser push for this device.
 *
 * Deliberately per-device, and says so: a user who enabled push on their laptop
 * will see this off on their phone, and that is correct - subscriptions belong
 * to a browser install, not an account.
 */
export default function PushNotificationToggle({ className = '' }: { className?: string }) {
    const { isSupported, permission, isSubscribed, isBusy, error, subscribe, unsubscribe, sendTest } =
        usePushNotifications();
    const { showToast } = useToast();

    const handleToggle = async () => {
        if (isSubscribed) {
            const ok = await unsubscribe();
            if (ok) showToast('Push notifications turned off for this device', 'success');
            return;
        }

        const ok = await subscribe();
        if (ok) {
            showToast('Push notifications enabled', 'success');
            // Immediate proof it works, instead of asking the user to wait for
            // a real event to fire.
            await sendTest();
        }
    };

    if (!isSupported) {
        return (
            <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
                <p className="text-sm text-white font-medium mb-1">Push notifications</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                    This browser does not support push notifications. On iPhone or iPad, add FIRA to
                    your Home Screen first - Safari only allows notifications for installed apps.
                </p>
            </div>
        );
    }

    const isBlocked = permission === 'denied';

    return (
        <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm text-white font-medium mb-1">Push notifications</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        {isBlocked
                            ? 'Blocked. Allow notifications for this site in your browser settings, then reload.'
                            : isSubscribed
                                ? 'On for this device. You will get event reminders, booking updates and new follower alerts.'
                                : 'Get alerted an hour before your events, and when a booking or follow happens.'}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleToggle}
                    disabled={isBusy || isBlocked}
                    aria-pressed={isSubscribed}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isSubscribed ? 'bg-violet-500' : 'bg-white/10'
                        }`}
                >
                    <span
                        className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${isSubscribed ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

            {isSubscribed && !error && (
                <button
                    type="button"
                    onClick={async () => {
                        const ok = await sendTest();
                        if (ok) showToast('Test notification sent', 'success');
                    }}
                    className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                    Send a test notification
                </button>
            )}
        </div>
    );
}
