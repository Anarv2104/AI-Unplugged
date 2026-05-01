import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

function navClass({ isActive }, extra = '') {
  const parts = [extra];
  if (isActive) parts.push('nav-active');
  return parts.filter(Boolean).join(' ');
}

export default function Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, isAdmin, profile, logout } = useAuth();
  const isHome = location.pathname === '/';
  const homeTarget = isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/';

  function openAuth(mode) {
    setMobileOpen(false);
    navigate(`/${mode}`, { state: { backgroundLocation: location } });
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  async function handleLogout() {
    setMobileOpen(false);
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <nav>
      <NavLink to={homeTarget} className="nav-logo">
        <span className="nav-logo-mark-frame" aria-hidden="true">
          <img src="/AI%20UP.png" alt="" className="nav-logo-mark" />
        </span>
        <span className="nav-logo-wordmark">UNPLUGGED</span>
      </NavLink>
      <button type="button" className={`nav-hamburger${mobileOpen ? ' is-open' : ''}`} onClick={() => setMobileOpen((current) => !current)} aria-label="Toggle navigation">
        <span />
        <span />
        <span />
      </button>
      <div className={`nav-links${mobileOpen ? ' is-open' : ''}`}>
        <NavLink to="/events" className={(args) => navClass(args)} end>
          Events
        </NavLink>
        <NavLink to="/updates" className={(args) => navClass(args)} end>
          Updates
        </NavLink>
        {!isAuthenticated ? <a href="/#value" className={isHome ? 'nav-active' : ''}>Why Join</a> : null}
        <NavLink to="/become-a-host" className={(args) => navClass(args)} end>
          Become a Host
        </NavLink>
        <NavLink to="/node-lead" className={(args) => navClass(args)} end>
          Node Lead
        </NavLink>
        {isAuthenticated ? (
          <>
            <NavLink to="/dashboard" className={(args) => navClass(args)} end>
              Dashboard
            </NavLink>
            <NavLink to="/profile" className={(args) => navClass(args)} end>
              {profile?.displayName || 'Profile'}
            </NavLink>
            {isAdmin ? (
              <NavLink to="/admin" className={(args) => navClass(args)} end>
                Admin
              </NavLink>
            ) : null}
            <button type="button" className="nav-cta nav-button" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <button type="button" className="nav-inline-button" onClick={() => openAuth('login')}>Log In</button>
            <button type="button" className="nav-cta nav-button" onClick={() => openAuth('signup')}>Join Platform</button>
          </>
        )}
      </div>
    </nav>
  );
}
