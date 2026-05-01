import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getEventStatus } from '../lib/events';
import { getEventById } from '../lib/platform';
import { useAuth } from '../context/useAuth';

export default function EventDetailPage() {
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState(undefined);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const id = searchParams.get('id');

  useEffect(() => {
    getEventById(id).then(setEvent);
  }, [id]);

  useEffect(() => {
    document.title = event ? `${event.title} - AI Unplugged` : 'Event - AI Unplugged';
  }, [event]);

  if (event === undefined) {
    return <div className="page-header"><p className="page-sub">Loading event...</p></div>;
  }

  if (!event) {
    return (
      <div>
        <header className="page-header">
          <p className="section-label">404</p>
          <h1>Event not found</h1>
          <p className="page-sub">We couldn&apos;t find that event. It might have been renamed or removed.</p>
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
      navigate(`/apply?event=${encodeURIComponent(event.id)}`);
      return;
    }
    navigate('/signup', { state: { backgroundLocation: location, nextPath: '/events' } });
  }

  const eventStatus = getEventStatus(event || {});

  return (
    <article>
      <header className="event-detail-hero">
        <p className="type-badge">{event.type}</p>
        <h1>{event.title}</h1>
        <div className="event-meta-row">
          <span>{event.dateDisplay}</span>
          <span>{event.location}</span>
          <span>{event.duration}</span>
        </div>
      </header>

      <div className="event-detail-body">
        <div className="event-body-grid">
          <div className="event-body-content">
            <h2>About this event</h2>
            {(event.description || []).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

            {event.agenda?.length ? (
              <div>
                <h2>Agenda</h2>
                <div>
                  {event.agenda.map((agendaItem) => (
                    <div className="agenda-row" key={`${agendaItem.time}-${agendaItem.item}`}>
                      <span className="time">{agendaItem.time}</span>
                      <span>{agendaItem.item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {event.speakers?.length ? (
              <div>
                <h2>Who&apos;s in the room</h2>
                <div>
                  {event.speakers.map((speaker) => (
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
            <div className="detail-row">
              <span className="label">Format</span>
              <span className="val">{event.format}</span>
            </div>
            <div className="detail-row">
              <span className="label">Capacity</span>
              <span className="val">{event.capacity} builders</span>
            </div>
            <div className="detail-row">
              <span className="label">Entry</span>
              <span className="val">{event.entry}</span>
            </div>
            <div className="detail-row">
              <span className="label">Duration</span>
              <span className="val">{event.duration}</span>
            </div>

            {eventStatus === 'past' ? (
              <span className="ended">This event has ended</span>
            ) : (
              <button type="button" className="btn-primary" onClick={openRegistrationGate}>
                Register For Event <span className="btn-arrow">&rarr;</span>
              </button>
            )}
          </aside>
        </div>
      </div>
    </article>
  );
}
