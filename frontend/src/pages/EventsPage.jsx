import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { sortEventsByState } from '../lib/events';
import { getPublishedEvents } from '../lib/platform';
import SEO from '../components/SEO';

const filters = ['all', 'Flagship', 'Execution', 'Showcase', 'Opportunity'];

function EventSkeleton() {
  return (
    <div className="event-card-light event-card-skeleton" aria-hidden="true">
      <div className="skeleton-line sm" />
      <div className="skeleton-line md" style={{ marginTop: 10 }} />
      <div className="skeleton-line sm" style={{ marginTop: 8 }} />
      <div className="skeleton-line lg" style={{ marginTop: 16 }} />
      <div className="skeleton-line lg" />
      <div className="skeleton-line sm" style={{ marginTop: 20 }} />
    </div>
  );
}

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const selectedType = searchParams.get('type') || 'all';

  useEffect(() => {
    getPublishedEvents().then((items) => {
      setEvents(items);
      setLoading(false);
    });
  }, []);

  const visibleEvents = useMemo(() => {
    const sorted = sortEventsByState(events);
    const filtered = selectedType === 'all' ? sorted : sorted.filter((event) => event.type === selectedType);
    return filtered.slice(0, 6);
  }, [events, selectedType]);

  function setFilter(filter) {
    const nextParams = new URLSearchParams(searchParams);
    if (filter === 'all') nextParams.delete('type');
    else nextParams.set('type', filter);
    setSearchParams(nextParams);
  }

  const eventsSchemas = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aiunplugged.club' },
        { '@type': 'ListItem', position: 2, name: 'Events', item: 'https://aiunplugged.club/events' },
      ],
    },
  ];

  return (
    <>
      <SEO
        title="Events"
        description="Browse upcoming and ongoing AI Unplugged sessions — Flagship rooms, Execution sessions, Showcases, and Opportunity events for builders, founders, and practitioners."
        path="/events"
        schemas={eventsSchemas}
      />
      <PageHeader
        label="Events"
        title="Find your next"
        accent="room."
        subtitle="Browse published AI Unplugged sessions, see what is upcoming or ongoing, and move toward the room that matches your current momentum."
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 0 }}>
          <div className="filter-pills">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`filter-pill${selectedType === filter ? ' is-active' : ''}`}
                onClick={() => setFilter(filter)}
              >
                {filter === 'all' ? 'All formats' : filter}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="events-grid-light">
              {[1, 2, 3, 4].map((i) => <EventSkeleton key={i} />)}
            </div>
          ) : (
            <>
              {visibleEvents.length ? (
                <div className="events-grid-light">
                  {visibleEvents.map((event) => (
                    <Link
                      className="event-card-light"
                      to={`/event?id=${encodeURIComponent(event.id)}`}
                      data-status={event.derivedStatus}
                      key={event.id}
                    >
                      <p className="event-card-type">
                        {event.type}
                        {event.derivedStatus === 'past' ? <span className="event-past-badge"> — Past</span> : null}
                        {event.derivedStatus === 'ongoing' ? <span className="event-ongoing-badge"> — Ongoing</span> : null}
                      </p>
                      <h3>{event.title}</h3>
                      <div className="event-meta">
                        {event.dateDisplay ? <span>{event.dateDisplay}</span> : null}
                        {event.location ? <span>{event.location}</span> : null}
                      </div>
                      <p>{event.tagline}</p>
                      <span className="event-tag">{event.entry}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="events-empty-state">
                  <p>No published events match this filter yet. You can still <Link to="/attend">open the attend form</Link>.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
