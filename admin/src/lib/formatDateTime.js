// Absolute date + time, e.g. "30 Dec 2025 14:00".
//
// Moved out of `pages/EventDetail.jsx` (its only caller until now) so the
// settlement panel renders the last-payment and reversal timestamps in the same
// shape as the rest of the admin app — Requirement 3.3 asks for an absolute date
// and time, and a second copy of this would drift from the first.

/**
 * @param {string | number | Date | null | undefined} dateTimeStr
 * @returns {string} e.g. `30 Dec 2025 14:00`, `N/A` when absent, `Invalid Date` when unparseable
 */
export function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return 'N/A';
    const dt = new Date(dateTimeStr);
    if (isNaN(dt.getTime())) return 'Invalid Date';
    const day = dt.getDate();
    const month = dt.toLocaleString('en-US', { month: 'short' });
    const year = dt.getFullYear();
    const hours = dt.getHours().toString().padStart(2, '0');
    const mins = dt.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${mins}`;
}
