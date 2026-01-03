'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const footerLinks = {
    product: [
        { label: 'Find Parties', href: '/events' },
        { label: 'Find Venues', href: '/venues' },
        { label: 'Create Event', href: '/create' },
        { label: 'List Venue', href: '/list-venue' },
    ],
    company: [
        { label: 'About', href: '/about' },
        { label: 'Careers', href: '/careers' },
        { label: 'Press', href: '/press' },
        { label: 'Contact', href: '/contact' },
    ],
    legal: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
    ],
};

const socialLinks = [
    {
        name: 'Twitter',
        href: '#',
        icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        ),
    },
    {
        name: 'Instagram',
        href: '#',
        icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
        ),
    },
    {
        name: 'LinkedIn',
        href: '#',
        icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
        ),
    },
];

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: "easeOut" as const },
    },
};

const linkHoverVariants = {
    rest: { x: 0 },
    hover: { x: 4, transition: { duration: 0.2 } },
};

export default function Footer() {
    const footerRef = useRef(null);
    const isInView = useInView(footerRef, { once: true, amount: 0.2 });

    return (
        <motion.footer
            ref={footerRef}
            className="bg-black/70 backdrop-blur-sm border-t border-white/5 pt-16 pb-8 px-4 sm:px-6 lg:px-8"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
        >
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                    {/* Logo Section */}
                    <motion.div
                        className="col-span-2 md:col-span-1"
                        variants={itemVariants}
                    >
                        <Link href="/" className="flex items-center space-x-2 mb-4 group">
                            <motion.div
                                className="w-7 h-7 rounded-lg bg-white flex items-center justify-center"
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                transition={{ type: "spring", stiffness: 400 }}
                            >
                                <span className="text-black font-bold text-xs">F</span>
                            </motion.div>
                            <span className="text-lg font-semibold text-white group-hover:text-violet-300 transition-colors">FIRA</span>
                        </Link>
                        <p className="text-gray-600 text-xs mb-4 leading-relaxed">
                            Your ultimate platform for discovering venues and creating unforgettable parties.
                        </p>
                        <div className="flex gap-4">
                            {socialLinks.map((social, i) => (
                                <motion.a
                                    key={social.name}
                                    href={social.href}
                                    className="text-gray-600 hover:text-white transition-colors"
                                    whileHover={{ scale: 1.2, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                                    transition={{ delay: 0.3 + i * 0.1 }}
                                >
                                    {social.icon}
                                </motion.a>
                            ))}
                        </div>
                    </motion.div>

                    {/* Product Links */}
                    <motion.div variants={itemVariants}>
                        <h4 className="text-white text-sm font-medium mb-4">Product</h4>
                        <ul className="space-y-2">
                            {footerLinks.product.map((link, i) => (
                                <motion.li
                                    key={link.label}
                                    initial="rest"
                                    whileHover="hover"
                                    variants={linkHoverVariants}
                                >
                                    <Link
                                        href={link.href}
                                        className="text-gray-600 hover:text-gray-300 text-xs transition-colors inline-flex items-center gap-1"
                                    >
                                        {link.label}
                                    </Link>
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* Company Links */}
                    <motion.div variants={itemVariants}>
                        <h4 className="text-white text-sm font-medium mb-4">Company</h4>
                        <ul className="space-y-2">
                            {footerLinks.company.map((link) => (
                                <motion.li
                                    key={link.label}
                                    initial="rest"
                                    whileHover="hover"
                                    variants={linkHoverVariants}
                                >
                                    <Link
                                        href={link.href}
                                        className="text-gray-600 hover:text-gray-300 text-xs transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* Legal Links */}
                    <motion.div variants={itemVariants}>
                        <h4 className="text-white text-sm font-medium mb-4">Legal</h4>
                        <ul className="space-y-2">
                            {footerLinks.legal.map((link) => (
                                <motion.li
                                    key={link.label}
                                    initial="rest"
                                    whileHover="hover"
                                    variants={linkHoverVariants}
                                >
                                    <Link
                                        href={link.href}
                                        className="text-gray-600 hover:text-gray-300 text-xs transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>
                </div>

                {/* Bottom Bar with line animation */}
                <motion.div
                    className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-4"
                    variants={itemVariants}
                >
                    <motion.p
                        className="text-gray-600 text-xs"
                        initial={{ opacity: 0 }}
                        animate={isInView ? { opacity: 1 } : {}}
                        transition={{ delay: 0.6 }}
                    >
                        © {new Date().getFullYear()} FIRA. All rights reserved.
                    </motion.p>
                    <motion.p
                        className="text-gray-700 text-xs flex items-center gap-1"
                        initial={{ opacity: 0 }}
                        animate={isInView ? { opacity: 1 } : {}}
                        transition={{ delay: 0.7 }}
                    >
                        Made with{' '}
                        <motion.span
                            className="text-red-500"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                        >
                            ♥
                        </motion.span>
                        {' '}for party lovers
                    </motion.p>
                </motion.div>
            </div>
        </motion.footer>
    );
}
