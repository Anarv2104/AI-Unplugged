import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/useAuth';
import { UPDATE_CATEGORIES } from '../lib/defaultContent';
import { getUpdates } from '../lib/platform';
import { buildUpdatePath } from '../lib/routes';

function getEmptyUpdateCopy(activeCategory) {
  if (activeCategory === 'all') {
    return {
      title: 'No updates are published right now.',
      body: 'The next platform signals, recaps, and notices are being prepared. Check back soon for the latest from AI Unplugged.',
    };
  }

  return {
    title: `No ${activeCategory.toLowerCase()} updates yet.`,
    body: 'This category does not have a live update right now, but the next signal is being lined up. Browse all updates or check back soon.',
  };
}

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
  const emptyCopy = getEmptyUpdateCopy(activeCategory);

  function openUpdate(slug) {
    const updatePath = buildUpdatePath(slug);
    if (updatePath === '/updates') {
      navigate('/updates');
      return;
    }
    if (isAuthenticated) {
      navigate(updatePath);
      return;
    }
    navigate('/login', {
      state: {
        backgroundLocation: location,
        nextPath: updatePath
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
            <div className="events-empty-state">
              <p className="filter-empty-kicker">Signal incoming</p>
              <h2>{emptyCopy.title}</h2>
              <p>{emptyCopy.body}</p>
              {activeCategory !== 'all' ? (
                <div className="filter-empty-actions">
                  <button type="button" className="filter-empty-reset" onClick={() => setActiveCategory('all')}>
                    Browse all updates
                  </button>
                </div>
              ) : null}
            </div>
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
