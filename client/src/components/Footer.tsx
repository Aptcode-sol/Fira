'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { FEATURED_CITIES } from '@/lib/cities';

const footerLinks = {
    product: [
        { label: 'Find Parties', href: '/events' },
        { label: 'Find Venues', href: '/venues' },
        { label: 'Create Event', href: '/create' },
        // Points at the public pitch page, not the sign-in form. A sign-in
        // screen is a dead end for anyone not already a customer, and it is
        // disallowed in robots.txt so it could never rank or become a sitelink.
        { label: 'Venue Portal', href: '/venue-portal/landing' },
        { label: 'About FIRA', href: '/about' },
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

// ... social icons commented out as per request
// const socialLinks = [ ... ];

export default function Footer() {
    const footerRef = useRef(null);
    const isInView = useInView(footerRef, { once: true, amount: 0.2 });

    const legalLinks = [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Refund Policy', href: '/refund-policy' },
        { label: 'Community Guidelines', href: '/community-guidelines' },
        { label: 'Help & Support', href: '/help' },
    ];

    return (
        <motion.footer
            ref={footerRef}
            className="bg-black/70 backdrop-blur-sm border-t border-white/5 pt-16 pb-8 px-4 sm:px-6 lg:px-8"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
            role="contentinfo"
        >
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                    {/* Logo Section */}
                    <motion.div
                        className="col-span-1"
                        variants={itemVariants}
                    >
                        <Link href="/" className="flex items-center space-x-2 mb-6 group">
                            <motion.img
                                src="/logo white.png"
                                alt="FIRA"
                                className="w-10 h-10 object-contain"
                                whileHover={{ scale: 1.1 }}
                                transition={{ type: "spring", stiffness: 400 }}
                            />
                        </Link>
                        <p className="text-gray-300 text-sm mb-6 leading-relaxed max-w-sm">
                            Your ultimate platform for discovering venues and creating unforgettable parties.
                            Connect, celebrate, and make memories with Fira.
                        </p>
                        {/* Social Icons Commented Out
                        <div className="flex gap-4">
                            {socialLinks.map((social, i) => ( ... ))}
                        </div>
                        */}
                    </motion.div>

                    {/* Product Links */}
                    <motion.div variants={itemVariants} className="md:pl-12">
                        <h4 className="text-white text-lg font-bold mb-6">Product</h4>
                        <ul className="space-y-4">
                            {footerLinks.product.map((link, i) => (
                                <motion.li
                                    key={link.label}
                                    initial="rest"
                                    whileHover="hover"
                                    variants={linkHoverVariants}
                                >
                                    <Link
                                        href={link.href}
                                        className="text-gray-400 hover:text-violet-300 text-sm transition-colors inline-flex items-center gap-2"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500/50"></span>
                                        {link.label}
                                    </Link>
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* Legal Links (Merged Company & Other Pages) */}
                    <motion.div variants={itemVariants}>
                        <h4 className="text-white text-lg font-bold mb-6">Legal & Support</h4>
                        <ul className="space-y-4">
                            {legalLinks.map((link) => (
                                <motion.li
                                    key={link.label}
                                    initial="rest"
                                    whileHover="hover"
                                    variants={linkHoverVariants}
                                >
                                    <Link
                                        href={link.href}
                                        className="text-gray-400 hover:text-violet-300 text-sm transition-colors inline-flex items-center gap-2"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500/50"></span>
                                        {link.label}
                                    </Link>
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>
                </div>

                {/* Popular cities. A site-wide block like this is what gives
                    every city landing page an internal link from every page -
                    the difference between them being crawled and being orphans. */}
                <motion.nav
                    aria-label="Popular cities"
                    className="border-t border-white/5 pt-10 pb-10"
                    variants={itemVariants}
                >
                    <h4 className="text-white text-sm font-bold mb-5">Popular cities</h4>
                    {/* Each link gets a small violet chevron so it reads as
                        clickable. `items-start` + a shrink-0 icon with matching
                        line-height keeps the arrow aligned to the first line
                        when a long city name wraps. */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                        {FEATURED_CITIES.map(city => (
                            <div key={city.slug} className="flex flex-col gap-2">
                                {[
                                    { href: `/events/in/${city.slug}`, label: `Events in ${city.name}`, tone: 'text-gray-300' },
                                    { href: `/venues/in/${city.slug}`, label: `Venues in ${city.name}`, tone: 'text-gray-300' },
                                ].map(item => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`group flex items-start gap-1.5 text-sm leading-5 transition-colors ${item.tone} hover:text-violet-300`}
                                    >
                                        <span className="min-w-0">{item.label}</span>
                                        <svg
                                            className="w-3 h-3 mt-1 shrink-0 text-violet-500/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-violet-400"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2.5}
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </div>
                </motion.nav>

                {/* Bottom Bar */}
                <motion.div
                    className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4"
                    variants={itemVariants}
                >
                    <div className="text-center md:text-left">
                        <motion.p
                            className="text-gray-300 text-sm mb-1"
                            initial={{ opacity: 0 }}
                            animate={isInView ? { opacity: 1 } : {}}
                            transition={{ delay: 0.6 }}
                        >
                            © {new Date().getFullYear()} FIRA. All rights reserved.
                        </motion.p>
                    </div>

                    <motion.p
                        className="text-gray-300 text-sm flex items-center gap-1.5"
                        initial={{ opacity: 0 }}
                        animate={isInView ? { opacity: 1 } : {}}
                        transition={{ delay: 0.7 }}
                    >
                        Made with{' '}
                        <motion.span
                            className="text-red-500 text-lg"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                        >
                            ♥
                        </motion.span>
                        {' '}for party loveers, letsfira.
                    </motion.p>
                </motion.div>
            </div>
        </motion.footer>
    );
}
