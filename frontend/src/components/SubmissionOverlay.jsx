export default function SubmissionOverlay({ visible, formType, entryType = '' }) {
  const title = formType === 'node-lead'
    ? 'Node Lead application received'
    : formType === 'host'
      ? 'Host application received'
      : entryType === 'open'
        ? 'Event registration confirmed'
        : entryType === 'curated'
          ? 'Curated event request received'
          : 'Event application received';
  const body = formType === 'host'
    ? 'Your host request has been submitted. Redirecting to the confirmation page.'
    : formType === 'node-lead'
      ? 'Your application has been submitted. Redirecting to the confirmation page.'
      : entryType === 'open'
        ? 'Your registration is confirmed. Redirecting to the confirmation page.'
        : entryType === 'curated'
          ? 'Your curated-room request has been submitted. Redirecting to the confirmation page.'
          : 'Your application has been submitted. Redirecting to the confirmation page.';

  return (
    <div className={`submission-overlay${visible ? ' is-visible' : ''}`}>
      <div className="submission-toast" role="status" aria-live="polite">
        <div className="submission-mark">✓</div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}
