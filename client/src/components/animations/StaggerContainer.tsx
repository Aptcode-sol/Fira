'use client';

import { motion, useReducedMotion, Variants } from 'framer-motion';
import { ReactNode } from 'react';
import {
    ENTRANCE_DURATION,
    ENTRANCE_EASE,
    ENTRANCE_OFFSET,
    STAGGER_DELAY,
    VIEWPORT_AMOUNT,
} from './motionConfig';

interface StaggerContainerProps {
    children: ReactNode;
    staggerDelay?: number;
    className?: string;
    once?: boolean;
}

export default function StaggerContainer({
    children,
    staggerDelay = STAGGER_DELAY,
    className = '',
    once = true,
}: StaggerContainerProps) {
    // See FadeIn: the global CSS reduced-motion rule cannot reach framer-motion.
    const reduceMotion = useReducedMotion();

    const containerVariants: Variants = {
        hidden: { opacity: reduceMotion ? 1 : 0 },
        visible: {
            opacity: 1,
            // No delayChildren. It was 0.1s, which pushed the first item back before
            // the per-item stagger had even started - a fixed tax on every list.
            transition: reduceMotion
                ? { duration: 0 }
                : { staggerChildren: staggerDelay },
        },
    };

    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once, amount: VIEWPORT_AMOUNT }}
            variants={containerVariants}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Stagger item to be used inside StaggerContainer
export function StaggerItem({
    children,
    className = '',
}: {
    children: ReactNode;
    className?: string;
}) {
    const reduceMotion = useReducedMotion();

    const itemVariants: Variants = {
        hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: ENTRANCE_OFFSET },
        visible: {
            opacity: 1,
            y: 0,
            transition: reduceMotion
                ? { duration: 0 }
                : { duration: ENTRANCE_DURATION, ease: ENTRANCE_EASE },
        },
    };

    return (
        <motion.div variants={itemVariants} className={className}>
            {children}
        </motion.div>
    );
}
