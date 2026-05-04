import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { updateNewsletterPreference } from '../lib/platform';
import SEO from '../components/SEO';

export default function ProfilePage() {
  const { isAuthenticated, loading, profile, user, isAdmin, refreshProfile } = useAuth();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function handleNewsletterChange(subscribed) {
    setPending(true);
    setMessage('');
    try {
      await updateNewsletterPreference(subscribed);
      await refreshProfile?.();
      setMessage(subscribed ? 'Newsletter subscription enabled.' : 'Newsletter subscription paused.');
    } catch (error) {
      setMessage(error?.message || 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className="page-header"><p className="page-sub">Loading profile...</p></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="page-header">
        <p className="section-label">Profile</p>
        <h1>Log in to manage your settings.</h1>
        <p className="page-sub">Your account details and newsletter settings live here.</p>
      </div>
    );
  }

  if (isAdmin) {
    return <Navigate to="/admin?tab=profile" replace />;
  }

  return (
    <section className="section-wrap profile-wrap">
      <SEO title="Profile" noIndex={true} />
      <div className="dashboard-card profile-card">
        <p className="section-label">Profile</p>
        <h2>{profile?.displayName || user?.displayName || 'Member'}</h2>
        <p className="page-sub">Your account details and newsletter controls.</p>
        <div className="admin-kv-list">
          <div className="detail-row"><span className="label">Email</span><span className="val">{user?.email}</span></div>
          <div className="detail-row"><span className="label">Role</span><span className="val">{profile?.role || 'user'}</span></div>
          <div className="detail-row"><span className="label">Newsletter</span><span className="val">{profile?.newsletterSubscribed ? 'Subscribed' : 'Unsubscribed'}</span></div>
        </div>
        <p className="page-sub profile-note">Change whether platform emails and newsletters keep reaching you.</p>
        <div className="admin-quick-actions profile-actions">
          {profile?.newsletterSubscribed ? (
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => handleNewsletterChange(false)}>
              Unsubscribe
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={pending} onClick={() => handleNewsletterChange(true)}>
              Resubscribe
            </button>
          )}
        </div>
        {message ? <div className="auth-success" style={{ marginTop: 16 }}>{message}</div> : null}
      </div>
    </section>
  );
}
