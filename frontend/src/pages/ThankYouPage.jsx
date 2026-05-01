import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function ThankYouPage() {
  const [searchParams] = useSearchParams();
  const formType = searchParams.get('form');

  useEffect(() => {
    document.title = 'Application received - AI Unplugged';
  }, []);

  let label = 'Application received';
  let title = 'is in.';
  let body = 'We will review it and reach out by email within a few days. In the meantime, keep building - the best way to prep for any event is to ship something between now and then.';

  if (formType === 'node-lead') {
    label = 'Node Lead application received';
    body = "We review Node Lead applications slowly and in batches - expect to hear back within 1-2 weeks. If there's a fit, we'll set up a short call.";
  } else if (formType === 'host') {
    label = 'Host request received';
    body = 'We will review your venue, capacity, and audience fit, then reach out by email to discuss the next step for hosting an AI Unplugged session.';
  } else if (formType === 'attend') {
    label = 'Event application received';
    body = "We'll review and reply by email within 3-5 days. Seats are limited - if it's a fit, we'll send confirmation and details.";
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
        <Link to="/events" className="btn-primary">
          See all events <span className="btn-arrow">&rarr;</span>
        </Link>
        <Link to="/" className="btn-secondary">Back home</Link>
      </div>
    </main>
  );
}
