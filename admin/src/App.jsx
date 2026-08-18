import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboardLayout from './components/AdminDashboardLayout';
import ErrorBoundary from './components/ErrorBoundary';
import adminApi, { ADMIN_TOKEN_KEY } from './api/adminApi';
import './index.css';

// ponytail: lazy-load all pages — framer-motion stays out of initial chunk
// Retry wrapper handles chunk load failures (e.g. new deploy while user has stale tab)
function lazyWithRetry(importFn) {
  return lazy(() => retryImport(importFn));
}

function retryImport(importFn, retries = 2, delay = 500) {
  return importFn().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
      retryImport(importFn, retries - 1, delay)
    );
  });
}

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Venues = lazyWithRetry(() => import('./pages/Venues'));
const VenueDetail = lazyWithRetry(() => import('./pages/VenueDetail'));
const Events = lazyWithRetry(() => import('./pages/Events'));
const EventDetail = lazyWithRetry(() => import('./pages/EventDetail'));
const Brands = lazyWithRetry(() => import('./pages/Brands'));
const BrandDetail = lazyWithRetry(() => import('./pages/BrandDetail'));
const Users = lazyWithRetry(() => import('./pages/Users'));
const UserDetail = lazyWithRetry(() => import('./pages/UserDetail'));
const AuditTrail = lazyWithRetry(() => import('./pages/AuditTrail'));
const DiscountCodes = lazyWithRetry(() => import('./pages/DiscountCodes'));
const Login = lazyWithRetry(() => import('./pages/Login'));

// Loading fallback — renders within 100ms of navigation (Suspense triggers immediately)
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-gray-300 text-sm">Loading…</span>
      </div>
    </div>
  );
}

const AUTH_KEY = 'fira_admin_auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Restore a session on mount.
   *
   * The session is now the JWT itself - previously this was a self-declared
   * `{authenticated: true}` flag with a client-chosen expiry, which anyone
   * could write into localStorage by hand to "log in". The real gate is
   * server-side; this only decides which screen to show.
   */
  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    const storedAuth = localStorage.getItem(AUTH_KEY);

    if (token && storedAuth) {
      try {
        JSON.parse(storedAuth);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    } else {
      // One without the other is a half-session (e.g. left over from the old
      // hardcoded login) - clear both so the user gets a clean sign-in.
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = ({ user }) => {
    // adminApi.login already stored the token.
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      name: user?.name,
      email: user?.email,
      role: user?.role,
      adminRole: user?.adminRole || null,
      loginTime: new Date().toISOString(),
    }));
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    adminApi.logout();
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  // Show nothing while checking auth status
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0a0a0a',
        color: '#fff'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="*" element={<Login onLogin={handleLogin} />} />
          </Routes>
        </Suspense>
      </Router>
    );
  }

  return (
    <Router>
      <AdminDashboardLayout onLogout={handleLogout}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<ErrorBoundary fallbackMessage="Failed to load Dashboard."><Dashboard /></ErrorBoundary>} />
            <Route path="/venues" element={<ErrorBoundary fallbackMessage="Failed to load Venues."><Venues /></ErrorBoundary>} />
            <Route path="/venues/:id" element={<ErrorBoundary fallbackMessage="Failed to load Venue details."><VenueDetail /></ErrorBoundary>} />
            <Route path="/events" element={<ErrorBoundary fallbackMessage="Failed to load Events."><Events /></ErrorBoundary>} />
            <Route path="/events/:id" element={<ErrorBoundary fallbackMessage="Failed to load Event details."><EventDetail /></ErrorBoundary>} />
            <Route path="/brands" element={<ErrorBoundary fallbackMessage="Failed to load Brands."><Brands /></ErrorBoundary>} />
            <Route path="/brands/:id" element={<ErrorBoundary fallbackMessage="Failed to load Brand details."><BrandDetail /></ErrorBoundary>} />
            <Route path="/users" element={<ErrorBoundary fallbackMessage="Failed to load Users."><Users /></ErrorBoundary>} />
            <Route path="/users/:id" element={<ErrorBoundary fallbackMessage="Failed to load User details."><UserDetail /></ErrorBoundary>} />
            <Route path="/audit-trail" element={<ErrorBoundary fallbackMessage="Failed to load Audit Trail."><AuditTrail /></ErrorBoundary>} />
            <Route path="/discount-codes" element={<ErrorBoundary fallbackMessage="Failed to load Discount Codes."><DiscountCodes /></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </AdminDashboardLayout>
    </Router>
  );
}

export default App;
