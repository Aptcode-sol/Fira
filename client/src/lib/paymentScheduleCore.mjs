// Pure, framework-free core for the client payment-schedule display helpers.
//
// This lives as a plain .mjs (not .ts) for one reason: the repo's self-check
// convention is a standalone `node *.check.mjs` with no build step, and node
// cannot import a .ts file. So the actual logic lives here where both the .ts
// wrapper (paymentSchedule.ts, imported by React) and paymentSchedule.check.mjs
// import THE SAME function — there is exactly one copy of the date math.
//
// No React, no DOM, no formatting dependencies. formatInr is injected by the
// caller so this stays importable by node with zero setup.

const MS_PER_DAY = 86_400_000;

/**
 * Whole days remaining from now until `balanceDueAt`, never negative.
 *
 * Uses the SAME convention as the server reminder job (Req 8.7):
 *   Math.ceil((due - now) / 86_400_000)
 * so the widget's "N days left" matches the reminder email's "N days left" to
 * the day. A due date already in the past clamps to 0 (deadline reached), and
 * null/invalid input is 0 rather than NaN so the UI never renders "NaN days".
 *
 * @param {string | Date | null | undefined} balanceDueAt
 * @param {Date} [now] injectable for tests; defaults to the real clock
 * @returns {number}
 */
export function daysUntil(balanceDueAt, now = new Date()) {
    if (balanceDueAt == null) return 0;
    const due = balanceDueAt instanceof Date ? balanceDueAt : new Date(balanceDueAt);
    const dueMs = due.getTime();
    if (!Number.isFinite(dueMs)) return 0;
    const diff = dueMs - now.getTime();
    if (diff <= 0) return 0;
    return Math.ceil(diff / MS_PER_DAY);
}

/**
 * Reduce a booking's payment schedule to a flat display shape (Req 1.6).
 *
 * Defensive about a missing schedule: legacy bookings have no `paymentSchedule`,
 * so with no schedule we fall back to a 'full' display of `totalAmount` (0 if
 * that too is absent) — the guest sees one amount due, never a blank.
 *
 * A 'full' schedule's whole cost is its depositAmount (the server sets
 * deposit = total for full bookings), so 'full' surfaces `fullAmount`.
 * 'installment' surfaces deposit / balance / due-date for the two-part display.
 *
 * @param {{ type?: 'full' | 'installment', depositAmount?: number, balanceAmount?: number, balanceDueAt?: string | null } | null | undefined} schedule
 * @param {number} [totalAmount] fallback when schedule is missing
 * @returns {{ type: 'full' | 'installment', fullAmount?: number, depositAmount?: number, balanceAmount?: number, balanceDueAt?: string | null }}
 */
export function describeSchedule(schedule, totalAmount) {
    if (!schedule || !schedule.type) {
        return { type: 'full', fullAmount: totalAmount ?? 0 };
    }
    if (schedule.type === 'installment') {
        return {
            type: 'installment',
            depositAmount: schedule.depositAmount ?? 0,
            balanceAmount: schedule.balanceAmount ?? 0,
            balanceDueAt: schedule.balanceDueAt ?? null,
        };
    }
    // 'full': the whole cost was collected up front as the "deposit".
    return { type: 'full', fullAmount: schedule.depositAmount ?? totalAmount ?? 0 };
}

/** Format a due date for display; empty string when absent/invalid. */
function formatDue(balanceDueAt) {
    if (!balanceDueAt) return '';
    const d = new Date(balanceDueAt);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Human-readable one-liner for direct render (Req 1.6). `format` is injected so
 * the core stays free of the INR formatter import (the .ts wrapper passes
 * formatInr; the check passes a trivial stub).
 *
 * @param {*} schedule
 * @param {(n: number) => string} format
 * @param {number} [totalAmount]
 * @returns {string}
 */
export function describeScheduleText(schedule, format, totalAmount) {
    const d = describeSchedule(schedule, totalAmount);
    if (d.type === 'installment') {
        const due = formatDue(d.balanceDueAt);
        const duePart = due ? ` due ${due}` : '';
        return `Deposit ${format(d.depositAmount ?? 0)} now · Balance ${format(d.balanceAmount ?? 0)}${duePart}`;
    }
    return `Full amount due: ${format(d.fullAmount ?? 0)}`;
}
