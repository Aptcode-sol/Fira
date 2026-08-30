import type React from 'react';

/**
 * Props that make a native date input open its picker when you tap anywhere on
 * the field, not just on the small calendar glyph at the right edge.
 *
 * Chrome only opens the picker from that glyph; clicking the text area focuses the
 * field and does nothing visible, which reads as broken. `showPicker()` is the
 * standard way to trigger it, and it must be called from a user gesture - a click
 * handler qualifies.
 *
 * Spread onto the input: `<input type="date" {...openPickerOnClick} />`
 */
export const openPickerOnClick = {
    onClick: (event: React.MouseEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        try {
            // Not in every browser, and it throws if the input is hidden or the
            // call is not user-activated. Either way the field still works as a
            // plain text/date entry, so failure is not worth surfacing.
            input.showPicker?.();
        } catch {
            /* no-op: falls back to the browser's own click behaviour */
        }
    },
};
