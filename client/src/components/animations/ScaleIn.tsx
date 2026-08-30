'use client';

import { motion, useReducedMotion, Variants } from 'framer-motion';
import { ReactNode } from 'react';
import {
    ENTRANCE_DURATION,
    ENTRANCE_EASE,
    VIEWPORT_AMOUNT,
    scaledDelay,
} from './motionConfig';

interface ScaleInProps {
    children: ReactNode;
    delay?: number;
    duration?: number;
    className?: string;
    once?: boolean;
}

export default function ScaleIn({
    children,
    delay = 0,
    duration = ENTRANCE_DURATION,
    className = '',
    once = true,
}: ScaleInProps) {
    // See FadeIn: the global CSS reduced-motion rule cannot reach framer-motion.
    const reduceMotion = useReducedMotion();

    const variants: Variants = {
        // 0.97 rather than 0.9: a 10% scale-up is a large visual change that also
        // forces a repaint of everything inside the element.
        hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 },
        visible: {
            opacity: 1,
            scale: 1,
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
