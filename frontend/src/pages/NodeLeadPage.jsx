import { useEffect, useState } from 'react';
import DynamicField from '../components/DynamicField';
import PageHeader from '../components/PageHeader';
import SubmissionOverlay from '../components/SubmissionOverlay';
import { buildInitialValues, REDIRECT_DELAY_MS, validateAgainstSchema } from '../lib/forms';
import { getDefaultSchema, submitNodeLeadApplication } from '../lib/platform';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';

export default function NodeLeadPage() {
  const navigate = useNavigate();
  const [schema, setSchema] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
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
      <SEO
        title="Become a Node Lead"
        description="Lead AI Unplugged in your city, campus, or region. Apply to become a node lead and help grow a curated builder community inside the House of Starts ecosystem."
        path="/node-lead"
        schemas={[{
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aiunplugged.club' },
            { '@type': 'ListItem', position: 2, name: 'Node Lead', item: 'https://aiunplugged.club/node-lead' },
          ],
        }]}
      />
      <PageHeader
        label="Become a Node Lead"
        title="Grow a stronger"
        accent="local node."
        subtitle="Help shape AI Unplugged in your city, campus, community, builder cluster, or region by gathering strong people and keeping the room quality high."
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 0 }}>
          <div className="pitch-grid">
            <div className="pitch-card">
              <h3>Build local signal</h3>
              <p>Node Leads create better local rooms by gathering serious builders and making sure the right people keep meeting each other.</p>
            </div>
            <div className="pitch-card">
              <h3>Represent your cluster</h3>
              <p>This can be a city, a campus, a startup pocket, a creative community, or any builder network with real energy and follow-through.</p>
            </div>
            <div className="pitch-card">
              <h3>Compound opportunity</h3>
              <p>The best Node Leads do more than organize. They connect talent, momentum, and execution across local rooms that would otherwise stay scattered.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="form-layout">
        <aside className="form-aside">
          <h3>What we look for</h3>
          <p>We want people who care about room quality and follow-through, not just event volume.</p>
          <ul>
            <li>You can gather strong builders, founders, students, or operators.</li>
            <li>You know a local room, city, campus, or community that deserves sharper signal.</li>
            <li>You are willing to coordinate with the core team, not run a disconnected side project.</li>
            <li>You care about consistency, trust, and the long game of building a local node.</li>
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
            <span className="submit-note">We review Node Lead applications manually.</span>
          </div>
          {formMessage ? <div className="form-error" style={{ display: 'block', marginTop: 12 }}>{formMessage}</div> : null}
        </form>
      </div>

      <SubmissionOverlay visible={showSuccess} formType="node-lead" />
    </>
  );
}
