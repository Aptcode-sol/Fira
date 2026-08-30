'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isVenueOwner } from '@/lib/types';
import { venuesApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import CreateVenueModal, { type VenueDraft } from './CreateVenueModal';

/** Opens the venue form blank, to list a new venue. */
export const OPEN_CREATE_VENUE = 'open-create-venue';
/** Opens the same form prefilled with an existing venue. detail: { venueId } */
export const OPEN_EDIT_VENUE = 'open-edit-venue';

/** Call from any "Add venue" button. */
export function openCreateVenue() {
    window.dispatchEvent(new CustomEvent(OPEN_CREATE_VENUE));
}

/** Call from any "Edit venue" button. */
export function openEditVenue(venueId: string) {
    window.dispatchEvent(new CustomEvent(OPEN_EDIT_VENUE, { detail: { venueId } }));
}

/**
 * Mounts the venue form once, app-wide, and opens it on a window event - blank for
 * a new listing, prefilled for an edit.
 *
 * Create and edit are the same modal on purpose. There were three venue forms
 * before (the create route, an edit route, and an inline edit mode on the detail
 * page) and they had already drifted: the edit ones still wrote the removed
 * basePrice/pricePerHour fields and a min-guests input. One form means a field added
 * for creating is automatically editable.
 *
 * ponytail: window events are already this codebase's cross-component signal
 * (`toggle-dashboard-sidebar`, `brand-post-created`), so no new context is needed.
 */
export default function CreateVenueLauncher() {
    const { user, isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [venue, setVenue] = useState<VenueDraft | null>(null);
    const [isLoadingVenue, setIsLoadingVenue] = useState(false);

    const close = useCallback(() => {
        setIsOpen(false);
        // Drop the edited venue so the next "Add venue" opens blank rather than
        // reopening the last thing that was edited.
        setVenue(null);
    }, []);

    useEffect(() => {
        const onCreate = () => {
            setVenue(null);
            setIsOpen(true);
        };

        const onEdit = async (event: Event) => {
            const venueId = (event as CustomEvent<{ venueId?: string }>).detail?.venueId;
            if (!venueId) return;

            // Fetch before opening: an empty form that fills in a moment later reads
            // as the venue's data having been lost.
            setIsLoadingVenue(true);
            try {
                const data = await venuesApi.getById(venueId) as VenueDraft;
                setVenue(data);
                setIsOpen(true);
            } catch {
                showToast('Could not load that venue', 'error');
            } finally {
                setIsLoadingVenue(false);
            }
        };

        window.addEventListener(OPEN_CREATE_VENUE, onCreate);
        window.addEventListener(OPEN_EDIT_VENUE, onEdit);
        return () => {
            window.removeEventListener(OPEN_CREATE_VENUE, onCreate);
            window.removeEventListener(OPEN_EDIT_VENUE, onEdit);
        };
    }, [showToast]);

    // Only venue owners can list or edit a venue. The server enforces this too -
    // this just avoids mounting a form nobody on this account can submit.
    if (!isAuthenticated || !isVenueOwner(user)) return null;

    return (
        <>
            {/* Brief spinner while an edit's data is being fetched. */}
            {isLoadingVenue && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60" role="status" aria-label="Loading venue">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            )}
            <CreateVenueModal isOpen={isOpen} onClose={close} venue={venue} />
        </>
    );
}
