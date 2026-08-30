'use client';

import { motion, useReducedMotion, Variants } from 'framer-motion';
import { ReactNode } from 'react';
import {
    ENTRANCE_DURATION,
    ENTRANCE_EASE,
    ENTRANCE_OFFSET,
    VIEWPORT_AMOUNT,
    scaledDelay,
} from './motionConfig';

interface FadeInProps {
    children: ReactNode;
    delay?: number;
    duration?: number;
    direction?: 'up' | 'down' | 'left' | 'right' | 'none';
    className?: string;
    once?: boolean;
    // Opt in to animate on mount instead of on scroll-into-view. whileInView keeps
    // content at opacity:0 until it enters the viewport, which left below-the-fold
    // lists (e.g. My Bookings on mobile) blank until scroll.
    animateOnMount?: boolean;
}

const directionOffset = {
    up: { y: ENTRANCE_OFFSET },
    down: { y: -ENTRANCE_OFFSET },
    left: { x: ENTRANCE_OFFSET },
    right: { x: -ENTRANCE_OFFSET },
    none: {},
};

export default function FadeIn({
    children,
    delay = 0,
    duration = ENTRANCE_DURATION,
    direction = 'up',
    className = '',
    once = true,
    animateOnMount = false,
}: FadeInProps) {
    // Honoured here rather than relying on the global CSS reduced-motion rule:
    // framer-motion animates inline transforms frame by frame, not with CSS
    // animations or transitions, so `animation-duration: 0.01ms` never touched it.
    const reduceMotion = useReducedMotion();

    const variants: Variants = {
        hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, ...directionOffset[direction] },
        visible: {
            opacity: 1,
            x: 0,
            y: 0,
            transition: reduceMotion
                ? { duration: 0 }
                : { duration, delay: scaledDelay(delay), ease: ENTRANCE_EASE },
        },
    };

    // animateOnMount: drive the visible state immediately (animate) rather than
    // waiting for the element to scroll into view (whileInView).
    const activation = animateOnMount
        ? { animate: 'visible' as const }
        : { whileInView: 'visible' as const, viewport: { once, amount: VIEWPORT_AMOUNT } };

    return (
        <motion.div
            initial="hidden"
            {...activation}
            variants={variants}
            className={className}
        >
            {children}
        </motion.div>
    );
}
