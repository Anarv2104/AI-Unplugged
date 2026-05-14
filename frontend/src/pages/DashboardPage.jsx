import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getMemberDashboard } from '../lib/platform';
import { buildUpdatePath } from '../lib/routes';
import SEO from '../components/SEO';

const UPDATE_KIND_LABELS = {
  recap: 'Recap',
  newsletter: 'Newsletter',
  event: 'Event update',
  general: 'General update',
  update: 'Platform update'
};

function humanizeUpdateKind(item) {
  if (item.scope === 'event') return 'Event update';
  return UPDATE_KIND_LABELS[item.category] || item.category || 'General update';
}

function FeedItem({ item, emphasis = 'default' }) {
  return (
    <Link className={`dashboard-feed-item${emphasis === 'highlight' ? ' is-highlight' : ''}`} to={buildUpdatePath(item.slug)}>
      <div className="dashboard-feed-copy">
        <span className="dashboard-feed-kicker">{humanizeUpdateKind(item)}</span>
        <strong>{item.title}</strong>
        <p>{item.excerpt || item.eventTitle || ''}</p>
      </div>
      <span className="dashboard-feed-link">Open</span>
    </Link>
  );
}

function renderDashboardTitle(name) {
  const cleanedName = String(name || '').trim();
  if (!cleanedName) return 'Your dashboard';
  return cleanedName.endsWith('s') ? `${cleanedName}' dashboard` : `${cleanedName}'s dashboard`;
}

export default function DashboardPage() {
  const { isAuthenticated, loading, profile, user } = useAuth();
  const [data, setData] = useState({ registrations: [], recentUpdates: [], missed: [], eventUpdates: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    getMemberDashboard()
      .then(setData)
      .catch((nextError) => setError(nextError?.message || 'Could not load dashboard.'));
  }, [isAuthenticated]);

  const summary = useMemo(() => ([
    {
      title: 'Registrations',
      value: data.registrations.length,
      caption: data.registrations.length === 1 ? '1 event on your plate right now.' : `${data.registrations.length} event registrations in motion.`
    },
    {
      title: 'Recent updates',
      value: data.recentUpdates.length,
      caption: data.recentUpdates.length === 1 ? '1 fresh signal from the platform.' : `${data.recentUpdates.length} recent posts worth scanning.`
    },
    {
      title: 'Missed recaps',
      value: data.missed.length,
      caption: data.missed.length === 1 ? '1 room recap waiting for you.' : `${data.missed.length} recaps you can catch up on.`
    }
  ]), [data]);

  if (loading) {
    return <div className="page-header"><p className="page-sub">Loading your workspace...</p></div>;
  }

  if (!isAuthenticated) {
    return <div className="page-header"><h1>Log in to view your dashboard.</h1><p className="page-sub">Your events, updates, and recaps live here once you are signed in.</p></div>;
  }

  const dashboardTitle = renderDashboardTitle(profile?.displayName || user?.displayName);

  return (
    <section className="section-wrap dashboard-shell">
      <SEO title="Dashboard" noIndex={true} />
      <div className="page-header dashboard-head">
        <p className="section-label">Dashboard</p>
        <h1>{dashboardTitle}</h1>
        <p className="page-sub">Your events, the latest platform signal, and the recaps you may have missed.</p>
      </div>

      {error ? <div className="form-status-message" role="alert">{error}</div> : null}

      <div className="dashboard-summary-grid">
        {summary.map((card) => (
          <article className="dashboard-summary-card" key={card.title}>
            <span className="dashboard-summary-label">{card.title}</span>
            <strong>{card.value}</strong>
            <p>{card.caption}</p>
          </article>
        ))}
      </div>

      <div className="dashboard-main-grid">
        <section className="dashboard-panel dashboard-panel-wide">
          <div className="dashboard-panel-head">
            <div>
              <p className="section-label">Registered events</p>
              <h3>Where you are already in the room</h3>
            </div>
            <Link to="/events" className="auth-link">Browse all events</Link>
          </div>
          <div className="dashboard-registration-stack">
            {data.registrations.length ? data.registrations.map((item) => (
              <article className="dashboard-registration-card" key={item.id}>
                <div>
                  <strong>{item.eventTitle}</strong>
                  <p>Registration ID: {item.registrationId || '—'}</p>
                </div>
                <span className="dashboard-status-pill">{item.reviewStatus || 'pending'}</span>
              </article>
            )) : <div className="empty-state">No registrations yet. Join an event to start building your trail here.</div>}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="section-label">Recent updates</p>
              <h3>What just moved</h3>
            </div>
            <Link to="/updates" className="auth-link">View all updates</Link>
          </div>
          <div className="dashboard-feed-list">
            {data.recentUpdates.length ? data.recentUpdates.map((item) => <FeedItem item={item} key={item.id} />) : <div className="empty-state">No recent updates yet.</div>}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="section-label">Missed recaps</p>
              <h3>Catch up quickly</h3>
            </div>
          </div>
          <div className="dashboard-feed-list">
            {data.missed.length ? data.missed.map((item) => <FeedItem item={item} key={item.id} emphasis="highlight" />) : <div className="empty-state">No missed recaps right now.</div>}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="section-label">From your events</p>
              <h3>Next steps from rooms you joined</h3>
            </div>
          </div>
          <div className="dashboard-feed-list">
            {data.eventUpdates.length ? data.eventUpdates.map((item) => <FeedItem item={item} key={item.id} />) : <div className="empty-state">No event-specific updates yet.</div>}
          </div>
        </section>

        <section className="dashboard-panel dashboard-panel-actions">
          <div className="dashboard-panel-head">
            <div>
              <p className="section-label">Get involved</p>
              <h3>Push your role further</h3>
            </div>
          </div>
          <p className="page-sub">Want to host a room or grow a stronger local node? These are the next two doors worth opening.</p>
          <div className="dashboard-cta-row">
            <Link to="/become-a-host" className="btn-secondary">Become a Host</Link>
            <Link to="/node-lead" className="btn-primary">Apply as Node Lead</Link>
          </div>
        </section>
      </div>
    </section>
  );
}
