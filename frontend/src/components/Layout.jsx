import { Outlet, useLocation } from 'react-router-dom';
import EcosystemBar from './EcosystemBar';
import Footer from './Footer';
import Nav from './Nav';

export default function Layout() {
  const location = useLocation();
  const isBlurred = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div className={`site-shell${isBlurred ? ' is-auth-blurred' : ''}`}>
      <Nav />
      <main>
        <Outlet />
      </main>
      <EcosystemBar />
      <Footer />
    </div>
  );
}
