import { useEffect, useState } from 'react';
import DynamicField from '../components/DynamicField';
import PageHeader from '../components/PageHeader';
import SubmissionOverlay from '../components/SubmissionOverlay';
import { buildInitialValues, REDIRECT_DELAY_MS, validateAgainstSchema } from '../lib/forms';
import { submitHostApplication } from '../lib/platform';
import { useNavigate } from 'react-router-dom';

const hostSchema = {
  id: 'host-interest-form',
  fields: [
    { id: 'name', type: 'text', label: 'Full name', required: true },
    { id: 'email', type: 'email', label: 'Email', required: true },
    {
      id: 'countryCode',
      type: 'select',
      label: 'Country code',
      required: true,
      options: [
        'India (+91)',
        'United States (+1)',
        'United Kingdom (+44)',
        'Canada (+1)',
        'Australia (+61)',
        'Singapore (+65)',
        'United Arab Emirates (+971)',
        'Germany (+49)',
        'France (+33)',
        'Netherlands (+31)'
      ]
    },
    { id: 'phone', type: 'phone', label: 'Contact number', required: true, placeholder: '98765 43210' },
    { id: 'subject', type: 'text', label: 'Subject', required: true, placeholder: 'Why you want to host AI Unplugged' },
    { id: 'venue', type: 'text', label: 'Venue', required: true, placeholder: 'Campus hall, coworking space, startup hub...' },
    { id: 'venueCapacity', type: 'number', label: 'Venue capacity', required: true },
    { id: 'estimatedAudience', type: 'number', label: 'How many people can you gather?', required: true },
    { id: 'details', type: 'textarea', label: 'Anything we should know?', required: false, placeholder: 'Audience quality, event context, city, past hosting experience, or timing preferences.' }
  ]
};

export default function HostPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Become a Host - AI Unplugged';
    setValues(buildInitialValues(hostSchema.fields, { countryCode: 'India (+91)' }));
  }, []);

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
    const nextErrors = validateAgainstSchema(hostSchema.fields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setFormMessage('');

    try {
      await submitHostApplication({ answers: values });
      setShowSuccess(true);
      window.setTimeout(() => navigate('/thank-you?form=host'), REDIRECT_DELAY_MS);
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
        label="Host An AI Unplugged Session"
        title="Become a"
        accent="Host."
        subtitle="Bring the right room together. If you can gather strong builders and provide the venue, we can help shape an AI Unplugged session with substance."
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 0 }}>
          <div className="pitch-grid">
            <div className="pitch-card">
              <h3>Bring signal to your city</h3>
              <p>Host a session that attracts founders, operators, students, and builders who actually want to do the work, not just attend another panel.</p>
            </div>
            <div className="pitch-card">
              <h3>Plug into the ecosystem</h3>
              <p>You are not organizing alone. Hosting connects your venue and audience to the wider House of Starts and AI Unplugged network.</p>
            </div>
            <div className="pitch-card">
              <h3>Shape the room</h3>
              <p>The best hosts influence who shows up, what gets discussed, and which local builders get pulled into better opportunities afterward.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="form-layout">
        <aside className="form-aside">
          <h3>Why host an AI Unplugged session</h3>
          <p>We want hosts who care about room quality, not just event volume.</p>
          <ul>
            <li>You have access to a real venue with enough capacity.</li>
            <li>You can gather builders, students, founders, or operators who fit the format.</li>
            <li>You want to create a room where people build, connect, and leave with leverage.</li>
            <li>You are willing to coordinate details with the core team before the event goes live.</li>
          </ul>
        </aside>

        <form className="form-card" onSubmit={handleSubmit} noValidate>
          {hostSchema.fields.filter((field) => ['name', 'email'].includes(field.id)).map((field) => (
            <DynamicField
              key={field.id}
              field={field}
              value={values[field.id]}
              values={values}
              error={errors[field.id]}
              onChange={updateField}
            />
          ))}

          <div className={`form-field${errors.countryCode || errors.phone ? ' has-error' : ''}`}>
            <label className="form-label" htmlFor="host-phone">Contact number</label>
            <div className="phone-combo">
              <select
                className="form-select phone-code-select"
                id="host-country-code"
                value={values.countryCode || 'India (+91)'}
                onChange={(event) => updateField('countryCode', event.target.value)}
              >
                {(hostSchema.fields.find((field) => field.id === 'countryCode')?.options || []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <input
                className="form-input"
                id="host-phone"
                type="tel"
                placeholder="98765 43210"
                value={values.phone ?? ''}
                onChange={(event) => updateField('phone', event.target.value)}
              />
            </div>
            <div className="form-error">{errors.countryCode || errors.phone || 'This field is required.'}</div>
          </div>

          {hostSchema.fields.filter((field) => !['name', 'email', 'countryCode', 'phone'].includes(field.id)).map((field) => (
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
            <button type="submit" className={`btn-primary${submitting ? ' is-disabled' : ''}`} disabled={submitting}>
              {submitting ? 'Submitting...' : <>Submit Host Request <span className="btn-arrow">&rarr;</span></>}
            </button>
            <span className="submit-note">We review host requests manually.</span>
          </div>
          {formMessage ? <div className="form-error" style={{ display: 'block', marginTop: 12 }}>{formMessage}</div> : null}
        </form>
      </div>

      <SubmissionOverlay visible={showSuccess} formType="host" />
    </>
  );
}
