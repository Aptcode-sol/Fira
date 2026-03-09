import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

const navItems = [
    { href: '/', icon: 'home', label: 'Dashboard' },
    { href: '/venues', icon: 'building', label: 'Venues' },
    { href: '/events', icon: 'ticket', label: 'Events' },
    { href: '/brands', icon: 'star', label: 'Brands' }, // User used 'star' icon logic? Need to check.
    { href: '/users', icon: 'users', label: 'Users' },
];

export default function AdminDashboardLayout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isExpanded, setIsExpanded] = useState(() => {
        const saved = localStorage.getItem('admin_sidebar_expanded');
        return saved === 'true';
    });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Load user from localStorage
    useEffect(() => {
        const storedAuth = localStorage.getItem('fira_admin_auth');
        if (storedAuth) {
            try {
                // In a real app we might store user details here. 
                // For now, hardcode Admin.
                setUser({ name: 'Admin User', email: 'admin@fira.com' });
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    // Track screen size
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
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

    // Persist sidebar state
    useEffect(() => {
        localStorage.setItem('admin_sidebar_expanded', String(isExpanded));
    }, [isExpanded]);

    const handleLogout = () => {
        if (props.onLogout) {
            props.onLogout();
        } else {
            localStorage.removeItem('fira_admin_auth');
            window.location.reload();
        }
    };

    const getIcon = (name) => {
        const icons = {
            'home': (
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
            'building': (
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            'ticket': (
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
            ),
            'star': (
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
            ),
            'users': (
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
            'cog': (
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        };
        return icons[name] || null;
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex relative">
            {/* Dark background */}
            <div className="party-bg"></div>

            {/* Party Light Rays */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-0 left-1/2 w-[300px] h-[120vh] origin-top -translate-x-1/2 rotate-[-55deg] bg-gradient-to-b from-red-500/25 via-red-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[250px] h-[110vh] origin-top -translate-x-1/2 rotate-[-35deg] bg-gradient-to-b from-orange-500/20 via-orange-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[200px] h-[100vh] origin-top -translate-x-1/2 rotate-[-18deg] bg-gradient-to-b from-yellow-400/18 via-yellow-400/3 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[180px] h-[95vh] origin-top -translate-x-1/2 rotate-[-5deg] bg-gradient-to-b from-emerald-400/15 via-emerald-400/3 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[200px] h-[100vh] origin-top -translate-x-1/2 rotate-[8deg] bg-gradient-to-b from-blue-500/18 via-blue-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[250px] h-[110vh] origin-top -translate-x-1/2 rotate-[25deg] bg-gradient-to-b from-violet-500/22 via-violet-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[280px] h-[115vh] origin-top -translate-x-1/2 rotate-[42deg] bg-gradient-to-b from-pink-500/20 via-pink-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 w-[300px] h-[120vh] origin-top -translate-x-1/2 rotate-[58deg] bg-gradient-to-b from-fuchsia-500/25 via-fuchsia-500/5 to-transparent blur-2xl"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-gradient-to-b from-white/20 via-white/3 to-transparent blur-3xl"></div>
            </div>

            {/* Sidebar - slim icon-only on mobile, expandable on desktop */}
            <aside
                onMouseEnter={() => { if (!isMobile) setIsExpanded(true); }}
                onMouseLeave={() => { if (!isMobile) setIsExpanded(false); }}
                className={`fixed left-0 top-0 h-full bg-black/60 backdrop-blur-xl border-r border-white/[0.08] z-30 flex flex-col shadow-[0_0_60px_rgba(168,85,247,0.1)] transition-all duration-300 ease-in-out ${!isMobile && isExpanded ? 'w-64' : 'w-[68px] lg:w-20'}`}
            >
                {/* Logo */}
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-center h-20">
                    <Link href="/" className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
                            <img src={logo} alt="Fira Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className={`text-[10px] text-gray-400 font-medium tracking-wider uppercase transition-all duration-200 mt-1 ${isExpanded ? 'opacity-100' : 'opacity-100'}`}>
                            Admin
                        </span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-2 lg:p-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`flex items-center gap-3 px-3 py-3.5 lg:py-3 rounded-xl transition-all duration-300 overflow-hidden ${isActive
                                    ? 'bg-white text-black shadow-lg shadow-white/10'
                                    : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                    } ${!isMobile && isExpanded ? '' : 'justify-center'}`}
                                title={!((!isMobile) && isExpanded) ? item.label : undefined}
                            >
                                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                                    {getIcon(item.icon)}
                                </span>
                                {!isMobile && isExpanded && (
                                    <span className="font-medium whitespace-nowrap">
                                        {item.label}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-2 lg:p-3 border-t border-white/[0.08] bg-black/20">
                    {/* User avatar */}
                    <div className={`flex items-center gap-3 px-2 lg:px-3 py-2 lg:py-3 ${!isMobile && isExpanded ? '' : 'justify-center'}`}>
                        <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium shadow-lg shadow-violet-500/25 flex-shrink-0">
                            A
                        </div>
                        {!isMobile && isExpanded && (
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white truncate break-words">{user?.name || 'Admin'}</div>
                                <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                            </div>
                        )}
                    </div>
                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 px-2 lg:px-3 py-2.5 mt-1 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-300 ${!isMobile && isExpanded ? '' : 'justify-center'}`}
                        title="Sign Out"
                    >
                        <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {!isMobile && isExpanded && (
                            <span className="font-medium whitespace-nowrap">Sign Out</span>
                        )}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 min-h-screen relative z-10 pt-4 pb-20 lg:pb-0 transition-all duration-300 ${!isMobile && isExpanded ? 'ml-64' : 'ml-[68px] lg:ml-20'}`}>
                {children}
            </main>
        </div>
    );
}
