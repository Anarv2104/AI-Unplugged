import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { updateNewsletterPreference } from '../lib/platform';
import SEO from '../components/SEO';

export default function ProfilePage() {
  const { isAuthenticated, loading, profile, user, isAdmin, refreshProfile } = useAuth();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  async function handleNewsletterChange(subscribed) {
    setPending(true);
    setMessage('');
    try {
      await updateNewsletterPreference(subscribed);
      await refreshProfile?.();
      setMessageType('success');
      setMessage(subscribed ? 'Newsletter subscription enabled.' : 'Newsletter subscription paused.');
    } catch (error) {
      setMessageType('error');
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

  const displayName = profile?.displayName || user?.displayName || 'Member';
  const email = user?.email || 'No email connected';
  const role = profile?.role || 'user';
  const newsletterSubscribed = Boolean(profile?.newsletterSubscribed);
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AI';

  return (
    <section className="section-wrap profile-wrap">
      <SEO title="Profile" noIndex={true} />
      <div className="profile-card">
        <div className="profile-hero">
          <div className="profile-avatar" aria-hidden="true">{initials}</div>
          <div>
            <p className="section-label">Profile</p>
            <h2>{displayName}</h2>
            <p className="page-sub">Your account details and platform email controls.</p>
          </div>
        </div>

        <div className="profile-info-grid">
          <div className="profile-info-card">
            <span>Email</span>
            <strong>{email}</strong>
            <p>Used for login, event updates, and account communication.</p>
          </div>
          <div className="profile-info-card">
            <span>Role</span>
            <strong>{role}</strong>
            <p>Your current access level across AI Unplugged.</p>
          </div>
          <div className="profile-info-card">
            <span>Newsletter</span>
            <strong className={newsletterSubscribed ? 'profile-status is-active' : 'profile-status'}>
              {newsletterSubscribed ? 'Subscribed' : 'Paused'}
            </strong>
            <p>{newsletterSubscribed ? 'You will receive platform emails and newsletters.' : 'Newsletter emails are currently paused.'}</p>
          </div>
        </div>

        <div className="profile-newsletter-panel">
          <div>
            <p className="section-label">Email preferences</p>
            <h3>{newsletterSubscribed ? 'Keep receiving platform signal.' : 'Newsletter is paused.'}</h3>
            <p>Change whether newsletters and platform emails keep reaching this inbox. Account-critical messages may still be sent when needed.</p>
          </div>
          <div className="profile-actions">
            {newsletterSubscribed ? (
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => handleNewsletterChange(false)}>
                {pending ? 'Updating...' : 'Unsubscribe'}
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={pending} onClick={() => handleNewsletterChange(true)}>
                {pending ? 'Updating...' : 'Resubscribe'}
              </button>
            )}
          </div>
        </div>
        {message ? <div className={`profile-message ${messageType === 'error' ? 'is-error' : 'is-success'}`}>{message}</div> : null}
      </div>
    </section>
  );
}
