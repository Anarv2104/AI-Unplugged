import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DynamicField from '../components/DynamicField';
import PageHeader from '../components/PageHeader';
import SubmissionOverlay from '../components/SubmissionOverlay';
import { useAuth } from '../context/useAuth';
import { buildInitialValues, validateAgainstSchema, REDIRECT_DELAY_MS } from '../lib/forms';
import { getDefaultSchema, getPublishedEvents, getSchemaById, submitEventRegistration } from '../lib/platform';

export default function ApplyPage() {
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');

  const [events, setEvents] = useState([]);
  const [schema, setSchema] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(eventId || '');
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Apply - AI Unplugged';
    getPublishedEvents().then((items) => {
      setEvents(items);
      if (!selectedEventId && items[0]?.id) setSelectedEventId(items[0].id);
    });
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/signup', { replace: true, state: { backgroundLocation: { pathname: '/events' }, nextPath: '/events' } });
    }
  }, [isAuthenticated, loading, navigate]);

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId) || null, [events, selectedEventId]);

  useEffect(() => {
    async function loadSchema() {
      if (selectedEvent?.formId) {
        const nextSchema = await getSchemaById(selectedEvent.formId, 'event');
        setSchema(nextSchema);
        return;
      }
      const nextSchema = await getDefaultSchema('event');
      setSchema(nextSchema);
    }
    loadSchema();
  }, [selectedEvent?.formId]);

  useEffect(() => {
    if (!schema) return;
    const seed = {
      name: profile?.displayName || user?.displayName || '',
      email: user?.email || profile?.email || ''
    };
    setValues((current) => buildInitialValues(schema.fields, { ...seed, ...current }));
  }, [schema, profile?.displayName, profile?.email, user?.displayName, user?.email]);

  function updateField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setFormMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateAgainstSchema(schema?.fields || [], values);
    if (!selectedEventId) nextErrors.event = 'Please pick an event.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setFormMessage('');

    try {
      await submitEventRegistration({
        eventId: selectedEventId,
        answers: values
      });
      setShowSuccess(true);
      window.setTimeout(() => navigate('/thank-you?form=attend'), REDIRECT_DELAY_MS);
    } catch (error) {
      const fieldErrors = error?.details?.errors;
      if (fieldErrors) setErrors(fieldErrors);
      setFormMessage(error?.message || 'Could not submit. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        label="Apply to Attend"
        title="Tell us who"
        accent="you are."
        subtitle="Applications are reviewed by the team. We look for builders - people shipping, not just watching. Takes about 3 minutes."
      />

      <div className="form-layout">
        <aside className="form-aside">
          <h3>What we look for</h3>
          <p>We don&apos;t read resumes. We read what you&apos;re building and why.</p>
          <ul>
            <li>You&apos;re shipping something - even rough, even broken.</li>
            <li>You can be specific about why this event, not just &quot;to network.&quot;</li>
            <li>You&apos;ll show up. Seats are limited and waitlists are real.</li>
          </ul>
        </aside>

        <div>
          {selectedEvent ? (
            <div className="context-pin">
              <div>
                <span className="pin-label">Applying for</span>
                <span className="pin-title">{selectedEvent.title}</span>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-2)', marginTop: 4 }}>
                  {selectedEvent.dateDisplay} · {selectedEvent.location}
                </div>
              </div>
              <Link to="/apply" className="pin-clear">Change event</Link>
            </div>
          ) : null}

          <form className="form-card" onSubmit={handleSubmit} noValidate>
            {!eventId ? (
              <div className={`form-field${errors.event ? ' has-error' : ''}`}>
                <label className="form-label" htmlFor="a-event">Which event?</label>
                <select className="form-select" id="a-event" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                  <option value="">Select an upcoming event</option>
                  {events.map((eventOption) => (
                    <option key={eventOption.id} value={eventOption.id}>{eventOption.title} - {eventOption.dateDisplay}</option>
                  ))}
                </select>
                <div className="form-error">{errors.event || 'Please pick an event.'}</div>
              </div>
            ) : null}

            {schema?.fields?.map((field) => (
              <DynamicField
                key={field.id}
                field={field}
                value={values[field.id]}
                values={values}
                error={errors[field.id]}
                onChange={updateField}
              />
            ))}

            <div className="form-submit-row">
              <button type="submit" className={`btn-primary${submitting ? ' is-disabled' : ''}`} disabled={submitting || !schema}>
                {submitting ? 'Submitting...' : <>Submit Application <span className="btn-arrow">&rarr;</span></>}
              </button>
              <span className="submit-note">We reply within 3-5 days.</span>
            </div>
            {formMessage ? <div className="form-error" style={{ display: 'block', marginTop: 12 }}>{formMessage}</div> : null}
          </form>
        </div>
      </div>

      <SubmissionOverlay visible={showSuccess} formType="attend" />
    </>
  );
}
