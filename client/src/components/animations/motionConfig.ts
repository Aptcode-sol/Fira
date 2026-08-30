/**
 * Shared timing for the entrance animations.
 *
 * These wrappers sit around almost every block on every page, so their numbers set
 * how fast the whole app feels. They were tuned as individual flourishes - half to
 * two-thirds of a second each, travelling 40-60px, with per-call-site delays
 * stacked on top - which reads as one long wait once a page has six of them.
 *
 * Shorter and shallower. The animation is still there; it just stops being
 * something you wait for.
 */

/** Entrance duration. Was 0.5-0.6s, which is well past the point of feeling instant. */
export const ENTRANCE_DURATION = 0.28;

/**
 * How far an element travels in. Was 40-60px: distance reads as slowness even at a
 * fixed duration, because the eye tracks the movement rather than the arrival.
 */
export const ENTRANCE_OFFSET = 14;

/** Gap between staggered children. Was 0.1s, so a 10-item row took a full second. */
export const STAGGER_DELAY = 0.04;

/**
 * Call sites pass delays of 0.1 to 0.4s to stage sections down a page. Scaled
 * rather than capped so the ordering they encode is preserved while the absolute
 * wait shrinks - capping would collapse 0.2/0.25/0.3/0.4 into one simultaneous pop.
 */
export const DELAY_SCALE = 0.4;

/**
 * Fraction of an element that must be on screen before it animates.
 *
 * Was 0.15-0.2. On a tall section that meant scrolling well past its top edge
 * before anything happened, so content appeared late and felt sluggish. A small
 * value starts the moment the edge appears.
 */
export const VIEWPORT_AMOUNT = 0.05;

/** Standard ease-out. Fast start, gentle settle. */
export const ENTRANCE_EASE = [0.22, 0.61, 0.36, 1] as const;

/** Apply DELAY_SCALE, keeping 0 exactly 0. */
export const scaledDelay = (delay: number) => (delay > 0 ? delay * DELAY_SCALE : 0);
