export default function SubmissionOverlay({ visible, formType }) {
  const title = formType === 'node-lead'
    ? 'Node Lead application received'
    : formType === 'host'
      ? 'Host application received'
      : 'Event application received';
  const body = formType === 'host'
    ? 'Your host request is saved locally and we are redirecting to the confirmation page.'
    : formType === 'node-lead'
      ? 'Your application is saved locally on this device. Redirecting to the confirmation page.'
      : 'Your application is saved locally on this device. Redirecting to the confirmation page.';

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
