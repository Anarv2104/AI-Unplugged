import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { formatEventStatusLabel, sortEventsByState } from '../lib/events';
import { getPublishedEvents } from '../lib/platform';

const filters = ['all', 'Flagship', 'Execution', 'Showcase', 'Opportunity'];

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const selectedType = searchParams.get('type') || 'all';

  useEffect(() => {
    document.title = 'Events - AI Unplugged';
    getPublishedEvents().then((items) => {
      setEvents(items);
      setLoading(false);
    });
  }, []);

  const visibleEvents = useMemo(() => {
    const sorted = sortEventsByState(events);
    return selectedType === 'all' ? sorted : sorted.filter((event) => event.type === selectedType);
  }, [events, selectedType]);

  function setFilter(filter) {
    const nextParams = new URLSearchParams(searchParams);
    if (filter === 'all') nextParams.delete('type');
    else nextParams.set('type', filter);
    setSearchParams(nextParams);
  }

  return (
    <>
      <PageHeader
        label="Events"
        title="Every room"
        accent="we're opening."
        subtitle="Flagship nights. Build rooms. Demo days. Talent exchanges. Filter by format. Click any event to apply."
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 0 }}>
          <div className="filter-pills">
            {filters.map((filter) => (
              <button key={filter} type="button" className={`filter-pill${selectedType === filter ? ' is-active' : ''}`} onClick={() => setFilter(filter)}>
                {filter === 'all' ? 'All' : filter}
              </button>
            ))}
          </div>

          {loading ? <div className="empty-state">Loading events...</div> : null}

          {!loading ? (
            <div className="events-grid-light">
              {visibleEvents.map((event) => (
                <Link className="event-card-light" to={`/event?id=${encodeURIComponent(event.id)}`} data-status={event.derivedStatus} key={event.id}>
                  <p className="event-card-type">{event.type} - {formatEventStatusLabel(event)}</p>
                  <h3>{event.title}</h3>
                  <div className="event-meta">
                    <span>{event.dateDisplay}</span>
                    <span>{event.location}</span>
                  </div>
                  <p>{event.tagline}</p>
                  <span className="event-tag">{event.entry}</span>
                </Link>
              ))}
            </div>
          ) : null}

          {!loading && !visibleEvents.length ? (
            <div className="empty-state" style={{ display: 'block', marginTop: 24 }}>
              No events match this filter yet. Check back soon or <Link to="/apply" style={{ color: 'var(--black)', textDecoration: 'underline' }}>apply to the next one</Link>.
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
