/**
 * Pure layout decision for the "Pay Now" widget(s) (Req 8.4, 8.5, Property 8).
 *
 * Extracted from PaymentDueWidgets so both the component and its test share ONE
 * source of truth without dragging in the 'use client' component and its
 * Razorpay/fetch dependencies: nothing when nothing qualifies, a stack for 1–2,
 * and a single swipeable container the moment the count exceeds two.
 */

export type WidgetLayout = 'none' | 'stacked' | 'swipeable';

export function widgetLayout(count: number): WidgetLayout {
    if (count <= 0) return 'none';
    if (count <= 2) return 'stacked';
    return 'swipeable';
}
