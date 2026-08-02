import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboardLayout from './components/AdminDashboardLayout';
import Dashboard from './pages/Dashboard';
import Venues from './pages/Venues';
import VenueDetail from './pages/VenueDetail';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Brands from './pages/Brands';
import BrandDetail from './pages/BrandDetail';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Login from './pages/Login';
import adminApi, { ADMIN_TOKEN_KEY } from './api/adminApi';
import './index.css';

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
        <Routes>
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <AdminDashboardLayout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/venues" element={<Venues />} />
          <Route path="/venues/:id" element={<VenueDetail />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/brands/:id" element={<BrandDetail />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AdminDashboardLayout>
    </Router>
  );
}

export default App;
