/**
 * Row geometry shared by both sidebars.
 *
 * The two shells had each grown their own numbers - the user dashboard used
 * `px-3 py-3` with a 20px icon slot, the venue portal `px-3 py-3.5 lg:py-3` with a
 * 24px one, and the footer a third set again. Same component tree, three different
 * row heights, which is why the footers looked like different products side by side.
 *
 * Everything that renders a sidebar row imports from here, so "make them match" is
 * a property of the code rather than something to re-check by eye.
 */

/**
 * The leading slot every row starts with, icon or avatar.
 *
 * Fixed at 32px so a 20px glyph and a 32px avatar occupy the same width and every
 * label starts at the same x. The avatar used to be 36px against a 20px icon slot,
 * so the footer's text hung 16px right of the nav labels above it.
 */
export const SIDEBAR_SLOT = 'w-8 h-8 flex-shrink-0 flex items-center justify-center';

/** Glyph size inside SIDEBAR_SLOT. */
export const SIDEBAR_ICON = 'w-5 h-5';

/** Row label. Sized once so nav items, Settings and the account name agree. */
export const SIDEBAR_LABEL = 'text-sm font-medium whitespace-nowrap';

/**
 * A sidebar row: nav item, Settings, or the account block.
 *
 * Open rows are 48px tall (32px slot + padding) - a little larger than the 44px
 * they were, which is what makes the list read as evenly spaced rather than tight.
 * Collapsed, the row shrinks to the slot and centres in the rail.
 */
export function sidebarRowClass(options: {
    isOpen: boolean;
    isActive?: boolean;
    /** `danger` is the sign-out control; `brand` keeps the cyan brand-profile accent. */
    tone?: 'neutral' | 'danger' | 'brand';
}): string {
    const { isOpen, isActive = false, tone = 'neutral' } = options;

    const base = `flex items-center gap-3 rounded-xl transition-colors overflow-hidden ${isOpen ? 'px-2.5 py-2' : 'p-2 justify-center'
        }`;

    if (tone === 'danger') {
        return `${base} text-red-400 hover:bg-red-500/10 hover:text-red-300`;
    }

    if (isActive) {
        return tone === 'brand'
            ? `${base} bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10`
            : `${base} bg-white text-black shadow-lg shadow-white/10`;
    }

    return `${base} text-gray-400 hover:bg-white/[0.06] hover:text-white`;
}
