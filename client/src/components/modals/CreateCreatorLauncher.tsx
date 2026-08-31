'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { brandsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import CreateCreatorModal, { type CreatorDraft } from './CreateCreatorModal';

/** Event name that opens the creator form blank, to apply as a creator. */
export const OPEN_CREATE_CREATOR = 'open-create-creator';

/** Event name that opens the same form prefilled with an existing profile. */
export const OPEN_EDIT_CREATOR = 'open-edit-creator';

/** Call from any "Apply as creator" / "Create brand profile" button. */
export function openCreateCreator() {
    window.dispatchEvent(new CustomEvent(OPEN_CREATE_CREATOR));
}

/** Call from any "Edit profile" button that only has the id to hand. */
export function openEditCreator(brandId: string) {
    window.dispatchEvent(new CustomEvent(OPEN_EDIT_CREATOR, { detail: { brandId } }));
}

/**
 * Mounts the creator form once, app-wide, opened by a window event - blank to
 * apply, prefilled to edit.
 *
 * Mirrors CreateEventLauncher and CreateVenueLauncher so all three create flows
 * behave identically: opened in place from wherever you are, dismissed back to it.
 * Creator was the odd one out - a standalone four-step route - which is why its
 * create and edit had drifted into two different forms.
 */
export default function CreateCreatorLauncher() {
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [creator, setCreator] = useState<CreatorDraft | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const openForEdit = useCallback(async (brandId: string) => {
        setIsLoading(true);
        try {
            // Fetched here rather than passed in: callers with only an id would
            // otherwise hand the form a trimmed shape, and a half-populated edit
            // blanks the fields it did not receive on save.
            const fetched = await brandsApi.getById(brandId) as CreatorDraft;
            setCreator(fetched);
            setIsOpen(true);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not load that profile', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        const onCreate = () => { setCreator(null); setIsOpen(true); };
        const onEdit = (e: Event) => {
            const { brandId } = (e as CustomEvent<{ brandId: string }>).detail ?? {};
            if (brandId) openForEdit(brandId);
        };
        window.addEventListener(OPEN_CREATE_CREATOR, onCreate);
        window.addEventListener(OPEN_EDIT_CREATOR, onEdit);
        return () => {
            window.removeEventListener(OPEN_CREATE_CREATOR, onCreate);
            window.removeEventListener(OPEN_EDIT_CREATOR, onEdit);
        };
    }, [openForEdit]);

    // A creator profile is tied to an account, so there is nothing to create while
    // signed out. The server also rejects a second profile for the same user.
    if (!isAuthenticated) return null;

    return (
        <>
            {isLoading && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            )}
            <CreateCreatorModal
                // Remounts between profiles so no draft survives from the last one.
                key={creator?._id ?? 'new'}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                creator={creator}
            />
        </>
    );
}
