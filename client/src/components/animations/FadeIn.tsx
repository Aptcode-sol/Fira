'use client';

import { motion, Variants } from 'framer-motion';
import { ReactNode } from 'react';

interface FadeInProps {
    children: ReactNode;
    delay?: number;
    duration?: number;
    direction?: 'up' | 'down' | 'left' | 'right' | 'none';
    className?: string;
    once?: boolean;
    // 16.1/17.1: opt-in to animate on mount instead of on scroll-into-view.
    // whileInView keeps content at opacity:0 until it enters the viewport, which
    // left below-the-fold lists (e.g. My Bookings on mobile) blank until scroll.
    animateOnMount?: boolean;
}

const directionOffset = {
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
    none: {},
};

export default function FadeIn({
    children,
    delay = 0,
    duration = 0.5,
    direction = 'up',
    className = '',
    once = true,
    animateOnMount = false,
}: FadeInProps) {
    const variants: Variants = {
        hidden: {
            opacity: 0,
            ...directionOffset[direction],
        },
        visible: {
            opacity: 1,
            x: 0,
            y: 0,
            transition: {
                duration,
                delay,
                ease: [0.25, 0.1, 0.25, 1],
            },
        },
    };

    // animateOnMount: drive the visible state immediately (animate) rather than
    // waiting for the element to scroll into view (whileInView).
    const activation = animateOnMount
        ? { animate: 'visible' as const }
        : { whileInView: 'visible' as const, viewport: { once, amount: 0.2 } };

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
