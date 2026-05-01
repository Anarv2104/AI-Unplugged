import { useEffect, useState } from 'react';
import DynamicField from '../components/DynamicField';
import PageHeader from '../components/PageHeader';
import SubmissionOverlay from '../components/SubmissionOverlay';
import { buildInitialValues, REDIRECT_DELAY_MS, validateAgainstSchema } from '../lib/forms';
import { getDefaultSchema, submitNodeLeadApplication } from '../lib/platform';
import { useNavigate } from 'react-router-dom';

export default function NodeLeadPage() {
  const navigate = useNavigate();
  const [schema, setSchema] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Become a Node Lead - AI Unplugged';
    getDefaultSchema('nodeLead').then((nextSchema) => {
      setSchema(nextSchema);
      setValues(buildInitialValues(nextSchema.fields));
    });
  }, []);

  function updateField(name, value) {
    setValues((current) => ({
      ...current,
      [name]: value,
      ...(name === 'hasOrganized' && value !== 'Yes' ? { organizedDetail: '' } : {})
    }));
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
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setFormMessage('');

    try {
      await submitNodeLeadApplication({ schemaId: schema?.id, answers: values });
      setShowSuccess(true);
      window.setTimeout(() => navigate('/thank-you?form=node-lead'), REDIRECT_DELAY_MS);
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
        label="Run Your Campus Node"
        title="Become a"
        accent="Node Lead."
        subtitle="Not an ambassador. Not a brand rep. You'll own AI Unplugged at your campus - pick the builders, run the events, bring the right people into the room."
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 0 }}>
          <div className="pitch-grid">
            <div className="pitch-card">
              <h3>Run real events</h3>
              <p>Build Rooms, Builders Nights, and showcases - in your city, on your campus, with ecosystem backing and operational support from the core team.</p>
            </div>
            <div className="pitch-card">
              <h3>Direct ecosystem access</h3>
              <p>You&apos;ll be in the core group. Founders, operators, and partner companies are introduced to you directly. No filter.</p>
            </div>
            <div className="pitch-card">
              <h3>A track record that shows</h3>
              <p>When you ship events that produce builders, people notice. This becomes something you point to - not a line on a resume, a reputation.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="form-layout">
        <aside className="form-aside">
          <h3>Who we&apos;re looking for</h3>
          <p>We&apos;re slow about picking Node Leads. Every bad fit sets back the local community by months.</p>
          <ul>
            <li>You&apos;ve organized something before - even informally.</li>
            <li>You&apos;re hands-on with AI. Not just curious - actively building or using it.</li>
            <li>You care about who&apos;s in the room more than how many are in the room.</li>
            <li>You can commit ~6 hours a week for the first two months.</li>
          </ul>
        </aside>

        <form className="form-card" onSubmit={handleSubmit} noValidate>
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
            <span className="submit-note">Review takes 1-2 weeks.</span>
          </div>
          {formMessage ? <div className="form-error" style={{ display: 'block', marginTop: 12 }}>{formMessage}</div> : null}
        </form>
      </div>

      <SubmissionOverlay visible={showSuccess} formType="node-lead" />
    </>
  );
}
