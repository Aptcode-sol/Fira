import { useState, useCallback, useMemo } from 'react';

/**
 * Row selection for admin tables, with page-aware "select all".
 *
 * The admin lists are paginated server-side, so "select all" has two honest
 * meanings and this hook exposes both without pretending to know rows it has
 * never seen:
 *
 *   - selectPage(ids)  — every row currently on screen. The header checkbox.
 *   - the caller decides what "all matching" means (it would need a separate
 *     bulk-by-filter endpoint), so this hook deliberately does NOT fake a
 *     select-across-pages by holding ids it cannot see.
 *
 * Selection is kept as a Set of ids, so it survives a page change: tick three
 * on page 1, move to page 2, tick two more, and the bulk action runs on all
 * five. clear() resets it (call it after a successful bulk action).
 *
 * ponytail: ids-only, no row objects held. The caller already has the rows for
 * the current page; holding copies here would just drift from the source list.
 */
export function useBulkSelection() {
    const [selected, setSelected] = useState(() => new Set());

    const toggle = useCallback((id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const isSelected = useCallback((id) => selected.has(id), [selected]);

    /** True when every id on the current page is selected (and there is at least one). */
    const isPageAllSelected = useCallback(
        (pageIds) => pageIds.length > 0 && pageIds.every(id => selected.has(id)),
        [selected]
    );

    /** Select or clear every row on the current page in one action. */
    const togglePage = useCallback((pageIds) => {
        setSelected(prev => {
            const next = new Set(prev);
            const allOn = pageIds.length > 0 && pageIds.every(id => next.has(id));
            if (allOn) {
                pageIds.forEach(id => next.delete(id));
            } else {
                pageIds.forEach(id => next.add(id));
            }
            return next;
        });
    }, []);

    const clear = useCallback(() => setSelected(new Set()), []);

    const selectedIds = useMemo(() => Array.from(selected), [selected]);

    return {
        selectedIds,
        count: selected.size,
        isSelected,
        toggle,
        togglePage,
        isPageAllSelected,
        clear,
    };
}
