/**
 * Client-side payment-schedule display helpers (Req 1.6, 8.7).
 *
 * Pure, no React. The actual date math and branch selection live in the sibling
 * `paymentScheduleCore.mjs` so that `paymentSchedule.check.mjs` can exercise the
 * SAME functions under a plain `node` run (node can't import a .ts). This file
 * is the typed surface React imports: it re-exports the core and pins the
 * default INR formatter for `describeScheduleText`.
 */

import type { Booking } from './types';
import { formatInr } from './formatInr';
// Plain .mjs core: tsconfig's allowJs types it from its JSDoc, and the wrappers
// below pin the public signatures.
import {
    daysUntil as daysUntilCore,
    describeSchedule as describeScheduleCore,
    describeScheduleText as describeScheduleTextCore,
} from './paymentScheduleCore.mjs';

/** The `paymentSchedule` sub-document on a client Booking. */
type BookingSchedule = NonNullable<Booking['paymentSchedule']>;

/** A plain schedule-shaped object is also accepted (defensive about partials). */
type ScheduleLike = Partial<BookingSchedule> | null | undefined;

/** Flattened cost-summary shape for rendering (Req 1.6). */
export interface ScheduleDisplay {
    type: 'full' | 'installment';
    fullAmount?: number;
    depositAmount?: number;
    balanceAmount?: number;
    balanceDueAt?: string | null;
}

/**
 * Whole days remaining until `balanceDueAt`, never negative. Same convention as
 * the reminder job — `Math.ceil((due - now) / 86_400_000)` (Req 8.7). Null or
 * invalid input, and any past due date, return 0.
 */
export function daysUntil(balanceDueAt: string | Date | null | undefined, now?: Date): number {
    return daysUntilCore(balanceDueAt, now);
}

/**
 * Reduce a booking's schedule to a flat display shape (Req 1.6). Missing
 * schedule falls back to a 'full' display of `totalAmount` (0 if absent).
 */
export function describeSchedule(schedule: ScheduleLike, totalAmount?: number): ScheduleDisplay {
    return describeScheduleCore(schedule, totalAmount);
}

/**
 * Human-readable one-liner for direct render (Req 1.6). Uses `formatInr` by
 * default; a different formatter can be injected for testing or other currencies.
 */
export function describeScheduleText(
    schedule: ScheduleLike,
    format: (n: number) => string = formatInr,
    totalAmount?: number
): string {
    return describeScheduleTextCore(schedule, format, totalAmount);
}
