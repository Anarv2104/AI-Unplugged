import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Ticker from '../components/Ticker';
import { fallbackUpdates } from '../lib/defaultContent';
import { useAuth } from '../context/useAuth';
import { sortEventsByState } from '../lib/events';
import { getPublishedEvents } from '../lib/platform';

export default function HomePage() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [nextEvent, setNextEvent] = useState(null);
  const featuredUpdates = useMemo(() => fallbackUpdates.slice(0, 2), []);

  useEffect(() => {
    document.title = 'AI Unplugged - The AI Ecosystem for Builders';
    getPublishedEvents().then((items) => {
      const upcoming = sortEventsByState(items)
        .find((event) => event.derivedStatus === 'ongoing' || event.derivedStatus === 'upcoming') || null;
      setNextEvent(upcoming);
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

  return (
    <>
      <section className="hero">
        <p className="hero-label">Built inside the startup ecosystem</p>

        <h1>
          The AI ecosystem
          <br />
          for builders,
          <br />
          <span className="italic">not spectators.</span>
        </h1>

        <p className="hero-sub">
          Access founders. Build with AI. Enter a real ecosystem. Where ambitious builders meet operators,
          ship projects, and gain leverage their peers won&apos;t have.
        </p>

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
          <p className="section-label">What you get</p>
          <h2 className="section-title">
            Not a course. Not a club.
            <br />
            <span className="italic">Not a webinar series.</span>
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
              <p>AI Unplugged operates inside the House of Starts startup ecosystem. You&apos;re not joining a community. You&apos;re entering a network that connects to real opportunities.</p>
            </div>
            <div className="value-card">
              <div className="value-card-num">4</div>
              <h3>Curated Rooms</h3>
              <p>Not every event is open. Some are invite-only. Some are application-based. The best rooms are earned, not given. That&apos;s what makes them worth being in.</p>
            </div>
            <div className="value-card">
              <div className="value-card-num">5</div>
              <h3>Visibility</h3>
              <p>Build something and people see it. Demo days, showcases, and community output create proof that matters more than any resume line you could write.</p>
            </div>
            <div className="value-card">
              <div className="value-card-num">6</div>
              <h3>Leverage</h3>
              <p>The people you meet, the things you build, the access you get. It compounds. Six months from now, you&apos;ll have advantages your peers won&apos;t understand.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="events-section" id="events">
        <div className="section-wrap">
          <p className="section-label">Event formats</p>
          <h2 className="section-title">
            Events that can&apos;t be replaced
            <br />
            <span className="italic">by a YouTube video.</span>
          </h2>

          <div className="events-grid">
            <Link className="event-card" to="/events?type=Flagship">
              <p className="event-card-type">Flagship</p>
              <h3>Builders Night</h3>
              <p>Live demos, sharp talks, and a room full of people building with AI. Social energy meets builder substance. This is where you realize you&apos;ve been in the wrong rooms.</p>
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

      {nextEvent ? (
        <section className="spotlight-section">
          <div className="section-wrap">
            <div className="spotlight-grid">
              <div className="spotlight-content">
                <p className="section-label">{nextEvent.derivedStatus === 'ongoing' ? 'Ongoing Event' : 'Next Event'}</p>
                <h2>{nextEvent.title}</h2>
                <div className="spotlight-meta">
                  <span>{nextEvent.dateDisplay}</span>
                  <span>{nextEvent.location}</span>
                </div>
                <p>{nextEvent.tagline}</p>
                <button type="button" className="btn-primary" onClick={openGetStarted}>
                  Register For Upcoming Events <span className="btn-arrow">&rarr;</span>
                </button>
              </div>

              <div className="spotlight-card">
                <div className="spotlight-card-number">01</div>
                <div>
                  <div className="detail-row">
                    <span className="label">Format</span>
                    <span className="val">{nextEvent.format}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Capacity</span>
                    <span className="val">{nextEvent.capacity} builders</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Entry</span>
                    <span className="val">{nextEvent.entry}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Duration</span>
                    <span className="val">{nextEvent.duration}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section-wrap">
        <div className="updates-preview-head">
          <div>
            <p className="section-label">Platform updates</p>
            <h2 className="section-title">News, recaps, and AI workflow notes for members and builders.</h2>
          </div>
          <Link to="/updates" className="btn-secondary">See All Updates</Link>
        </div>
        <div className="updates-grid">
          {featuredUpdates.map((update) => (
            <Link to={`/updates/${update.slug}`} className="update-card" key={update.id}>
              <p className="event-card-type">{update.category}</p>
              <h3>{update.title}</h3>
              <p>{update.excerpt}</p>
              <span className="cta-arrow">Read Update &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="node-section" id="node-lead">
        <div className="section-wrap">
          <p className="section-label">Run your campus node</p>
          <h2>
            Become a
            <br />
            <span className="italic">Node Lead.</span>
          </h2>
          <p>You won&apos;t be an ambassador. You&apos;ll own AI Unplugged at your college. Build the local community. Bring the right people. Get direct access to the ecosystem.</p>
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
                <div className="host-visual-card host-card-one">
                  <span className="host-chip">HOST</span>
                  <strong>Builder room</strong>
                  <p>Founders, students, operators, and working builders in one high-signal room.</p>
                </div>
                <div className="host-visual-ring" />
                <div className="host-visual-card host-card-two">
                  <span className="host-chip">LOCAL</span>
                  <strong>Your venue, our format</strong>
                  <p>Gather the right people and turn your city or campus into the next strong node.</p>
                </div>
              </div>
            </div>

            <div className="host-callout-copy">
              <p className="section-label">Want to become a host?</p>
              <h2 className="section-title">Build the room your city should already have.</h2>
              <p className="page-sub">
                If you have the venue, the local context, and the ability to gather serious people, host an AI Unplugged session with us. We care more about room quality than event count.
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
