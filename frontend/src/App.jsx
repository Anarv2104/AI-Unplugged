import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import AuthModal from './components/AuthModal';
import { AuthProvider } from './context/AuthContext';

const AboutPage = lazy(() => import('./pages/AboutPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ApplyPage = lazy(() => import('./pages/ApplyPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const HostPage = lazy(() => import('./pages/HostPage'));
const NodeLeadPage = lazy(() => import('./pages/NodeLeadPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const ThankYouPage = lazy(() => import('./pages/ThankYouPage'));
const UpdateDetailPage = lazy(() => import('./pages/UpdateDetailPage'));
const UpdatesPage = lazy(() => import('./pages/UpdatesPage'));

function LegacyApplyRedirect() {
  const location = useLocation();
  return <Navigate to={`/attend${location.search}`} replace />;
}

function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (['/login', '/signup'].includes(location.pathname)) return;
    if (location.hash) {
      const id = location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.search, location.hash]);

  return null;
}

function AppRoutes() {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup';
  const backgroundLocation = isAuthRoute ? location.state?.backgroundLocation : null;
  const routedLocation = backgroundLocation || (isAuthRoute ? { ...location, pathname: '/' } : location);

  return (
    <>
      <ScrollManager />
      <Suspense fallback={null}>
        <Routes location={routedLocation}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/event" element={<EventDetailPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/attend" element={<ApplyPage />} />
            <Route path="/apply" element={<LegacyApplyRedirect />} />
            <Route path="/become-a-host" element={<HostPage />} />
            <Route path="/node-lead" element={<NodeLeadPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/thank-you" element={<ThankYouPage />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/updates/:slug" element={<UpdateDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/events.html" element={<Navigate to="/events" replace />} />
          <Route path="/event.html" element={<Navigate to="/event" replace />} />
          <Route path="/resources.html" element={<Navigate to="/resources" replace />} />
          <Route path="/apply.html" element={<LegacyApplyRedirect />} />
          <Route path="/become-a-host.html" element={<Navigate to="/become-a-host" replace />} />
          <Route path="/node-lead.html" element={<Navigate to="/node-lead" replace />} />
          <Route path="/about.html" element={<Navigate to="/about" replace />} />
          <Route path="/thank-you.html" element={<Navigate to="/thank-you" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {isAuthRoute ? <AuthModal mode={location.pathname === '/signup' ? 'signup' : 'login'} /> : null}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
