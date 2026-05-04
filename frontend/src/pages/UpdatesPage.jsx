import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/useAuth';
import { UPDATE_CATEGORIES } from '../lib/defaultContent';
import { getUpdates } from '../lib/platform';

export default function UpdatesPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [updates, setUpdates] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Updates - AI Unplugged';
    getUpdates().then((items) => {
      setUpdates(items);
      setLoading(false);
    });
  }, []);

  const visible = activeCategory === 'all'
    ? updates
    : updates.filter((item) => item.category === activeCategory);

  function openUpdate(slug) {
    if (isAuthenticated) {
      navigate(`/updates/${slug}`);
      return;
    }
    navigate('/login', {
      state: {
        backgroundLocation: location,
        nextPath: `/updates/${slug}`
      }
    });
  }

  return (
    <>
      <PageHeader
        label="Updates"
        title="Platform"
        accent="updates."
        subtitle="Recaps, event notices, and signal from inside the ecosystem."
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 0 }}>
          <div className="filter-pills">
            <button type="button" className={`filter-pill${activeCategory === 'all' ? ' is-active' : ''}`} onClick={() => setActiveCategory('all')}>
              All updates
            </button>
            {UPDATE_CATEGORIES.map((category) => (
              <button key={category} type="button" className={`filter-pill${activeCategory === category ? ' is-active' : ''}`} onClick={() => setActiveCategory(category)}>
                {category}
              </button>
            ))}
          </div>

          {loading ? <div className="empty-state">Loading updates...</div> : null}

          {!loading && !visible.length ? (
            <div className="empty-state">No updates yet.</div>
          ) : null}

          {!loading && visible.length ? (
            <div className="updates-grid">
              {visible.map((update) => (
                <button
                  type="button"
                  className="update-card update-card-button"
                  key={update.id}
                  onClick={() => openUpdate(update.slug)}
                >
                  <p className="event-card-type">{update.category}</p>
                  <h3>{update.title}</h3>
                  <p>{update.excerpt}</p>
                  <span className="cta-arrow">Open &rarr;</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
