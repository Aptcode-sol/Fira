'use client';

import { useMemo, useState } from 'react';

/**
 * Client-side paging over an already-loaded array.
 *
 * ponytail: every dashboard list here fetches the whole collection in one call
 * and filters in memory, so paging in memory keeps the diff to one hook instead
 * of reworking each endpoint. Ceiling: it loads everything before showing page
 * one, so once a list can reach a few thousand rows, move to `?page=` on the
 * server and feed `totalPages` straight from the response - `Pagination` and
 * `DataTable` already accept an externally controlled page.
 */
export function usePaged<T>(rows: T[], pageSize: number) {
    const [page, setPage] = useState(1);

    const totalPages = Math.max(Math.ceil(rows.length / pageSize), 1);
    // Filtering can shrink the list under the current page (say, page 4 of 4
    // becomes page 4 of 2). Clamp on read so the view never goes blank, and do
    // not write state during render.
    const current = Math.min(page, totalPages);

    const pageRows = useMemo(
        () => rows.slice((current - 1) * pageSize, current * pageSize),
        [rows, current, pageSize]
    );

    return { page: current, setPage, totalPages, pageRows, total: rows.length };
}

export default usePaged;
