import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Ticker from '../components/Ticker';
import { fallbackUpdates } from '../lib/defaultContent';
import { useAuth } from '../context/useAuth';
import { getHomeSpotlightSettings, getPublishedEvents } from '../lib/platform';
import { resolveHomeSpotlightEvents } from '../lib/events';
import SEO from '../components/SEO';

export default function HomePage() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const featuredUpdates = useMemo(() => fallbackUpdates.slice(0, 2), []);

  useEffect(() => {
    Promise.all([
      getPublishedEvents(),
      getHomeSpotlightSettings().catch(() => ({ featuredHomeEventIds: [] }))
    ])
      .then(([items, settings]) => {
        setUpcomingEvents(resolveHomeSpotlightEvents(items, settings.featuredHomeEventIds || []));
      })
      .finally(() => {
        setEventsLoading(false);
      });
  }, []);

  if (!loading && isAuthenticated) {
    return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  }

  function openGetStarted() {
    if (isAuthenticated) {
      navigate('/events');
      return;
    }
    navigate('/signup', { state: { backgroundLocation: location, nextPath: '/events' } });
  }

  function openUpdatePreview(slug) {
    if (isAuthenticated) {
      navigate(`/updates/${slug}`);
      return;
    }
    navigate('/login', { state: { backgroundLocation: location, nextPath: `/updates/${slug}` } });
  }

  const homeSchemas = [
    {
      '@type': 'Organization',
      name: 'AI Unplugged',
      url: 'https://aiunplugged.club',
      logo: 'https://aiunplugged.club/AI%20UP.png',
      description: 'AI Unplugged is a builder-first platform for high-signal AI rooms, curated events, and compounding access inside the House of Starts ecosystem.',
      memberOf: { '@type': 'Organization', name: 'House of Starts' },
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      name: 'AI Unplugged',
      url: 'https://aiunplugged.club',
      description: 'AI Unplugged hosts curated AI events, builder rooms, and open hours for founders, researchers, and practitioners.',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is AI Unplugged?',
          acceptedAnswer: { '@type': 'Answer', text: 'AI Unplugged is a builder-first platform for high-signal AI rooms, curated events, and compounding access inside the House of Starts startup ecosystem. It brings together founders, researchers, and practitioners to build with AI in public.' },
        },
        {
          '@type': 'Question',
          name: 'Who can attend AI Unplugged events?',
          acceptedAnswer: { '@type': 'Answer', text: 'AI Unplugged events are open to builders, students, founders, and operators who are actively working on or exploring AI applications. Rooms are curated and selective to maintain a high-signal environment.' },
        },
        {
          '@type': 'Question',
          name: 'How do I register for an AI Unplugged event?',
          acceptedAnswer: { '@type': 'Answer', text: 'Create a free account at aiunplugged.club, browse the Events page, and apply to attend any upcoming session. Each event has a short application to ensure the right room composition.' },
        },
        {
          '@type': 'Question',
          name: 'What is House of Starts?',
          acceptedAnswer: { '@type': 'Answer', text: 'House of Starts is a startup ecosystem focused on builders, founders, talent, and execution. AI Unplugged operates as one of the high-signal public-facing rooms within that wider system.' },
        },
        {
          '@type': 'Question',
          name: 'How can I host an AI Unplugged event?',
          acceptedAnswer: { '@type': 'Answer', text: 'Organisations and individuals can apply to host a room through the Become a Host page at aiunplugged.club/become-a-host. Hosts provide a venue and co-curate the session with the AI Unplugged team.' },
        },
        {
          '@type': 'Question',
          name: 'What types of events does AI Unplugged run?',
          acceptedAnswer: { '@type': 'Answer', text: 'AI Unplugged runs Flagship sessions, Execution rooms, Showcase events, and Opportunity rooms — each designed for a different stage of builder engagement with artificial intelligence.' },
        },
      ],
    },
  ];

  return (
    <>
      <SEO
        path="/"
        description="AI Unplugged is a builder-first platform for high-signal AI rooms, curated events, and compounding access inside the House of Starts ecosystem. Join as attendee, host, or node lead."
        schemas={homeSchemas}
      />
      <section className="hero">
        <p className="hero-label">BUILT INSIDE THE STARTUP ECOSYSTEM</p>

        <h1>
          The AI ecosystem
          <br />
          for builders,
          <br />
          <span className="italic">not spectators.</span>
        </h1>

        <div className="hero-copy">
          <p className="hero-sub">
            Access founders. Build with AI. Enter a real ecosystem.
          </p>
          <p className="hero-sub">
            Where ambitious builders meet operators, ship projects, and gain leverage their peers won&apos;t have.
          </p>
        </div>

        <div className="hero-actions">
          <button type="button" className="btn-secondary" onClick={openGetStarted}>
            Get Started <span className="btn-arrow">&rarr;</span>
          </button>
          <Link to="/events" className="btn-primary">
            Explore Events <span className="btn-arrow">&rarr;</span>
          </Link>
        </div>
      </section>

      <Ticker />

      <section id="value">
        <div className="section-wrap">
          <p className="section-label">Why it matters</p>
          <h2 className="section-title">
            Rooms that change
            <br />
            <span className="italic">your trajectory.</span>
          </h2>

          <div className="value-grid">
            <div className="value-card">
              <div className="value-card-num">1</div>
              <h3>Founder Access</h3>
              <p>Sit in rooms with people building real companies. Not recorded talks. Real conversations with founders and operators who are shipping AI products right now.</p>
            </div>
            <div className="value-card">
              <div className="value-card-num">2</div>
              <h3>Build Environments</h3>
              <p>Events where you build, not listen. Build rooms, sprints, and demo days that produce real output. Your commits and shipped projects, not attendance certificates.</p>
            </div>
            <div className="value-card">
              <div className="value-card-num">3</div>
              <h3>Ecosystem Entry</h3>
              <p>AI Unplugged operates inside the House of Starts startup ecosystem. You are not joining a community. You are entering a network that connects to real opportunities.</p>
            </div>
            <div className="value-card">
              <div className="value-card-num">4</div>
              <h3>Curated Rooms</h3>
              <p>Not every event is open. Some are invite-only. Some are application-based. The best rooms are earned, not given. That is what makes them worth being in.</p>
            </div>
            <div className="value-card">
              <div className="value-card-num">5</div>
              <h3>Visibility</h3>
              <p>Build something and people see it. Demo days, showcases, and community output create proof that matters more than any resume line you could write.</p>
            </div>
            <div className="value-card">
              <div className="value-card-num">6</div>
              <h3>Leverage</h3>
              <p>The people you meet, the things you build, the access you get. It compounds. Six months from now, you will have advantages your peers will not understand.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="events-section" id="events">
        <div className="section-wrap">
          <p className="section-label">Event formats</p>
          <h2 className="section-title">
            Different rooms,
            <br />
            <span className="italic">different pressure.</span>
          </h2>

          <div className="events-grid">
            <Link className="event-card" to="/events?type=Flagship">
              <p className="event-card-type">Flagship</p>
              <h3>Builders Night</h3>
              <p>Live demos, sharp talks, and a room full of people building with AI. Social energy meets builder substance. This is where you realize you have been in the wrong rooms.</p>
              <span className="event-tag">Open</span>
            </Link>
            <Link className="event-card" to="/events?type=Execution">
              <p className="event-card-type">Execution</p>
              <h3>The Build Room</h3>
              <p>Show up. Build something. Ship it. Mentors, peers, and pressure in the room. Not a hackathon with pizza. A focused build session that produces output.</p>
              <span className="event-tag">Application</span>
            </Link>
            <Link className="event-card" to="/events?type=Showcase">
              <p className="event-card-type">Showcase</p>
              <h3>Demo Day</h3>
              <p>Present what you built. Get feedback from founders and builders. This is your proof of work, live and in front of the people who matter.</p>
              <span className="event-tag">Invite Only</span>
            </Link>
            <Link className="event-card" to="/events?type=Opportunity">
              <p className="event-card-type">Opportunity</p>
              <h3>Talent x Founder Exchange</h3>
              <p>Founders bring real problems. Builders pitch solutions. This is where internships, collaborations, and startup roles actually begin.</p>
              <span className="event-tag">Curated</span>
            </Link>
          </div>
        </div>
      </section>

      {!eventsLoading && upcomingEvents.length > 0 ? (
        <section className="spotlight-section">
          <div className="section-wrap">
            <p className="section-label" style={{ marginBottom: 32 }}>
              {upcomingEvents.length > 1 ? 'Upcoming events' : upcomingEvents[0].derivedStatus === 'ongoing' ? 'Ongoing event' : 'Next event'}
            </p>
            <div className="spotlight-grid spotlight-grid-cards">
              <div className="spotlight-content">
                <h2>{upcomingEvents.length > 1 ? 'Pick your next room.' : upcomingEvents[0].title}</h2>
                <p>{upcomingEvents.length > 1 ? 'These are the next rooms on deck. Choose the one that fits your momentum and get in early.' : upcomingEvents[0].tagline}</p>
                <button type="button" className="btn-primary" onClick={openGetStarted}>
                  Register for Upcoming Events <span className="btn-arrow">&rarr;</span>
                </button>
              </div>

              <div className={`spotlight-cards-row${upcomingEvents.length === 1 ? ' is-single' : ''}`}>
                {upcomingEvents.map((event, i) => (
                  <div className="spotlight-card" key={event.id}>
                    <div className="spotlight-card-number">0{i + 1}</div>
                    <div className="spotlight-card-title-wrap">
                      <h3>{event.title}</h3>
                      <div className="spotlight-meta">
                        {event.dateDisplay ? <span>{event.dateDisplay}</span> : null}
                        {event.location ? <span>{event.location}</span> : null}
                      </div>
                    </div>
                    <div>
                      {event.format ? <div className="detail-row"><span className="label">Format</span><span className="val">{event.format}</span></div> : null}
                      {event.capacity ? <div className="detail-row"><span className="label">Capacity</span><span className="val">{event.capacity} builders</span></div> : null}
                      {event.entry ? <div className="detail-row"><span className="label">Entry</span><span className="val">{event.entry}</span></div> : null}
                      {event.duration ? <div className="detail-row"><span className="label">Duration</span><span className="val">{event.duration}</span></div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section-wrap">
        <div className="updates-preview-head">
          <div>
            <p className="section-label">Platform updates</p>
            <h2 className="section-title">Recent updates</h2>
          </div>
          <Link to="/updates" className="btn-secondary">See All Updates</Link>
        </div>
        <div className="updates-grid">
          {featuredUpdates.map((update) => (
            <button type="button" className="update-card update-card-button" key={update.id} onClick={() => openUpdatePreview(update.slug)}>
              <p className="event-card-type">{update.category}</p>
              <h3>{update.title}</h3>
              <p>{update.excerpt}</p>
              <span className="cta-arrow">Read Update &rarr;</span>
            </button>
          ))}
        </div>
      </section>

      <section className="node-section" id="node-lead">
        <div className="section-wrap">
          <p className="section-label">Become a Node Lead</p>
          <h2>
            Run the signal
            <br />
            <span className="italic">in your local room.</span>
          </h2>
          <p>Node Leads help build stronger local clusters across cities, campuses, communities, and builder networks. If you can gather sharp people and keep quality high, we want to hear from you.</p>
          <Link to="/node-lead" className="btn-primary">
            Apply as Node Lead <span className="btn-arrow">&rarr;</span>
          </Link>
        </div>
      </section>

      <section className="host-section">
        <div className="section-wrap">
          <div className="host-callout">
            <div className="host-visual" aria-hidden="true">
              <div className="host-visual-shell">
                <div className="host-visual-ring" />
                <div className="host-visual-card host-card-one">
                  <span className="host-chip">HOST</span>
                  <strong>Builder room</strong>
                  <p>Founders, students, operators, and working builders in one high-signal room.</p>
                </div>
                <div className="host-visual-card host-card-two">
                  <span className="host-chip">LOCAL</span>
                  <strong>Your venue, our format</strong>
                  <p>Gather the right people and turn your city, campus, or builder cluster into the next strong node.</p>
                </div>
              </div>
            </div>

            <div className="host-callout-copy">
              <p className="section-label">Become a Host</p>
              <h2 className="section-title">Bring an AI Unplugged room to your ecosystem.</h2>
              <p className="page-sub">
                If you have the venue, the local pull, and the instinct for room quality, we can help shape a session that actually matters.
              </p>
              <Link to="/become-a-host" className="btn-primary">
                Become a Host <span className="btn-arrow">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
