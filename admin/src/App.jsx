import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Venues from './pages/Venues';
import VenueDetail from './pages/VenueDetail';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Brands from './pages/Brands';
import BrandDetail from './pages/BrandDetail';
import Users from './pages/Users';
import Login from './pages/Login';
import './index.css';

const AUTH_KEY = 'fira_admin_auth';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day in milliseconds

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check localStorage on mount for existing valid session
  useEffect(() => {
    const storedAuth = localStorage.getItem(AUTH_KEY);
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth);
        const now = Date.now();

        // Check if token is still valid (not expired)
        if (authData.expiry && now < authData.expiry) {
          setIsAuthenticated(true);
        } else {
          // Token expired, remove it
          localStorage.removeItem(AUTH_KEY);
        }
      } catch {
        // Invalid JSON, remove it
        localStorage.removeItem(AUTH_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const handleLogin = () => {
    // Store auth with expiry time (1 day from now)
    const authData = {
      authenticated: true,
      expiry: Date.now() + TOKEN_EXPIRY_MS,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
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
      <div className="app-container">
        <Sidebar onLogout={handleLogout} />
        <main className="main-content" style={{ marginLeft: '260px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/venues/:id" element={<VenueDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/brands/:id" element={<BrandDetail />} />
            <Route path="/users" element={<Users />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
