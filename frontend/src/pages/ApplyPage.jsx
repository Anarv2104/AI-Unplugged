import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DynamicField from '../components/DynamicField';
import PageHeader from '../components/PageHeader';
import SubmissionOverlay from '../components/SubmissionOverlay';
import { useAuth } from '../context/useAuth';
import { buildInitialValues, validateAgainstSchema, REDIRECT_DELAY_MS } from '../lib/forms';
import { getDefaultSchema, getPublishedEvents, getSchemaById, submitEventRegistration } from '../lib/platform';
import SEO from '../components/SEO';

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
    getPublishedEvents().then((items) => {
      setEvents(items);
      if (!selectedEventId && items[0]?.id) setSelectedEventId(items[0].id);
    });
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/signup', { replace: true, state: { backgroundLocation: { pathname: '/events' }, nextPath: '/dashboard' } });
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
    if (!selectedEventId) nextErrors.event = 'Pick an event first.';
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
      <SEO
        title="Attend an Event"
        description="Apply to attend an AI Unplugged session. Pick the event that fits your momentum and send in the details needed to confirm your spot in the room."
        path="/attend"
        schemas={[{
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aiunplugged.club' },
            { '@type': 'ListItem', position: 2, name: 'Attend', item: 'https://aiunplugged.club/attend' },
          ],
        }]}
      />
      <PageHeader
        label="Attend"
        title="Step into the"
        accent="room."
        subtitle="Pick the event that fits your current momentum, then send in the details needed to confirm your spot."
      />

      <div className="form-layout">
        <aside className="form-aside">
          <h3>What we look for</h3>
          <p>We care more about fit, readiness, and room quality than volume.</p>
          <ul>
            <li>You are applying to the room that actually fits your stage.</li>
            <li>You can contribute signal, execution, or a serious point of view.</li>
            <li>You are ready to show up and participate, not just observe from the edge.</li>
          </ul>
        </aside>

        <div>
          {selectedEvent ? (
            <div className="context-pin">
              <div>
                <span className="pin-label">Attending</span>
                <span className="pin-title">{selectedEvent.title}</span>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-2)', marginTop: 4 }}>
                  {selectedEvent.dateDisplay} · {selectedEvent.location}
                </div>
              </div>
              <Link to="/attend" className="pin-clear">Change event</Link>
            </div>
          ) : null}

          <form className="form-card" onSubmit={handleSubmit} noValidate>
            {!eventId ? (
              <div className={`form-field${errors.event ? ' has-error' : ''}`}>
                <label className="form-label" htmlFor="a-event">Which event?</label>
                <select className="form-select" id="a-event" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                  <option value="">Select an event</option>
                  {events.map((eventOption) => (
                    <option key={eventOption.id} value={eventOption.id}>{eventOption.title} - {eventOption.dateDisplay}</option>
                  ))}
                </select>
                <div className="form-error">{errors.event || 'Pick an event first.'}</div>
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
                {submitting ? 'Submitting...' : <>Submit Attendance Request <span className="btn-arrow">&rarr;</span></>}
              </button>
              <span className="submit-note">Most confirmations are reviewed within a few days.</span>
            </div>
            {formMessage ? <div className="form-error" style={{ display: 'block', marginTop: 12 }}>{formMessage}</div> : null}
          </form>
        </div>
      </div>

      <SubmissionOverlay visible={showSuccess} formType="attend" />
    </>
  );
}
