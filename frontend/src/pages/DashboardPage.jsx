import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getMemberDashboard } from '../lib/platform';

export default function DashboardPage() {
  const { isAuthenticated, loading, profile } = useAuth();
  const [data, setData] = useState({ registrations: [], recentUpdates: [], missed: [], eventUpdates: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Dashboard - AI Unplugged';
    if (!isAuthenticated) return;
    getMemberDashboard()
      .then(setData)
      .catch((nextError) => setError(nextError?.message || 'Could not load dashboard.'));
  }, [isAuthenticated]);

  if (loading) {
    return <div className="page-header"><p className="page-sub">Loading your dashboard...</p></div>;
  }

  if (!isAuthenticated) {
    return <div className="page-header"><h1>Log in to see your dashboard.</h1><p className="page-sub">Your events and member updates appear here once you sign in.</p></div>;
  }

  return (
    <section className="section-wrap profile-wrap">
      <div className="page-header dashboard-head">
        <p className="section-label">Dashboard</p>
        <h1>{profile?.displayName || 'Member'} dashboard.</h1>
        <p className="page-sub">Your events, the latest platform signal, and the recaps you may have missed.</p>
      </div>

      {error ? <div className="form-error" style={{ display: 'block' }}>{error}</div> : null}

      <div className="admin-grid">
        <div className="dashboard-card"><h3>Registered events</h3><p>{data.registrations.length} registrations linked to your account</p></div>
        <div className="dashboard-card"><h3>Recent updates</h3><p>{data.recentUpdates.length} recent posts selected for members</p></div>
        <div className="dashboard-card"><h3>What you missed</h3><p>{data.missed.length} recap-style updates to catch up on</p></div>
      </div>

      <div className="admin-section">
        <div className="dashboard-card">
          <h3>Events you joined</h3>
          <div className="admin-list">
            {data.registrations.map((item) => (
              <div className="admin-list-row" key={item.id}>
                <div>
                  <strong>{item.eventTitle}</strong>
                  <p>{item.registrationId || 'Registration linked'}</p>
                </div>
                <span>{item.reviewStatus || 'pending'}</span>
              </div>
            ))}
            {!data.registrations.length ? <div className="empty-state">No event registrations yet.</div> : null}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Recent updates</h3>
          <div className="admin-list">
            {data.recentUpdates.map((item) => (
              <Link className="admin-list-row" to={`/updates/${item.slug}`} key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.excerpt}</p>
                </div>
                <span>{item.category}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>What you missed</h3>
          <div className="admin-list">
            {data.missed.map((item) => (
              <Link className="admin-list-row" to={`/updates/${item.slug}`} key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.excerpt}</p>
                </div>
                <span>{item.scope === 'event' ? 'event update' : item.category}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>From your events</h3>
          <div className="admin-list">
            {data.eventUpdates.map((item) => (
              <Link className="admin-list-row" to={`/updates/${item.slug}`} key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.eventTitle || item.excerpt}</p>
                </div>
                <span>{item.eventTitle ? 'event-specific' : item.category}</span>
              </Link>
            ))}
            {!data.eventUpdates.length ? <div className="empty-state">No event-specific updates yet.</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
