import { useEffect, useMemo, useState } from 'react';
import RichTextEditor from '../components/RichTextEditor';
import { useAuth } from '../context/useAuth';
import { formatEventStatusLabel, sortEventsByState } from '../lib/events';
import { defaultEventFormSchema, defaultNodeLeadFormSchema, FIELD_TYPES, UPDATE_CATEGORIES } from '../lib/defaultContent';
import {
  deleteDocument,
  exportDatasetForEvent,
  getAdminEvents,
  getAdminUpdates,
  getCommentsForAdmin,
  getEventRegistrations,
  getFormSchemas,
  getNodeLeadApplications,
  getSetupStatus,
  getSubscribers,
  grantAdminRole,
  importContentFile,
  leaveAdminRole,
  listAdmins,
  revokeAdminRole,
  saveEvent,
  saveFormSchema,
  saveUpdatePost,
  sendNewsletterCampaign,
  updateCommentStatus,
  updateReviewStatus
} from '../lib/platform';

const tabs = ['overview', 'events', 'node-lead', 'updates', 'comments', 'newsletter', 'admins'];

function baseNameField() {
  return {
    id: 'name',
    type: 'text',
    label: 'Name',
    placeholder: '',
    helperText: '',
    required: true,
    options: []
  };
}

function fieldTemplate() {
  return {
    id: `field-${Math.random().toString(36).slice(2, 8)}`,
    type: 'text',
    label: 'New field',
    placeholder: '',
    helperText: '',
    required: false,
    options: []
  };
}

function emptyEventDraft() {
  return {
    title: '',
    date: '',
    dateDisplay: '',
    location: '',
    type: 'Flagship',
    format: '',
    entry: 'Application',
    duration: '',
    capacity: 0,
    tagline: '',
    publishState: 'draft',
    status: 'upcoming',
    startTime: '',
    endTime: '',
    formId: '',
    registrationMode: 'default'
  };
}

function schemaFromEvent(event) {
  return {
    id: event.formId || '',
    kind: 'event',
    title: `${event.title || 'Event'} Custom Form`,
    isDefault: false,
    publishState: 'published',
    fields: [baseNameField()]
  };
}

function encodeFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      filename: file.name,
      mimeType: file.type,
      base64: String(reader.result || '').split(',').pop()
    });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function htmlToParagraphs(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function FieldBuilder({ schema, onChange }) {
  function updateField(index, key, value) {
    onChange({
      ...schema,
      fields: schema.fields.map((item, currentIndex) => (
        currentIndex === index ? { ...item, [key]: value } : item
      ))
    });
  }

  return (
    <div className="field-builder">
      {(schema.fields || []).map((field, index) => (
        <div className="field-builder-row" key={`${field.id}-${index}`}>
          <input className="form-input" value={field.label} placeholder="Label" onChange={(e) => updateField(index, 'label', e.target.value)} />
          <select className="form-select" value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)}>
            {FIELD_TYPES.filter((item) => item.value !== 'helper' || index !== 0).map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <input className="form-input" value={field.placeholder || ''} placeholder="Placeholder" onChange={(e) => updateField(index, 'placeholder', e.target.value)} />
          <input className="form-input" value={field.helperText || ''} placeholder="Helper text" onChange={(e) => updateField(index, 'helperText', e.target.value)} />
          <input className="form-input" value={(field.options || []).join(', ')} placeholder="Options" onChange={(e) => updateField(index, 'options', e.target.value.split(',').map((item) => item.trim()).filter(Boolean))} />
          <label className="checkbox-inline"><input type="checkbox" checked={Boolean(field.required)} onChange={(e) => updateField(index, 'required', e.target.checked)} />Required</label>
          {index > 0 ? (
            <button type="button" className="auth-link" onClick={() => onChange({ ...schema, fields: schema.fields.filter((_, currentIndex) => currentIndex !== index) })}>
              Remove
            </button>
          ) : null}
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={() => onChange({ ...schema, fields: [...(schema.fields || []), fieldTemplate()] })}>
        Add Field
      </button>
    </div>
  );
}

function downloadExportFile(result) {
  const binary = atob(result.base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: result.mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = result.filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function AdminPage() {
  const { loading, isAuthenticated, isAdmin, isFirebaseConfigured, setupWarnings } = useAuth();
  const [tab, setTab] = useState('overview');
  const [events, setEvents] = useState([]);
  const [forms, setForms] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [nodeLeads, setNodeLeads] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [comments, setComments] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [setupStatus, setSetupStatus] = useState({ warnings: [], diagnostics: null, mailProvider: 'brevo' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [eventDraft, setEventDraft] = useState(emptyEventDraft());
  const [eventCustomSchema, setEventCustomSchema] = useState(schemaFromEvent(emptyEventDraft()));
  const [nodeLeadMode, setNodeLeadMode] = useState('default');
  const [nodeLeadSchema, setNodeLeadSchema] = useState(defaultNodeLeadFormSchema);
  const [updateDraft, setUpdateDraft] = useState({ id: '', title: '', slug: '', excerpt: '', bodyHtml: '', category: 'update', commentMode: 'moderated', publishState: 'draft', authorName: 'AI Unplugged Team', scope: 'general', eventId: '' });
  const [newsletterDraft, setNewsletterDraft] = useState({ subject: '', html: '', text: '' });
  const [newsletterRecipientsUpload, setNewsletterRecipientsUpload] = useState(null);
  const [adminDraftEmail, setAdminDraftEmail] = useState('');
  const [selectedEventExportId, setSelectedEventExportId] = useState('');
  const [selectedUpdateId, setSelectedUpdateId] = useState('');

  const eventForms = useMemo(() => forms.filter((item) => item.kind === 'event'), [forms]);
  const nodeLeadForms = useMemo(() => forms.filter((item) => item.kind === 'nodeLead'), [forms]);
  const sortedEvents = useMemo(() => sortEventsByState(events), [events]);
  const selectedUpdateComments = useMemo(
    () => selectedUpdateId ? comments.filter((item) => item.updateId === selectedUpdateId) : comments,
    [comments, selectedUpdateId]
  );
  const updateLookup = useMemo(
    () => Object.fromEntries(updates.map((item) => [item.id, item])),
    [updates]
  );

  async function refreshAll() {
    setError('');
    const setup = await getSetupStatus().catch((nextError) => ({
      warnings: [nextError?.message || 'Could not read setup status.'],
      diagnostics: null,
      mailProvider: 'brevo'
    }));
    setSetupStatus(setup);

    if (!isAuthenticated || !isAdmin) return;

    try {
      const [nextEvents, nextForms, nextRegistrations, nextNodeLeads, nextUpdates, nextComments, nextSubscribers, nextAdmins] = await Promise.all([
        getAdminEvents(),
        getFormSchemas(),
        getEventRegistrations(),
        getNodeLeadApplications(),
        getAdminUpdates(),
        getCommentsForAdmin(),
        getSubscribers(),
        listAdmins()
      ]);

      setEvents(nextEvents);
      setForms(nextForms);
      setRegistrations(nextRegistrations);
      setNodeLeads(nextNodeLeads);
      setUpdates(nextUpdates);
      setComments(nextComments);
      setSubscribers(nextSubscribers);
      setAdmins(nextAdmins);

      const activeNodeLeadSchema = nextForms.find((item) => item.kind === 'nodeLead' && item.isDefault) || nextForms.find((item) => item.kind === 'nodeLead') || defaultNodeLeadFormSchema;
      setNodeLeadSchema(activeNodeLeadSchema);
      setNodeLeadMode(activeNodeLeadSchema.id === defaultNodeLeadFormSchema.id ? 'default' : 'custom');
    } catch (nextError) {
      setError(nextError?.message || 'Could not load admin data.');
    }
  }

  useEffect(() => {
    document.title = 'Admin - AI Unplugged';
    refreshAll();
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    setEventCustomSchema(schemaFromEvent(eventDraft));
  }, [eventDraft.id]);

  function resetMessages() {
    setMessage('');
    setError('');
  }

  function selectEvent(event) {
    const registrationMode = event.formId ? 'custom' : 'default';
    setEventDraft({ ...event, registrationMode });
    const schema = eventForms.find((item) => item.id === event.formId);
    setEventCustomSchema(schema || schemaFromEvent(event));
  }

  async function handleSaveEvent(event) {
    event.preventDefault();
    resetMessages();
    try {
      let formId = '';
      if (eventDraft.registrationMode === 'custom') {
        const savedFormId = await saveFormSchema({
          ...eventCustomSchema,
          id: eventCustomSchema.id || undefined,
          kind: 'event',
          title: eventCustomSchema.title || `${eventDraft.title || 'Event'} Custom Form`,
          isDefault: false,
          publishState: 'published',
          fields: eventCustomSchema.fields?.length ? eventCustomSchema.fields : [baseNameField()]
        });
        formId = savedFormId;
      }

      await saveEvent({
        ...eventDraft,
        formId
      });
      setEventDraft(emptyEventDraft());
      setEventCustomSchema(schemaFromEvent(emptyEventDraft()));
      setMessage('Event saved.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not save event.');
    }
  }

  async function handleSaveNodeLeadSchema(event) {
    event.preventDefault();
    resetMessages();
    try {
      await saveFormSchema({
        ...nodeLeadSchema,
        id: defaultNodeLeadFormSchema.id,
        kind: 'nodeLead',
        title: nodeLeadSchema.title || 'Node Lead Form',
        isDefault: true,
        publishState: 'published',
        fields: nodeLeadMode === 'default'
          ? defaultNodeLeadFormSchema.fields
          : (nodeLeadSchema.fields?.length ? nodeLeadSchema.fields : [baseNameField()])
      });
      setMessage('Node Lead form saved.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not save Node Lead form.');
    }
  }

  async function handleExport(format, eventId = '') {
    resetMessages();
    try {
      const result = await exportDatasetForEvent('eventRegistrations', format, eventId);
      downloadExportFile(result);
      setMessage('Event registration export prepared.');
    } catch (nextError) {
      setError(nextError?.message || 'Could not export event registrations.');
    }
  }

  async function handleNodeLeadExport(format) {
    resetMessages();
    try {
      const result = await exportDatasetForEvent('nodeLeadApplications', format);
      downloadExportFile(result);
      setMessage('Node Lead export prepared.');
    } catch (nextError) {
      setError(nextError?.message || 'Could not export Node Lead applications.');
    }
  }

  async function patchStatus(collectionName, id, value) {
    resetMessages();
    try {
      if (collectionName === 'comments') await updateCommentStatus(id, value);
      else await updateReviewStatus(collectionName, id, value);
      setMessage('Status updated.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not update status.');
    }
  }

  async function handleSaveUpdate(event) {
    event.preventDefault();
    resetMessages();
    try {
      await saveUpdatePost({
        ...updateDraft,
        slug: updateDraft.slug || updateDraft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        bodyHtml: updateDraft.bodyHtml,
        body: htmlToParagraphs(updateDraft.bodyHtml)
      });
      setUpdateDraft({ id: '', title: '', slug: '', excerpt: '', bodyHtml: '', category: 'update', commentMode: 'moderated', publishState: 'draft', authorName: 'AI Unplugged Team', scope: 'general', eventId: '' });
      setMessage('Update saved.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not save update.');
    }
  }

  async function handleImportIntoUpdate(file) {
    resetMessages();
    try {
      const upload = await encodeFile(file);
      const result = await importContentFile(upload);
      setUpdateDraft((current) => ({ ...current, bodyHtml: result.html }));
      setMessage(`Imported content from ${file.name}.`);
    } catch (nextError) {
      setError(nextError?.message || 'Could not import content file.');
    }
  }

  async function handleImportIntoNewsletter(file) {
    resetMessages();
    try {
      const upload = await encodeFile(file);
      const result = await importContentFile(upload);
      setNewsletterDraft((current) => ({ ...current, html: result.html, text: result.text }));
      setMessage(`Imported content from ${file.name}.`);
    } catch (nextError) {
      setError(nextError?.message || 'Could not import newsletter content.');
    }
  }

  async function handleNewsletterRecipientsFile(file) {
    resetMessages();
    try {
      const upload = await encodeFile(file);
      setNewsletterRecipientsUpload(upload);
      setMessage(`Recipient file ready: ${file.name}`);
    } catch (nextError) {
      setError(nextError?.message || 'Could not read recipient file.');
    }
  }

  async function handleSendCampaign(event) {
    event.preventDefault();
    resetMessages();
    try {
      const result = await sendNewsletterCampaign({
        ...newsletterDraft,
        recipientsUpload: newsletterRecipientsUpload
      });
      setMessage(`Newsletter sent to ${result.sent} recipients.`);
    } catch (nextError) {
      setError(nextError?.message || 'Could not send newsletter.');
    }
  }

  async function handleGrantAdmin(event) {
    event.preventDefault();
    resetMessages();
    try {
      await grantAdminRole({ email: adminDraftEmail });
      setAdminDraftEmail('');
      setMessage('Admin access granted.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not grant admin access.');
    }
  }

  async function handleRevokeAdmin(email) {
    resetMessages();
    try {
      await revokeAdminRole({ email });
      setMessage('Admin access revoked.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not revoke admin access.');
    }
  }

  async function handleLeaveAdmin() {
    resetMessages();
    try {
      await leaveAdminRole();
      setMessage('Your admin role was removed.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not remove your admin access.');
    }
  }

  if (loading) {
    return <div className="page-header"><p className="page-sub">Loading admin workspace...</p></div>;
  }

  if (!isAuthenticated) {
    return <div className="page-header"><h1>Log in to access admin.</h1><p className="page-sub">This area is only available to authenticated admins.</p></div>;
  }

  if (!isAdmin) {
    return (
      <div className="page-header">
        <h1>Admin access required.</h1>
        <p className="page-sub">Your account is signed in, but it does not currently have admin rights.</p>
        {setupWarnings.length ? <p className="page-sub">Current setup issue: {setupWarnings[0]}</p> : null}
      </div>
    );
  }

  if (!isFirebaseConfigured) {
    return <div className="page-header"><h1>Configure Firebase first.</h1><p className="page-sub">Add the Firebase client env values first, then start the local backend with a service account file to use admin tools.</p></div>;
  }

  return (
    <section className="section-wrap admin-wrap">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <p className="section-label">Admin</p>
          {tabs.map((item) => (
            <button type="button" key={item} className={`admin-tab${tab === item ? ' is-active' : ''}`} onClick={() => setTab(item)}>
              {item}
            </button>
          ))}
        </aside>

        <div className="admin-main">
          {message ? <div className="auth-success">{message}</div> : null}
          {error ? <div className="form-error" style={{ display: 'block' }}>{error}</div> : null}

          {tab === 'overview' ? (
            <>
              <div className="admin-grid">
                <div className="dashboard-card"><h3>Events</h3><p>{events.length} tracked events</p></div>
                <div className="dashboard-card"><h3>Registrations</h3><p>{registrations.length} event registrations</p></div>
                <div className="dashboard-card"><h3>Node Leads</h3><p>{nodeLeads.length} applications</p></div>
                <div className="dashboard-card"><h3>Updates</h3><p>{updates.length} content items</p></div>
                <div className="dashboard-card"><h3>Subscribers</h3><p>{subscribers.length} contacts</p></div>
                <div className="dashboard-card"><h3>Admins</h3><p>{admins.length} active admins</p></div>
              </div>
              <div className="dashboard-card">
                <h3>Local backend setup</h3>
                <div className="admin-kv-list">
                  <div className="detail-row"><span className="label">Mail provider</span><span className="val">{setupStatus.mailProvider}</span></div>
                  <div className="detail-row"><span className="label">Firebase Admin</span><span className="val">{setupStatus.diagnostics?.firebaseAdmin?.status || 'unknown'}</span></div>
                  <div className="detail-row"><span className="label">Service account path</span><span className="val">{setupStatus.diagnostics?.firebaseAdmin?.resolvedPath || 'not resolved'}</span></div>
                </div>
                {setupStatus.warnings?.length ? (
                  <div className="admin-list">
                    {setupStatus.warnings.map((warning) => <div className="admin-list-row" key={warning}><span>{warning}</span></div>)}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {tab === 'events' ? (
            <div className="admin-section">
              <form className="form-card" onSubmit={handleSaveEvent}>
                <h3>Create or update event</h3>
                <div className="form-field field-inline-2">
                  <div className="form-field"><label className="form-label">Title</label><input className="form-input" value={eventDraft.title} onChange={(e) => setEventDraft((c) => ({ ...c, title: e.target.value }))} /></div>
                  <div className="form-field"><label className="form-label">Format</label><input className="form-input" value={eventDraft.format} onChange={(e) => setEventDraft((c) => ({ ...c, format: e.target.value }))} /></div>
                </div>
                <div className="form-field field-inline-2">
                  <div className="form-field"><label className="form-label">Date</label><input className="form-input" type="date" value={eventDraft.date} onChange={(e) => setEventDraft((c) => ({ ...c, date: e.target.value }))} /></div>
                  <div className="form-field"><label className="form-label">Display date</label><input className="form-input" value={eventDraft.dateDisplay} onChange={(e) => setEventDraft((c) => ({ ...c, dateDisplay: e.target.value }))} /></div>
                </div>
                <div className="form-field field-inline-2">
                  <div className="form-field"><label className="form-label">Location</label><input className="form-input" value={eventDraft.location} onChange={(e) => setEventDraft((c) => ({ ...c, location: e.target.value }))} /></div>
                  <div className="form-field"><label className="form-label">Duration</label><input className="form-input" value={eventDraft.duration} onChange={(e) => setEventDraft((c) => ({ ...c, duration: e.target.value }))} /></div>
                </div>
                <div className="form-field field-inline-2">
                  <div className="form-field"><label className="form-label">Start time</label><input className="form-input" type="time" value={eventDraft.startTime || ''} onChange={(e) => setEventDraft((c) => ({ ...c, startTime: e.target.value }))} /></div>
                  <div className="form-field"><label className="form-label">End time</label><input className="form-input" type="time" value={eventDraft.endTime || ''} onChange={(e) => setEventDraft((c) => ({ ...c, endTime: e.target.value }))} /></div>
                </div>
                <div className="form-field field-inline-2">
                  <div className="form-field"><label className="form-label">Type</label><select className="form-select" value={eventDraft.type} onChange={(e) => setEventDraft((c) => ({ ...c, type: e.target.value }))}><option>Flagship</option><option>Execution</option><option>Showcase</option><option>Opportunity</option></select></div>
                  <div className="form-field"><label className="form-label">Entry</label><select className="form-select" value={eventDraft.entry} onChange={(e) => setEventDraft((c) => ({ ...c, entry: e.target.value }))}><option>Application</option><option>Open</option><option>Invite Only</option><option>Curated</option></select></div>
                </div>
                <div className="form-field field-inline-2">
                  <div className="form-field"><label className="form-label">Publish state</label><select className="form-select" value={eventDraft.publishState} onChange={(e) => setEventDraft((c) => ({ ...c, publishState: e.target.value }))}><option value="draft">draft</option><option value="published">published</option></select></div>
                  <div className="form-field"><label className="form-label">Capacity</label><input className="form-input" type="number" value={eventDraft.capacity || 0} onChange={(e) => setEventDraft((c) => ({ ...c, capacity: Number(e.target.value) }))} /></div>
                </div>
                <div className="form-field"><label className="form-label">Tagline</label><textarea className="form-textarea" value={eventDraft.tagline} onChange={(e) => setEventDraft((c) => ({ ...c, tagline: e.target.value }))} /></div>
                <div className="form-field">
                  <label className="form-label">Registration form</label>
                  <select className="form-select" value={eventDraft.registrationMode || 'default'} onChange={(e) => setEventDraft((c) => ({ ...c, registrationMode: e.target.value }))}>
                    <option value="default">Use default form</option>
                    <option value="custom">Use custom form</option>
                  </select>
                </div>
                {eventDraft.registrationMode === 'custom' ? (
                  <div className="dashboard-card">
                    <h3>Custom event form</h3>
                    <div className="form-field"><label className="form-label">Form title</label><input className="form-input" value={eventCustomSchema.title || ''} onChange={(e) => setEventCustomSchema((c) => ({ ...c, title: e.target.value }))} /></div>
                    <FieldBuilder schema={eventCustomSchema} onChange={setEventCustomSchema} />
                  </div>
                ) : null}
                <button type="submit" className="btn-primary">Save Event</button>
              </form>

              <div className="dashboard-card">
                <div className="admin-inline-actions">
                  <h3>Registrations and export</h3>
                  <div className="admin-inline-actions">
                    <select className="form-select" value={selectedEventExportId} onChange={(e) => setSelectedEventExportId(e.target.value)}>
                      <option value="">All events</option>
                      {sortedEvents.map((item) => <option key={item.id} value={item.id}>{item.title} ({formatEventStatusLabel(item)})</option>)}
                    </select>
                    <button type="button" className="btn-secondary" onClick={() => handleExport('csv', selectedEventExportId)}>CSV</button>
                    <button type="button" className="btn-secondary" onClick={() => handleExport('xlsx', selectedEventExportId)}>XLSX</button>
                    <button type="button" className="btn-secondary" onClick={() => handleExport('json', selectedEventExportId)}>JSON</button>
                  </div>
                </div>
                <div className="admin-table">
                  {registrations
                    .filter((item) => !selectedEventExportId || item.eventId === selectedEventExportId)
                    .map((item) => (
                      <div className="admin-table-row" key={item.id}>
                        <div><strong>{item.name || item.answers?.name || 'Unnamed'}</strong><p>{item.email || item.answers?.email}</p><p>{item.registrationId}</p></div>
                        <div>{item.eventTitle}</div>
                        <select className="form-select" value={item.reviewStatus || 'pending'} onChange={(e) => patchStatus('eventRegistrations', item.id, e.target.value)}>
                          <option value="pending">pending</option>
                          <option value="shortlisted">shortlisted</option>
                          <option value="accepted">accepted</option>
                          <option value="rejected">rejected</option>
                        </select>
                      </div>
                    ))}
                </div>
              </div>

              <div className="dashboard-card">
                <h3>Current events</h3>
                <div className="admin-list">
                  {sortedEvents.map((item) => (
                    <button type="button" className="admin-list-row" key={item.id} onClick={() => selectEvent(item)}>
                      <span>{item.title}</span>
                      <span>{formatEventStatusLabel(item)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'node-lead' ? (
            <div className="admin-section">
              <form className="form-card" onSubmit={handleSaveNodeLeadSchema}>
                <h3>Node Lead form</h3>
                <div className="form-field">
                  <label className="form-label">Form mode</label>
                  <select className="form-select" value={nodeLeadMode} onChange={(e) => setNodeLeadMode(e.target.value)}>
                    <option value="default">Use default form</option>
                    <option value="custom">Use custom form</option>
                  </select>
                </div>
                {nodeLeadMode === 'custom' ? (
                  <>
                    <div className="form-field"><label className="form-label">Form title</label><input className="form-input" value={nodeLeadSchema.title || ''} onChange={(e) => setNodeLeadSchema((c) => ({ ...c, title: e.target.value }))} /></div>
                    <FieldBuilder schema={nodeLeadSchema} onChange={setNodeLeadSchema} />
                  </>
                ) : (
                  <div className="dashboard-card"><p>Default Node Lead form is active.</p></div>
                )}
                <button type="submit" className="btn-primary">Save Node Lead Form</button>
              </form>

              <div className="dashboard-card">
                <div className="admin-inline-actions">
                  <h3>Node Lead submissions</h3>
                  <div className="admin-inline-actions">
                    <button type="button" className="btn-secondary" onClick={() => handleNodeLeadExport('csv')}>CSV</button>
                    <button type="button" className="btn-secondary" onClick={() => handleNodeLeadExport('xlsx')}>XLSX</button>
                    <button type="button" className="btn-secondary" onClick={() => handleNodeLeadExport('json')}>JSON</button>
                  </div>
                </div>
                <div className="admin-table">
                  {nodeLeads.map((item) => (
                    <div className="admin-table-row" key={item.id}>
                      <div><strong>{item.name || item.answers?.name || 'Unnamed'}</strong><p>{item.email || item.answers?.email}</p></div>
                      <div>{item.reviewStatus}</div>
                      <select className="form-select" value={item.reviewStatus || 'pending'} onChange={(e) => patchStatus('nodeLeadApplications', item.id, e.target.value)}>
                        <option value="pending">pending</option>
                        <option value="shortlisted">shortlisted</option>
                        <option value="accepted">accepted</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'updates' ? (
            <div className="admin-section">
              <form className="form-card" onSubmit={handleSaveUpdate}>
                <h3>Create or update post</h3>
                <div className="form-field"><label className="form-label">Title</label><input className="form-input" value={updateDraft.title} onChange={(e) => setUpdateDraft((c) => ({ ...c, title: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Slug</label><input className="form-input" value={updateDraft.slug} onChange={(e) => setUpdateDraft((c) => ({ ...c, slug: e.target.value }))} /></div>
                <div className="form-field"><label className="form-label">Excerpt</label><textarea className="form-textarea" value={updateDraft.excerpt} onChange={(e) => setUpdateDraft((c) => ({ ...c, excerpt: e.target.value }))} /></div>
                <div className="form-field">
                  <label className="form-label">Body</label>
                  <RichTextEditor value={updateDraft.bodyHtml} onChange={(value) => setUpdateDraft((c) => ({ ...c, bodyHtml: value }))} />
                  <input type="file" accept=".txt,.docx" onChange={(e) => e.target.files?.[0] && handleImportIntoUpdate(e.target.files[0])} />
                </div>
                <div className="form-field field-inline-2">
                  <div className="form-field"><label className="form-label">Category</label><select className="form-select" value={updateDraft.category} onChange={(e) => setUpdateDraft((c) => ({ ...c, category: e.target.value }))}>{UPDATE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
                  <div className="form-field"><label className="form-label">Comment mode</label><select className="form-select" value={updateDraft.commentMode} onChange={(e) => setUpdateDraft((c) => ({ ...c, commentMode: e.target.value }))}><option value="disabled">disabled</option><option value="auto-publish">auto-publish</option><option value="moderated">moderated</option></select></div>
                </div>
                <div className="form-field field-inline-2">
                  <div className="form-field"><label className="form-label">Update scope</label><select className="form-select" value={updateDraft.scope || 'general'} onChange={(e) => setUpdateDraft((c) => ({ ...c, scope: e.target.value, eventId: e.target.value === 'event' ? c.eventId : '' }))}><option value="general">general</option><option value="event">event-specific</option></select></div>
                  {updateDraft.scope === 'event' ? (
                    <div className="form-field"><label className="form-label">Event</label><select className="form-select" value={updateDraft.eventId || ''} onChange={(e) => setUpdateDraft((c) => ({ ...c, eventId: e.target.value }))}><option value="">Select event</option>{sortedEvents.map((item) => <option key={item.id} value={item.id}>{item.title} ({formatEventStatusLabel(item)})</option>)}</select></div>
                  ) : <div />}
                </div>
                <div className="form-field field-inline-2">
                  <div className="form-field"><label className="form-label">Publish state</label><select className="form-select" value={updateDraft.publishState} onChange={(e) => setUpdateDraft((c) => ({ ...c, publishState: e.target.value }))}><option value="draft">draft</option><option value="published">published</option></select></div>
                  <div className="form-field"><label className="form-label">Author</label><input className="form-input" value={updateDraft.authorName} onChange={(e) => setUpdateDraft((c) => ({ ...c, authorName: e.target.value }))} /></div>
                </div>
                <button type="submit" className="btn-primary">Save Update</button>
              </form>

              <div className="dashboard-card">
                <h3>Posts</h3>
                <div className="admin-list">
                  {updates.map((post) => (
                    <div className="admin-list-row" key={post.id}>
                      <button type="button" onClick={() => setUpdateDraft({ ...post, scope: post.scope || 'general', eventId: post.eventId || '', bodyHtml: post.bodyHtml || (post.body || []).map((paragraph) => `<p>${paragraph}</p>`).join('') })}>{post.title}</button>
                      <button type="button" className="auth-link" onClick={() => deleteDocument('updates', post.id).then(refreshAll)}>Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'comments' ? (
            <div className="admin-section">
              <div className="dashboard-card">
                <div className="admin-inline-actions">
                  <h3>Comment inbox</h3>
                  <select className="form-select" value={selectedUpdateId} onChange={(e) => setSelectedUpdateId(e.target.value)}>
                    <option value="">All updates</option>
                    {updates.map((post) => <option key={post.id} value={post.id}>{post.title}</option>)}
                  </select>
                </div>
                <div className="admin-table">
                  {selectedUpdateComments.map((item) => {
                    const update = updateLookup[item.updateId];
                    const updatePublished = update?.publishedAt ? new Date(update.publishedAt).toLocaleString() : 'Draft or fallback';
                    const commentCreated = typeof item.createdAt?.toDate === 'function'
                      ? item.createdAt.toDate().toLocaleString()
                      : item.createdAt
                        ? new Date(item.createdAt).toLocaleString()
                        : 'Unknown time';
                    return (
                      <div className="admin-table-row admin-comment-row" key={item.id}>
                        <div>
                          <strong>{update?.title || item.updateSlug || 'Update'}</strong>
                          <p>Update published: {updatePublished}</p>
                          <p>Comment by {item.authorName || item.authorEmail || 'Member'}{item.authorEmail ? ` · ${item.authorEmail}` : ''}</p>
                          <p>Commented: {commentCreated}</p>
                          <p>{item.body}</p>
                        </div>
                        <div>{item.status || 'pending'}</div>
                        <select className="form-select" value={item.status || 'pending'} onChange={(e) => patchStatus('comments', item.id, e.target.value)}>
                          <option value="pending">pending</option>
                          <option value="approved">approved</option>
                          <option value="rejected">rejected</option>
                        </select>
                      </div>
                    );
                  })}
                  {!selectedUpdateComments.length ? <div className="empty-state">No comments in this view yet.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'newsletter' ? (
            <div className="admin-section">
              <form className="form-card" onSubmit={handleSendCampaign}>
                <h3>Send newsletter / update</h3>
                <div className="form-field"><label className="form-label">Subject</label><input className="form-input" value={newsletterDraft.subject} onChange={(e) => setNewsletterDraft((c) => ({ ...c, subject: e.target.value }))} /></div>
                <div className="form-field">
                  <label className="form-label">Body</label>
                  <RichTextEditor value={newsletterDraft.html} onChange={(value) => setNewsletterDraft((c) => ({ ...c, html: value }))} />
                  <input type="file" accept=".txt,.docx" onChange={(e) => e.target.files?.[0] && handleImportIntoNewsletter(e.target.files[0])} />
                </div>
                <div className="form-field"><label className="form-label">Plain text</label><textarea className="form-textarea" value={newsletterDraft.text} onChange={(e) => setNewsletterDraft((c) => ({ ...c, text: e.target.value }))} /></div>
                <div className="form-field">
                  <label className="form-label">Recipient upload override</label>
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleNewsletterRecipientsFile(e.target.files[0])} />
                  {newsletterRecipientsUpload ? <p className="page-sub">Using uploaded audience: {newsletterRecipientsUpload.filename}</p> : null}
                </div>
                <button type="submit" className="btn-primary">Send Newsletter</button>
              </form>

              <div className="dashboard-card">
                <h3>Subscribers</h3>
                <div className="admin-list">
                  {subscribers.map((subscriber) => (
                    <div className="admin-list-row" key={subscriber.id}>
                      <span>{subscriber.email}</span>
                      <span>{subscriber.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'admins' ? (
            <div className="admin-section">
              <form className="form-card" onSubmit={handleGrantAdmin}>
                <h3>Grant admin access</h3>
                <p className="page-sub">Use the email of an existing Firebase user account.</p>
                <div className="form-field">
                  <label className="form-label">User email</label>
                  <input className="form-input" value={adminDraftEmail} onChange={(e) => setAdminDraftEmail(e.target.value)} />
                </div>
                <button type="submit" className="btn-primary">Grant Admin</button>
              </form>

              <div className="dashboard-card">
                <div className="admin-inline-actions">
                  <h3>Current admins</h3>
                  <button type="button" className="btn-secondary" onClick={handleLeaveAdmin}>Remove My Admin Access</button>
                </div>
                <div className="admin-table">
                  {admins.map((adminUser) => (
                    <div className="admin-table-row" key={adminUser.id}>
                      <div>
                        <strong>{adminUser.displayName || adminUser.email || adminUser.id}</strong>
                        <p>{adminUser.email || adminUser.id}</p>
                      </div>
                      <button type="button" className="auth-link" onClick={() => handleRevokeAdmin(adminUser.email)}>
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
