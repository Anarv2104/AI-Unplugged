import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

export default function AboutPage() {
  useEffect(() => {
    document.title = 'About - AI Unplugged';
  }, []);

  return (
    <>
      <PageHeader
        label="About"
        title="Why AI"
        accent="Unplugged."
        subtitle="A builder-first platform for high-signal rooms, strong execution environments, and compounding access inside the House of Starts ecosystem."
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 40 }}>
          <div className="about-grid">
            <div>
              <h2>What this is</h2>
              <p>AI Unplugged is a platform for builders who want better rooms, better conversations, and better pressure. It is designed for people who want to build with AI in public, in front of serious peers.</p>
              <p>The goal is simple: create environments where ideas become proof of work, and where the people in the room can actually change your trajectory.</p>
            </div>
            <div>
              <h2>What this is not</h2>
              <p>This is not a passive community built around endless chatter. It is not an events calendar for attendance theatre.</p>
              <p>The best rooms are curated, selective, and built around output. That is the standard AI Unplugged is trying to keep.</p>
            </div>
          </div>

          <div className="about-grid">
            <div>
              <h2>Who runs it</h2>
              <p>AI Unplugged is part of House of Starts, a startup ecosystem focused on builders, founders, talent, and execution. It operates as one of the high-signal public-facing rooms inside that wider system.</p>
            </div>
            <div>
              <h2>The ecosystem angle</h2>
              <p>You are not only attending standalone events. You are stepping into a connected builder ecosystem that can lead to better collaborators, stronger projects, and real opportunities.</p>
            </div>
          </div>

          <p className="section-label" style={{ marginTop: 60 }}>Get involved</p>

          <div className="about-cta-row">
            <Link className="about-cta" to="/events">
              <h3>Explore Events</h3>
              <p>See the rooms, formats, and upcoming sessions currently open inside the platform.</p>
              <span className="cta-arrow">Events &rarr;</span>
            </Link>
            <Link className="about-cta" to="/attend">
              <h3>Attend a room</h3>
              <p>Apply to join a live session, builder room, demo day, or curated working environment.</p>
              <span className="cta-arrow">Attend &rarr;</span>
            </Link>
            <Link className="about-cta" to="/node-lead">
              <h3>Lead a local node</h3>
              <p>Help grow AI Unplugged in your city, campus, community, builder cluster, or region.</p>
              <span className="cta-arrow">Node Lead &rarr;</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
