'use client';

import { motion, Variants } from 'framer-motion';
import { ReactNode } from 'react';

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
    duration = 0.6,
    className = '',
    once = true,
}: SlideUpProps) {
    const variants: Variants = {
        hidden: {
            opacity: 0,
            y: 60,
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration,
                delay,
                ease: [0.25, 0.1, 0.25, 1],
            },
        },
    };

    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once, amount: 0.15 }}
            variants={variants}
            className={className}
        >
            {children}
        </motion.div>
    );
}
