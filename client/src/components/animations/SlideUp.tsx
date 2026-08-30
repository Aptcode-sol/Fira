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

interface SlideUpProps {
    children: ReactNode;
    delay?: number;
    duration?: number;
    className?: string;
    once?: boolean;
}

export default function SlideUp({
    children,
    delay = 0,
    duration = ENTRANCE_DURATION,
    className = '',
    once = true,
}: SlideUpProps) {
    // See FadeIn: the global CSS reduced-motion rule cannot reach framer-motion.
    const reduceMotion = useReducedMotion();

    const variants: Variants = {
        // Was y: 60 over 0.6s. Page headings use SlideUp, so that was the first
        // thing every screen did and the slowest.
        hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: ENTRANCE_OFFSET },
        visible: {
            opacity: 1,
            y: 0,
            transition: reduceMotion
                ? { duration: 0 }
                : { duration, delay: scaledDelay(delay), ease: ENTRANCE_EASE },
        },
    };

    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once, amount: VIEWPORT_AMOUNT }}
            variants={variants}
            className={className}
        >
            {children}
        </motion.div>
    );
}
