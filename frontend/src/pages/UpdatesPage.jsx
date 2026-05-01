import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { UPDATE_CATEGORIES } from '../lib/defaultContent';
import { getUpdates } from '../lib/platform';

export default function UpdatesPage() {
  const [updates, setUpdates] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    document.title = 'Updates - AI Unplugged';
    getUpdates().then(setUpdates);
  }, []);

  const visible = activeCategory === 'all'
    ? updates
    : updates.filter((item) => item.category === activeCategory);

  return (
    <>
      <PageHeader
        label="Updates"
        title="What the platform"
        accent="is learning."
        subtitle="News, event recaps, AI workflow notes, and practical updates from the rooms we are building."
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 0 }}>
          <div className="filter-pills">
            <button type="button" className={`filter-pill${activeCategory === 'all' ? ' is-active' : ''}`} onClick={() => setActiveCategory('all')}>All</button>
            {UPDATE_CATEGORIES.map((category) => (
              <button key={category} type="button" className={`filter-pill${activeCategory === category ? ' is-active' : ''}`} onClick={() => setActiveCategory(category)}>
                {category}
              </button>
            ))}
          </div>

          <div className="updates-grid">
            {visible.map((update) => (
              <Link className="update-card" to={`/updates/${update.slug}`} key={update.id}>
                <p className="event-card-type">{update.category}</p>
                <h3>{update.title}</h3>
                <p>{update.excerpt}</p>
                <span className="cta-arrow">Open &rarr;</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
