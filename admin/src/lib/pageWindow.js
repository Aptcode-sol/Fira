/**
 * Which page numbers a pager should show, as a sliding window.
 *
 * Plain ESM with no JSX so bare `node` can import it - Pagination.check.mjs asserts on
 * this exact module rather than a copy of it. The sibling check for formatCapacity had
 * to mirror its subject by hand because the function lived inside a .jsx page, and a
 * check that duplicates its subject passes while the subject rots.
 *
 * This logic was inlined in Users, Venues, Events and Brands as:
 *
 *     let page = i + 1;
 *     if (totalPages > 5) {
 *       if (currentPage > 3) page = currentPage - 2 + i;
 *       if (page > totalPages) page = totalPages - (4 - i);
 *     }
 *
 * which breaks at the end of a long list: 10 pages on page 10 gives [8,9,10,9,10] -
 * out of order, two numbers rendered twice, duplicate React keys. It clamped each
 * number individually; clamping the window's START instead is what keeps the pages
 * distinct and consecutive.
 *
 * @param {number} currentPage 1-based page the reader is on.
 * @param {number} totalPages  Total pages available.
 * @param {number} [size]      How many numbers to show at once.
 * @returns {number[]} Ascending, distinct, in-range page numbers. Empty when there are none.
 */
export function pageWindow(currentPage, totalPages, size = 5) {
    const pages = Math.max(0, Math.floor(totalPages) || 0);
    if (pages < 1) return [];
    const width = Math.min(size, pages);
    // Centre on the current page, then slide back so the window never runs past the
    // last page and never starts before the first.
    const start = Math.max(1, Math.min(currentPage - Math.floor(width / 2), pages - width + 1));
    return Array.from({ length: width }, (_, i) => start + i);
}
