'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Gap between the trigger and the open list, in px. */
const GAP = 8;
/** Below this much free space we would rather flip the list upwards. */
const MIN_SPACE_BELOW = 200;
const MAX_LIST_HEIGHT = 320;
const MIN_LIST_HEIGHT = 140;
/** Option labels need more room than a half-column trigger provides. */
const MIN_LIST_WIDTH = 200;
/** Keep the list clear of the viewport edges when the floor above widens it. */
const EDGE_MARGIN = 8;

export interface FloatingPosition {
    left: number;
    top: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
}

/**
 * Positioning for a dropdown list that is rendered into <body> rather than next
 * to its trigger.
 *
 * Why portal at all: as an absolutely-positioned child, a list gets clipped by any
 * ancestor with `overflow: auto` (a filter panel body, a modal, a scrolling form)
 * and can be buried by an ancestor stacking context. Rendering at body level fixes
 * both, at the cost of having to position it by hand - which is what this does.
 *
 * Shared by Select and MultiSelect so there is one copy of the measuring, the
 * flip-up rule and the viewport clamping.
 */
export function useFloatingList(isOpen: boolean) {
    const triggerRef = useRef<HTMLDivElement>(null);
    // The list is portalled, so it is not inside triggerRef and needs its own ref
    // for click-outside checks.
    const listRef = useRef<HTMLDivElement>(null);

    // Portals need a DOM target, which does not exist during SSR.
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => setIsMounted(true), []);

    const [position, setPosition] = useState<FloatingPosition | null>(null);

    const measure = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - GAP;
        const spaceAbove = rect.top - GAP;
        const openUp = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;
        const available = openUp ? spaceAbove : spaceBelow;

        // The trigger can be half a column wide (filters sit two-up on mobile), and
        // option labels are not. Give the list a readable floor, then pull it back
        // inside the viewport if that floor pushes it off the right edge.
        const width = Math.max(rect.width, Math.min(MIN_LIST_WIDTH, window.innerWidth - EDGE_MARGIN * 2));
        const left = Math.max(EDGE_MARGIN, Math.min(rect.left, window.innerWidth - width - EDGE_MARGIN));

        setPosition({
            left,
            width,
            // Flipping up anchors the list's bottom edge to the trigger's top and
            // shifts it by its own height with a transform, so the height does not
            // need to be known in advance.
            top: openUp ? rect.top - GAP : rect.bottom + GAP,
            maxHeight: Math.max(MIN_LIST_HEIGHT, Math.min(MAX_LIST_HEIGHT, available)),
            openUp,
        });
    }, []);

    // Keep the list glued to the trigger while open. Capture phase so this also
    // fires for scrolling inside an ancestor container, not just the window.
    useEffect(() => {
        if (!isOpen) return;
        measure();

        const onViewportChange = () => measure();
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);
        return () => {
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('scroll', onViewportChange, true);
        };
    }, [isOpen, measure]);

    /** Style for the portalled list container. */
    const listStyle: React.CSSProperties = {
        position: 'fixed',
        left: position?.left,
        top: position?.top,
        width: position?.width,
        maxHeight: position?.maxHeight,
        transform: position?.openUp ? 'translateY(-100%)' : undefined,
    };

    return { triggerRef, listRef, position, isMounted, listStyle };
}
