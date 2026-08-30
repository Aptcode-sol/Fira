'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { eventsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import CreateEventModal, { type EventDraft } from './CreateEventModal';

/** Event name that opens the event creation modal from anywhere. */
export const OPEN_CREATE_EVENT = 'open-create-event';

/** Event name that opens the same modal on an existing event. */
export const OPEN_EDIT_EVENT = 'open-edit-event';

/** Call from any "Create event" button. */
export function openCreateEvent() {
    window.dispatchEvent(new CustomEvent(OPEN_CREATE_EVENT));
}

/** Call from any "Edit event" button. */
export function openEditEvent(eventId: string) {
    window.dispatchEvent(new CustomEvent(OPEN_EDIT_EVENT, { detail: { eventId } }));
}

/**
 * Mounts the event form once, app-wide, opened by a window event - blank to create,
 * prefilled to edit.
 *
 * Mirrors CreateVenueLauncher so the two flows behave identically: opened in place
 * from wherever you are, and dismissed back to that same place.
 */
export default function CreateEventLauncher() {
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [event, setEvent] = useState<EventDraft | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const openForEdit = useCallback(async (eventId: string) => {
        setIsLoading(true);
        try {
            // Fetched here rather than passed in: the pages linking to an edit hold
            // trimmed event shapes, and a half-populated form silently blanks the
            // fields it did not receive on save.
            const fetched = await eventsApi.getById(eventId) as EventDraft;
            setEvent(fetched);
            setIsOpen(true);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not load that event', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        const onCreate = () => { setEvent(null); setIsOpen(true); };
        const onEdit = (e: Event) => {
            const { eventId } = (e as CustomEvent<{ eventId: string }>).detail ?? {};
            if (eventId) openForEdit(eventId);
        };
        window.addEventListener(OPEN_CREATE_EVENT, onCreate);
        window.addEventListener(OPEN_EDIT_EVENT, onEdit);
        return () => {
            window.removeEventListener(OPEN_CREATE_EVENT, onCreate);
            window.removeEventListener(OPEN_EDIT_EVENT, onEdit);
        };
    }, [openForEdit]);

    // Anyone signed in can create an event (unlike venues, which need ownership).
    // The server checks ownership on an update.
    if (!isAuthenticated) return null;

    return (
        <>
            {/* The fetch is a round trip on a tap, so it needs to be visible or the
                Edit button looks like it did nothing. */}
            {isLoading && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            )}
            <CreateEventModal
                // Remounts between events so no draft survives from the last one.
                key={event?._id ?? 'new'}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                event={event}
            />
        </>
    );
}
