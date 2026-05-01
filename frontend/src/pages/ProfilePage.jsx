import { useEffect } from 'react';
import { useAuth } from '../context/useAuth';

export default function ProfilePage() {
  const { isAuthenticated, loading, profile, user, isAdmin } = useAuth();

  useEffect(() => {
    document.title = 'Profile - AI Unplugged';
  }, []);

  if (loading) {
    return <div className="page-header"><p className="page-sub">Loading profile...</p></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="page-header">
        <p className="section-label">Profile</p>
        <h1>Log in to see your platform profile.</h1>
        <p className="page-sub">Your account settings appear here once you sign in. Your dashboard is separate.</p>
      </div>
    );
  }

  return (
    <section className="section-wrap profile-wrap">
      <div className="dashboard-card">
        <p className="section-label">Profile</p>
        <h2>{profile?.displayName || user?.displayName || 'Member'}</h2>
        <div className="admin-kv-list">
          <div className="detail-row"><span className="label">Email</span><span className="val">{user?.email}</span></div>
          <div className="detail-row"><span className="label">Role</span><span className="val">{isAdmin ? 'admin' : profile?.role || 'user'}</span></div>
          <div className="detail-row"><span className="label">Newsletter</span><span className="val">{profile?.newsletterSubscribed ? 'subscribed' : 'not set'}</span></div>
        </div>
      </div>
    </section>
  );
}
