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
        title="A room for the people"
        accent="actually building."
        subtitle='AI Unplugged exists because most AI "communities" optimize for content consumption. We optimize for the people shipping things.'
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 40 }}>
          <div className="about-grid">
            <div>
              <h2>What this is</h2>
              <p>AI Unplugged is an events-first ecosystem. Builders Nights, Build Rooms, Demo Days, and Talent x Founder Exchanges - each format is designed to produce output, not attendance.</p>
              <p>We run inside the House of Starts startup ecosystem, which means the founders and operators you meet here are operating real companies, not selling courses.</p>
            </div>
            <div>
              <h2>What this isn&apos;t</h2>
              <p>Not a course. Not a paid community. Not a YouTube channel. Not a Discord with 10,000 people and no signal.</p>
              <p>We keep rooms small on purpose. If an event is application-based, it&apos;s because there&apos;s a ceiling on how many people we let in, and we&apos;re intentional about who gets the seat.</p>
            </div>
          </div>

          <div className="about-grid">
            <div>
              <h2>Who runs it</h2>
              <p>A small core team operating out of House of Starts, supported by Node Leads across campuses in India. Node Leads are the reason this scales without losing signal - they own the community in their city or college.</p>
            </div>
            <div>
              <h2>The ecosystem</h2>
              <p>We&apos;re part of House of Starts - a physical startup hub. The connection is practical: the founders in that ecosystem are directly in the rooms we build.</p>
            </div>
          </div>

          <p className="section-label" style={{ marginTop: 60 }}>Get involved</p>

          <div className="about-cta-row">
            <Link className="about-cta" to="/events">
              <h3>See upcoming events</h3>
              <p>Every room we&apos;re opening - flagship nights, build rooms, demo days, and exchanges.</p>
              <span className="cta-arrow">Events &rarr;</span>
            </Link>
            <Link className="about-cta" to="/apply">
              <h3>Apply to attend</h3>
              <p>Pick an event, tell us who you are and what you&apos;re building. Reviewed by the team.</p>
              <span className="cta-arrow">Apply &rarr;</span>
            </Link>
            <Link className="about-cta" to="/node-lead">
              <h3>Run a campus node</h3>
              <p>Own AI Unplugged at your college. Pick the builders. Run the events. Direct ecosystem access.</p>
              <span className="cta-arrow">Node Lead &rarr;</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
