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
  const { isAuthenticated, isAdmin, logout } = useAuth();
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
          <img src="/AIUNPLUGGED-transparent.svg" alt="" className="nav-logo-mark" width="38" height="39" />
        </span>
        <span className="nav-logo-wordmark">UNPLUGGED</span>
      </NavLink>

      <button
        type="button"
        className={`nav-hamburger${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen((current) => !current)}
        aria-label="Toggle menu"
      >
        <span /><span /><span />
      </button>

      <div className={`nav-links${mobileOpen ? ' is-open' : ''}`}>
        <NavLink to="/events" className={(args) => navClass(args)} end>
          Events
        </NavLink>
        <NavLink to="/updates" className={(args) => navClass(args)} end>
          Updates
        </NavLink>
        <NavLink to="/resources" className={(args) => navClass(args)} end>
          Resources
        </NavLink>

        {isAuthenticated ? (
          <>
            {!isAdmin ? (
              <>
                <NavLink to="/dashboard" className={(args) => navClass(args)} end>
                  Dashboard
                </NavLink>
                <NavLink to="/profile" className={(args) => navClass(args)} end>
                  <span className="nav-profile-link">
                    <span className="nav-profile-icon" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    Profile
                  </span>
                </NavLink>
              </>
            ) : null}
            {isAdmin ? (
              <NavLink to="/admin" className={(args) => navClass(args, 'nav-admin-link')} end>
                Admin
              </NavLink>
            ) : null}
            <button type="button" className="nav-cta nav-button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <button type="button" className="nav-inline-button" onClick={() => openAuth('login')}>
              Log In
            </button>
            <button type="button" className="nav-cta nav-button" onClick={() => openAuth('signup')}>
              Join
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
