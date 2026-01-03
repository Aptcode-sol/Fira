'use client';

import { motion, Variants } from 'framer-motion';
import { ReactNode } from 'react';

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
    duration = 0.5,
    className = '',
    once = true,
}: ScaleInProps) {
    const variants: Variants = {
        hidden: {
            opacity: 0,
            scale: 0.9,
        },
        visible: {
            opacity: 1,
            scale: 1,
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
            viewport={{ once, amount: 0.2 }}
            variants={variants}
            className={className}
        >
            {children}
        </motion.div>
    );
}
