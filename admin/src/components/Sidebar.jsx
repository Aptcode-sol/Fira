'use client';

import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './Sidebar.css';

const navItems = [
    { path: '/', label: 'Dashboard', icon: 'grid' },
    { path: '/venues', label: 'Venues', icon: 'building' },
    { path: '/events', label: 'Events', icon: 'calendar' },
    { path: '/brands', label: 'Brands', icon: 'star' },
    { path: '/users', label: 'Users', icon: 'users' },
];

const icons = {
    grid: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    ),
    building: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    ),
    calendar: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
    ),
    star: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ),
    users: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
    ),
    logout: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    ),
    menu: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
    ),
    close: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
};

export default function Sidebar({ onLogout }) {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile) {
                setIsMobileSidebarOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Trigger opening animation
    useEffect(() => {
        if (isMobileSidebarOpen && !isClosing) {
            const timer = setTimeout(() => setIsAnimating(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsAnimating(false);
        }
    }, [isMobileSidebarOpen, isClosing]);

    const closeMobileSidebar = () => {
        setIsClosing(true);
        setIsAnimating(false);
        setTimeout(() => {
            setIsMobileSidebarOpen(false);
            setIsClosing(false);
        }, 300);
    };

    const handleNavClick = () => {
        if (isMobile) {
            closeMobileSidebar();
        }
    };

    return (
        <>
            {/* Mobile Menu Button - Floating at top left */}
            {!isMobileSidebarOpen && isMobile && (
                <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    aria-label="Open menu"
                    style={{
                        position: 'fixed',
                        top: '16px',
                        left: '16px',
                        zIndex: 50,
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-violet) 0%, #ec4899 100%)',
                        color: 'white',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
                        transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    {icons.menu}
                </button>
            )}

            {/* Mobile Sidebar Drawer */}
            {isMobileSidebarOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
                    {/* Backdrop */}
                    <div
                        onClick={closeMobileSidebar}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(4px)',
                            opacity: isAnimating ? 1 : 0,
                            transition: 'opacity 0.3s ease'
                        }}
                    />

                    {/* Sidebar Drawer */}
                    <aside
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '75%',
                            maxWidth: '320px',
                            background: 'rgba(0, 0, 0, 0.95)',
                            backdropFilter: 'blur(20px)',
                            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)',
                            transform: isAnimating ? 'translateX(0)' : 'translateX(-100%)',
                            transition: 'transform 0.3s ease-out'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '16px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="logo-icon">F</span>
                                <span className="logo-text">FIRA Admin</span>
                            </div>
                            <button
                                onClick={closeMobileSidebar}
                                style={{
                                    padding: '8px',
                                    color: 'var(--text-secondary)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    transition: 'color 0.2s ease'
                                }}
                            >
                                {icons.close}
                            </button>
                        </div>

                        {/* Navigation */}
                        <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    end={item.path === '/'}
                                    onClick={handleNavClick}
                                    style={{ marginBottom: '4px' }}
                                >
                                    {icons[item.icon]}
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </nav>

                        {/* Footer */}
                        <div style={{
                            padding: '12px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'rgba(0, 0, 0, 0.2)'
                        }}>
                            <div className="admin-info" style={{ marginBottom: '12px' }}>
                                <div className="avatar avatar-sm">A</div>
                                <div>
                                    <div className="admin-name">Admin User</div>
                                    <div className="admin-role">Super Admin</div>
                                </div>
                            </div>
                            <button className="logout-btn" onClick={() => { handleNavClick(); onLogout(); }}>
                                {icons.logout}
                                <span>Logout</span>
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* Desktop Sidebar - Hover to expand */}
            {!isMobile && (
                <aside
                    className={`sidebar ${isExpanded ? '' : 'collapsed'}`}
                    onMouseEnter={() => setIsExpanded(true)}
                    onMouseLeave={() => setIsExpanded(false)}
                    style={{
                        width: isExpanded ? '240px' : '80px',
                        transition: 'width 0.3s ease-in-out'
                    }}
                >
                    <div className="sidebar-header">
                        <div className="logo">
                            <span className="logo-icon">F</span>
                            <span className="logo-text" style={{
                                opacity: isExpanded ? 1 : 0,
                                transition: 'opacity 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}>FIRA Admin</span>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                end={item.path === '/'}
                                title={!isExpanded ? item.label : undefined}
                            >
                                {icons[item.icon]}
                                <span style={{
                                    opacity: isExpanded ? 1 : 0,
                                    transition: 'opacity 0.2s ease',
                                    transitionDelay: isExpanded ? '0.1s' : '0s',
                                    whiteSpace: 'nowrap',
                                    pointerEvents: isExpanded ? 'auto' : 'none'
                                }}>{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    <div className="sidebar-footer">
                        <div className="admin-info">
                            <div className="avatar avatar-sm">A</div>
                            <div style={{
                                opacity: isExpanded ? 1 : 0,
                                transition: 'opacity 0.2s ease',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                            }}>
                                <div className="admin-name">Admin User</div>
                                <div className="admin-role">Super Admin</div>
                            </div>
                        </div>
                        <button className="logout-btn" onClick={onLogout} title={!isExpanded ? 'Logout' : undefined}>
                            {icons.logout}
                            <span style={{
                                opacity: isExpanded ? 1 : 0,
                                transition: 'opacity 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}>Logout</span>
                        </button>
                    </div>
                </aside>
            )}
        </>
    );
}
