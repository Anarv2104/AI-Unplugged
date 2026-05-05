import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getEventStatus } from '../lib/events';
import { getEventById } from '../lib/platform';
import { useAuth } from '../context/useAuth';
import SEO from '../components/SEO';

function toSafeIsoDate(date, time = '') {
  if (!date) return null;
  const raw = time ? `${date}T${time}` : date;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default function EventDetailPage() {
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState(undefined);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const id = searchParams.get('id');

  useEffect(() => {
    let active = true;
    getEventById(id)
      .then((nextEvent) => {
        if (active) setEvent(nextEvent);
      })
      .catch(() => {
        if (active) setEvent(null);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (event === undefined) {
    return <div className="page-header"><p className="page-sub">Loading event...</p></div>;
  }

  if (!event) {
    return (
      <div>
        <header className="page-header">
          <p className="section-label">404</p>
          <h1>Event not found</h1>
          <p className="page-sub">That event either does not exist yet or has not been published.</p>
          <div style={{ marginTop: 28 }}>
            <Link to="/events" className="btn-primary">
              See all events <span className="btn-arrow">&rarr;</span>
            </Link>
          </div>
        </header>
      </div>
    );
  }

  function openRegistrationGate() {
    if (isAuthenticated) {
      navigate(`/attend?event=${encodeURIComponent(event.id)}`);
      return;
    }
    navigate('/signup', { state: { backgroundLocation: location, nextPath: `/attend?event=${encodeURIComponent(event.id)}` } });
  }

  const eventStatus = getEventStatus(event || {});
  const eventPath = `/event?id=${encodeURIComponent(event.id)}`;
  const startDate = event.startTime ? toSafeIsoDate(event.date, event.startTime) : toSafeIsoDate(event.date);
  const endDate = event.endTime ? toSafeIsoDate(event.date, event.endTime) : null;
  const descriptionParagraphs = Array.isArray(event.description) ? event.description.filter(Boolean) : [];
  const eventDescription = descriptionParagraphs.join(' ');
  const agendaItems = Array.isArray(event.agenda) ? event.agenda.filter((item) => item?.time || item?.item) : [];
  const speakers = Array.isArray(event.speakers) ? event.speakers.filter((speaker) => speaker?.name || speaker?.role) : [];
  const aboutCopy = descriptionParagraphs.length ? descriptionParagraphs : (event.tagline ? [event.tagline] : []);

  const eventSchemas = [
    {
      '@type': 'Event',
      name: event.title,
      description: eventDescription || `${event.type} event hosted by AI Unplugged.`,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: event.location || 'TBA',
        address: event.mapAddress || event.location || 'TBA',
      },
      organizer: {
        '@type': 'Organization',
        name: 'AI Unplugged',
        url: 'https://aiunplugged.club',
      },
      url: `https://aiunplugged.club${eventPath}`,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aiunplugged.club' },
        { '@type': 'ListItem', position: 2, name: 'Events', item: 'https://aiunplugged.club/events' },
        { '@type': 'ListItem', position: 3, name: event.title, item: `https://aiunplugged.club${eventPath}` },
      ],
    },
  ];

  return (
    <article>
      <SEO
        title={event.title}
        description={eventDescription ? eventDescription.slice(0, 160) : `${event.type} event hosted by AI Unplugged${event.dateDisplay ? ` on ${event.dateDisplay}` : ''}.`}
        path={eventPath}
        ogType="event"
        schemas={eventSchemas}
      />
      <header className="event-detail-hero">
        <p className="type-badge">{event.type}</p>
        <h1>{event.title}</h1>
        <div className="event-meta-row">
          {event.dateDisplay ? <span>{event.dateDisplay}</span> : null}
          {event.location ? <span>{event.location}</span> : null}
          {event.duration ? <span>{event.duration}</span> : null}
        </div>
      </header>

      <div className="event-detail-body">
        <div className="event-body-grid">
          <div className="event-body-content">
            <h2>About the room</h2>
            {aboutCopy.length ? aboutCopy.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : <p>Details for this room will be shared soon.</p>}

            {agendaItems.length ? (
              <div>
                <h2>Agenda</h2>
                <div>
                  {agendaItems.map((agendaItem) => (
                    <div className="agenda-row" key={`${agendaItem.time}-${agendaItem.item}`}>
                      <span className="time">{agendaItem.time}</span>
                      <span>{agendaItem.item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {speakers.length ? (
              <div>
                <h2>Speakers</h2>
                <div>
                  {speakers.map((speaker) => (
                    <div className="speaker-row" key={`${speaker.name}-${speaker.role}`}>
                      <div className="name">{speaker.name}</div>
                      <div className="role">{speaker.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

          </div>

          <aside className="event-side-card">
            {event.format ? (
              <div className="detail-row">
                <span className="label">Format</span>
                <span className="val">{event.format}</span>
              </div>
            ) : null}
            {event.capacity ? (
              <div className="detail-row">
                <span className="label">Capacity</span>
                <span className="val">{event.capacity} builders</span>
              </div>
            ) : null}
            {event.entry ? (
              <div className="detail-row">
                <span className="label">Entry</span>
                <span className="val">{event.entry}</span>
              </div>
            ) : null}
            {event.duration ? (
              <div className="detail-row">
                <span className="label">Duration</span>
                <span className="val">{event.duration}</span>
              </div>
            ) : null}

            {eventStatus === 'past' ? (
              <span className="ended">This event has ended</span>
            ) : (
              <button type="button" className="btn-primary" onClick={openRegistrationGate}>
                Register for this event <span className="btn-arrow">&rarr;</span>
              </button>
            )}
          </aside>
        </div>
      </div>
    </article>
  );
}
