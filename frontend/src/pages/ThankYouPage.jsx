import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function ThankYouPage() {
  const [searchParams] = useSearchParams();
  const formType = searchParams.get('form');
  const entryType = searchParams.get('entry');

  useEffect(() => {
    document.title = 'Application received - AI Unplugged';
  }, []);

  let label = 'Application received';
  let title = 'is in.';
  let body = 'We will review it and reach out by email within a few days. In the meantime, keep building - the best way to prep for any event is to ship something between now and then.';
  let primaryCta = { to: '/events', label: 'See all events' };
  let secondaryCta = { to: '/', label: 'Back home' };

  if (formType === 'node-lead') {
    label = 'Node Lead application received';
    body = "We review Node Lead applications slowly and in batches - expect to hear back within 1-2 weeks. If there's a fit, we'll set up a short call.";
  } else if (formType === 'host') {
    label = 'Host request received';
    body = 'We will review your venue, capacity, and audience fit, then reach out by email to discuss the next step for hosting an AI Unplugged session.';
  } else if (formType === 'attend') {
    primaryCta = { to: '/dashboard', label: 'Go to dashboard' };
    secondaryCta = { to: '/events', label: 'See all events' };
    if (entryType === 'open') {
      label = 'Event registration confirmed';
      body = "Your seat is confirmed. Check your email for the registration details and keep an eye on the dashboard for anything new tied to this room.";
    } else if (entryType === 'curated') {
      label = 'Curated event request received';
      body = "We’ve received your request for this curated room. We’ll review fit carefully and email you with the next update.";
    } else {
      label = 'Event application received';
      body = "Thank you for applying. We’ll get back to you via email soon.";
    }
  }

  return (
    <main className="thanks-wrap">
      <p className="section-label">{label}</p>
      <h1>
        Your application
        <br />
        <span className="italic">{title}</span>
      </h1>
      <p>{body}</p>
      <div className="thanks-actions">
        <Link to={primaryCta.to} className="btn-primary">
          {primaryCta.label} <span className="btn-arrow">&rarr;</span>
        </Link>
        <Link to={secondaryCta.to} className="btn-secondary">{secondaryCta.label}</Link>
      </div>
    </main>
  );
}
