import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RichTextEditor from '../components/RichTextEditor';
import { useAuth } from '../context/useAuth';
import { formatEventStatusLabel, resolveHomeSpotlightEvents, sortEventsByState } from '../lib/events';
import { defaultNodeLeadFormSchema, FIELD_TYPES, UPDATE_CATEGORIES } from '../lib/defaultContent';
import {
  deleteDocument,
  exportDatasetForEvent,
  getAdminEvents,
  getAdminResources,
  getAdminUpdates,
  getCommentsForAdmin,
  getEventRegistrations,
  getErrorLogs,
  getEventInvites,
  getFormSchemas,
  getHostApplications,
  getNodeLeadApplications,
  getHomeSpotlightSettings,
  getSetupStatus,
  getSubscribers,
  grantAdminRole,
  addEventInvite,
  importEventInvites,
  importContentFile,
  leaveAdminRole,
  listAdmins,
  revokeAdminRole,
  saveEvent,
  saveFormSchema,
  saveHomeSpotlightSettings,
  saveResource,
  saveUpdatePost,
  sendEventInvites,
  sendNewsletterCampaign,
  updateNewsletterPreference,
  updateCommentStatus,
  updateReviewStatus,
  uploadAttachment,
  uploadResourceImage,
  revokeEventInvite
} from '../lib/platform';
import {
  downloadSkillMarkdown,
  deleteSkillSubmission,
  formatSkillFileSize,
  getAdminSkills,
  reviewSkillSubmission
} from '../lib/skilldb';

const TAB_LABELS = {
  overview: 'Overview',
  events: 'Events',
  'node-lead': 'Node Lead',
  hosts: 'Hosts',
  updates: 'Updates',
  resources: 'Resources',
  skills: 'Skills',
  newsletter: 'Newsletter',
  profile: 'Profile',
  errors: 'Errors',
  admins: 'Admins'
};
const tabs = Object.keys(TAB_LABELS);

const TAB_ICONS = {
  overview: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  events: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 7h14" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  'node-lead': (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 14c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 8v4M10 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  hosts: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.25l5.5 4v6.25A1.5 1.5 0 0 1 12 14H4a1.5 1.5 0 0 1-1.5-1.5V6.25l5.5-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6 14V9.5h4V14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  updates: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  resources: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4.5 5.5h7M4.5 8h4.5M9.75 10.5l1.4-1.4 1.85 1.85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  skills: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5.5h6M5 8h6M5 10.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  newsletter: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 5.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  profile: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  errors: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2l6 11H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 6v3M8 11.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  admins: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5L2 4.5v4.5c0 3 2.686 5.5 6 5.5s6-2.5 6-5.5V4.5L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
};

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

function formatDateForDisplay(dateValue) {
  const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatAdminDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
}

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function emptyResourceDraft() {
  return {
    id: '',
    title: '',
    slug: '',
    excerpt: '',
    bodyHtml: '',
    ctaLabel: 'Open resource',
    ctaUrl: '',
    image: null,
    publishState: 'draft'
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

function normalizeFieldsForCompare(fields = []) {
  return fields.map((field) => ({
    id: String(field.id || ''),
    type: String(field.type || 'text'),
    label: String(field.label || ''),
    required: Boolean(field.required),
    placeholder: String(field.placeholder || ''),
    helperText: String(field.helperText || ''),
    options: Array.isArray(field.options) ? field.options.map(String) : [],
    minLength: field.minLength || '',
    showWhen: field.showWhen || null
  }));
}

function fieldsMatch(left = [], right = []) {
  return JSON.stringify(normalizeFieldsForCompare(left)) === JSON.stringify(normalizeFieldsForCompare(right));
}

function isDefaultNodeLeadSchema(schema) {
  return fieldsMatch(schema?.fields || [], defaultNodeLeadFormSchema.fields);
}

function validateEventDraft(draft) {
  const missing = [];
  if (!String(draft.title || '').trim()) missing.push('Title');
  if (!String(draft.date || '').trim()) missing.push('Date');
  if (!String(draft.location || '').trim()) missing.push('Location');
  if (!String(draft.type || '').trim()) missing.push('Type');
  if (!String(draft.entry || '').trim()) missing.push('Entry');
  if (!String(draft.publishState || '').trim()) missing.push('Publish state');
  return missing;
}

function AnswerDetails({ answers }) {
  const entries = Object.entries(answers || {}).filter(([, value]) => value !== '' && value != null);
  if (!entries.length) return null;

  return (
    <details className="admin-answer-details">
      <summary>View answers</summary>
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
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

function SubNav({ items, active, onChange }) {
  return (
    <div className="admin-sub-nav">
      {items.map(({ key, label }) => (
        <button
          type="button"
          key={key}
          className={`admin-sub-nav-item${active === key ? ' is-active' : ''}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { loading, isAuthenticated, isAdmin, isFirebaseConfigured, setupWarnings, profile, user, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') && tabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview');
  const [eventsSubTab, setEventsSubTab] = useState('events');
  const [nodeLeadSubTab, setNodeLeadSubTab] = useState('applications');
  const [updatesSubTab, setUpdatesSubTab] = useState('posts');

  const [events, setEvents] = useState([]);
  const [forms, setForms] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [nodeLeads, setNodeLeads] = useState([]);
  const [hostApplications, setHostApplications] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [resources, setResources] = useState([]);
  const [skills, setSkills] = useState([]);
  const [comments, setComments] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [errorLogs, setErrorLogs] = useState([]);
  const [eventInvites, setEventInvites] = useState([]);
  const [setupStatus, setSetupStatus] = useState({ warnings: [], diagnostics: null, mailProvider: 'brevo' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [eventFormError, setEventFormError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [publishSuccess, setPublishSuccess] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [homeSpotlightIds, setHomeSpotlightIds] = useState([]);
  const [spotlightModalOpen, setSpotlightModalOpen] = useState(false);
  const [spotlightDraftIds, setSpotlightDraftIds] = useState([]);
  const [spotlightSelectionError, setSpotlightSelectionError] = useState('');

  const [eventDraft, setEventDraft] = useState(emptyEventDraft());
  const [eventCustomSchema, setEventCustomSchema] = useState(schemaFromEvent(emptyEventDraft()));
  const [inviteDraft, setInviteDraft] = useState({ name: '', email: '' });
  const [nodeLeadMode, setNodeLeadMode] = useState('default');
  const [nodeLeadSchema, setNodeLeadSchema] = useState(defaultNodeLeadFormSchema);
  const [updateDraft, setUpdateDraft] = useState({ id: '', title: '', slug: '', excerpt: '', bodyHtml: '', category: 'update', commentMode: 'moderated', publishState: 'draft', authorName: 'AI Unplugged Team', scope: 'general', eventId: '', attachments: [] });
  const [resourceDraft, setResourceDraft] = useState(emptyResourceDraft());
  const [newsletterDraft, setNewsletterDraft] = useState({ subject: '', html: '', text: '' });
  const [newsletterRecipientsUpload, setNewsletterRecipientsUpload] = useState(null);
  const [adminDraftEmail, setAdminDraftEmail] = useState('');
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isUploadingResourceImage, setIsUploadingResourceImage] = useState(false);
  const [selectedEventExportId, setSelectedEventExportId] = useState('');
  const [selectedUpdateId, setSelectedUpdateId] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const eventFormRef = useRef(null);
  const eventTitleRef = useRef(null);
  const updateFormRef = useRef(null);
  const updateTitleRef = useRef(null);
  const resourceFormRef = useRef(null);
  const resourceTitleRef = useRef(null);
  const refreshInFlightRef = useRef(false);

  const eventForms = useMemo(() => forms.filter((item) => item.kind === 'event'), [forms]);
  const sortedEvents = useMemo(() => sortEventsByState(events), [events]);
  const eligibleSpotlightEvents = useMemo(
    () => sortedEvents.filter((item) => item.publishState === 'published' && (item.derivedStatus === 'ongoing' || item.derivedStatus === 'upcoming')),
    [sortedEvents]
  );
  const validHomeSpotlightIds = useMemo(
    () => homeSpotlightIds.filter((id) => eligibleSpotlightEvents.some((item) => item.id === id)).slice(0, 2),
    [eligibleSpotlightEvents, homeSpotlightIds]
  );
  const resolvedSpotlightEvents = useMemo(
    () => resolveHomeSpotlightEvents(events, homeSpotlightIds),
    [events, homeSpotlightIds]
  );
  const selectedUpdateComments = useMemo(
    () => selectedUpdateId ? comments.filter((item) => item.updateId === selectedUpdateId) : comments,
    [comments, selectedUpdateId]
  );
  const updateLookup = useMemo(
    () => Object.fromEntries(updates.map((item) => [item.id, item])),
    [updates]
  );
  const eventLookup = useMemo(
    () => Object.fromEntries(events.map((item) => [item.id, item])),
    [events]
  );
  const filteredRegistrations = useMemo(
    () => registrations.filter((item) => !selectedEventExportId || item.eventId === selectedEventExportId),
    [registrations, selectedEventExportId]
  );
  const skillsByState = useMemo(() => ({
    pending: skills.filter((skill) => skill.publishState === 'pending'),
    published: skills.filter((skill) => skill.publishState === 'published'),
    rejected: skills.filter((skill) => skill.publishState === 'rejected')
  }), [skills]);
  const registrationStats = useMemo(() => {
    const counts = {
      total: filteredRegistrations.length,
      accepted: 0,
      pending: 0,
      waitlisted: 0,
      rejected: 0,
    };

    for (const item of filteredRegistrations) {
      const status = String(item.reviewStatus || 'pending').toLowerCase();
      if (status === 'accepted') counts.accepted += 1;
      else if (status === 'waitlisted') counts.waitlisted += 1;
      else if (status === 'rejected') counts.rejected += 1;
      else counts.pending += 1;
    }

    return counts;
  }, [filteredRegistrations]);
  const registrationsByStatus = useMemo(() => ({
    accepted: filteredRegistrations.filter((item) => item.reviewStatus === 'accepted'),
    pending: filteredRegistrations.filter((item) => !['accepted', 'waitlisted', 'rejected'].includes(item.reviewStatus || 'pending')),
    waitlisted: filteredRegistrations.filter((item) => item.reviewStatus === 'waitlisted'),
    rejected: filteredRegistrations.filter((item) => item.reviewStatus === 'rejected')
  }), [filteredRegistrations]);

  const refreshAll = useCallback(async ({ silent = false } = {}) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setIsRefreshing(true);
    if (!silent) setError('');
    try {
      const setup = await getSetupStatus().catch((nextError) => ({
        warnings: [nextError?.message || 'Could not read setup status.'],
        diagnostics: null,
        mailProvider: 'brevo'
      }));
      setSetupStatus(setup);

      if (!isAuthenticated || !isAdmin) return;

      const [nextEvents, nextForms, nextRegistrations, nextNodeLeads, nextHostApplications, nextUpdates, nextResources, nextSkills, nextComments, nextSubscribers, nextAdmins, nextHomeSettings, nextErrorLogs] = await Promise.all([
        getAdminEvents(),
        getFormSchemas(),
        getEventRegistrations(),
        getNodeLeadApplications(),
        getHostApplications(),
        getAdminUpdates(),
        getAdminResources(),
        getAdminSkills(),
        getCommentsForAdmin(),
        getSubscribers(),
        listAdmins(),
        getHomeSpotlightSettings(),
        getErrorLogs()
      ]);

      setEvents(nextEvents);
      setForms(nextForms);
      setRegistrations(nextRegistrations);
      setNodeLeads(nextNodeLeads);
      setHostApplications(nextHostApplications);
      setUpdates(nextUpdates);
      setResources(nextResources);
      setSkills(nextSkills);
      setComments(nextComments);
      setSubscribers(nextSubscribers);
      setAdmins(nextAdmins);
      setErrorLogs(nextErrorLogs);
      setHomeSpotlightIds(Array.isArray(nextHomeSettings?.featuredHomeEventIds) ? nextHomeSettings.featuredHomeEventIds.slice(0, 2) : []);
      setLastRefreshedAt(new Date());

      if (tab !== 'node-lead' || nodeLeadSubTab !== 'form-builder') {
        const activeNodeLeadSchema = nextForms.find((item) => item.kind === 'nodeLead' && item.isDefault) || nextForms.find((item) => item.kind === 'nodeLead') || defaultNodeLeadFormSchema;
        setNodeLeadSchema(activeNodeLeadSchema);
        setNodeLeadMode(isDefaultNodeLeadSchema(activeNodeLeadSchema) ? 'default' : 'custom');
      }
    } catch (nextError) {
      if (!silent) setError(nextError?.message || 'Could not load admin data.');
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [isAuthenticated, isAdmin, nodeLeadSubTab, tab]);

  useEffect(() => {
    document.title = 'Admin - AI Unplugged';
    refreshAll();
  }, [isAuthenticated, isAdmin, refreshAll]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return undefined;
    const interval = window.setInterval(() => refreshAll({ silent: true }), 15000);
    const refreshWhenActive = () => refreshAll({ silent: true });
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshAll({ silent: true });
    };
    window.addEventListener('focus', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [isAuthenticated, isAdmin, refreshAll]);

  useEffect(() => {
    const currentParamTab = searchParams.get('tab');
    if (currentParamTab && tabs.includes(currentParamTab) && currentParamTab !== tab) {
      setTab(currentParamTab);
    }
  }, [searchParams, tab]);

  useEffect(() => {
    setEventCustomSchema(schemaFromEvent(eventDraft));
  }, [eventDraft.id]);

  useEffect(() => {
    if (!eventDraft.id) {
      setEventInvites([]);
      return;
    }
    getEventInvites(eventDraft.id)
      .then(setEventInvites)
      .catch((nextError) => setError(nextError?.message || 'Could not load event invites.'));
  }, [eventDraft.id]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  function resetMessages() {
    setMessage('');
    setError('');
    setEventFormError('');
  }

  function changeTab(nextTab) {
    setTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'overview') nextParams.delete('tab');
    else nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  }

  function scrollToEditableForm(formRef, focusRef) {
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => focusRef.current?.focus(), 250);
    });
  }

  function openSpotlightModal() {
    setSpotlightDraftIds(validHomeSpotlightIds);
    setSpotlightSelectionError('');
    setSpotlightModalOpen(true);
  }

  function closeSpotlightModal() {
    setSpotlightModalOpen(false);
    setSpotlightSelectionError('');
  }

  function toggleSpotlightSelection(eventId) {
    setSpotlightSelectionError('');
    setSpotlightDraftIds((current) => {
      if (current.includes(eventId)) return current.filter((id) => id !== eventId);
      if (current.length >= 2) {
        setSpotlightSelectionError('Choose up to two events for the home spotlight.');
        return current;
      }
      return [...current, eventId];
    });
  }

  function selectEvent(event) {
    const registrationMode = event.formId ? 'custom' : 'default';
    setEventDraft({ ...event, registrationMode, dateDisplay: formatDateForDisplay(event.date) });
    const schema = eventForms.find((item) => item.id === event.formId);
    setEventCustomSchema(schema || schemaFromEvent(event));
    changeTab('events');
    setEventsSubTab('events');
    scrollToEditableForm(eventFormRef, eventTitleRef);
  }

function selectResource(resource) {
    changeTab('resources');
    setResourceDraft({
      id: resource.id || '',
      title: resource.title || '',
      slug: resource.slug || '',
      excerpt: resource.excerpt || '',
      bodyHtml: resource.bodyHtml || (resource.body || []).map((paragraph) => `<p>${paragraph}</p>`).join(''),
      ctaLabel: resource.ctaLabel || 'Open resource',
      ctaUrl: resource.ctaUrl || '',
      image: resource.image || null,
      publishState: resource.publishState || 'draft'
    });
    scrollToEditableForm(resourceFormRef, resourceTitleRef);
  }

  function selectUpdate(post) {
    changeTab('updates');
    setUpdatesSubTab('posts');
    setUpdateDraft({
      ...post,
      scope: post.scope || 'general',
      eventId: post.eventId || '',
      attachments: post.attachments || [],
      bodyHtml: post.bodyHtml || (post.body || []).map((paragraph) => `<p>${paragraph}</p>`).join('')
    });
    scrollToEditableForm(updateFormRef, updateTitleRef);
  }

  async function handleSaveEvent(event) {
    event.preventDefault();
    resetMessages();
    const missingFields = validateEventDraft(eventDraft);
    if (missingFields.length) {
      setEventFormError(`Add ${missingFields.join(', ')} before saving this event.`);
      scrollToEditableForm(eventFormRef, eventTitleRef);
      return;
    }
    setIsSaving(true);
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

      const savedId = await saveEvent({
        ...eventDraft,
        dateDisplay: formatDateForDisplay(eventDraft.date),
        formId
      });
      const isPublished = eventDraft.publishState === 'published';
      setEventDraft(emptyEventDraft());
      setEventCustomSchema(schemaFromEvent(emptyEventDraft()));
      setMessage(isPublished ? 'Event published.' : 'Event saved as draft.');
      if (isPublished) {
        setPublishSuccess({
          title: 'Event published successfully',
          message: `"${eventDraft.title || 'Untitled event'}" is now live.`,
          viewLabel: 'View on events page',
          viewUrl: `/events`,
          detailUrl: savedId ? `/event?id=${encodeURIComponent(savedId)}` : ''
        });
      }
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not save event.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveNodeLeadSchema(event) {
    event.preventDefault();
    resetMessages();
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  }

  async function handleProfileNewsletterChange(subscribed) {
    resetMessages();
    setProfileSaving(true);
    try {
      await updateNewsletterPreference(subscribed);
      await refreshProfile?.();
      setMessage(subscribed ? 'Newsletter subscription enabled.' : 'Newsletter subscription paused.');
    } catch (nextError) {
      setError(nextError?.message || 'Could not update newsletter preference.');
    } finally {
      setProfileSaving(false);
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

  async function handleHostExport(format) {
    resetMessages();
    try {
      const result = await exportDatasetForEvent('hostApplications', format);
      downloadExportFile(result);
      setMessage('Host applications export prepared.');
    } catch (nextError) {
      setError(nextError?.message || 'Could not export host applications.');
    }
  }

  async function reloadEventInvites(eventId = eventDraft.id) {
    if (!eventId) return;
    const invites = await getEventInvites(eventId);
    setEventInvites(invites);
  }

  async function handleAddInvite(event) {
    event.preventDefault();
    if (!eventDraft.id) {
      setEventFormError('Save this invite-only event before adding invites.');
      return;
    }
    resetMessages();
    try {
      await addEventInvite(eventDraft.id, inviteDraft);
      setInviteDraft({ name: '', email: '' });
      await reloadEventInvites(eventDraft.id);
      setMessage('Invite added.');
    } catch (nextError) {
      setError(nextError?.message || 'Could not add invite.');
    }
  }

  async function handleInviteUpload(file) {
    if (!file || !eventDraft.id) return;
    resetMessages();
    try {
      const upload = await encodeFile(file);
      const result = await importEventInvites(eventDraft.id, upload);
      await reloadEventInvites(eventDraft.id);
      setMessage(`Imported ${result.imported || 0} invites.`);
    } catch (nextError) {
      setError(nextError?.message || 'Could not import invites.');
    }
  }

  async function handleSendInvites() {
    if (!eventDraft.id) return;
    resetMessages();
    try {
      const result = await sendEventInvites(eventDraft.id);
      await reloadEventInvites(eventDraft.id);
      setMessage(`Sent ${result.sent || 0} invite emails.`);
    } catch (nextError) {
      setError(nextError?.message || 'Could not send invites.');
    }
  }

  async function handleRevokeInvite(inviteId) {
    if (!eventDraft.id || !inviteId) return;
    resetMessages();
    try {
      await revokeEventInvite(eventDraft.id, inviteId);
      await reloadEventInvites(eventDraft.id);
      setMessage('Invite revoked.');
    } catch (nextError) {
      setError(nextError?.message || 'Could not revoke invite.');
    }
  }

  async function patchStatus(collectionName, id, value) {
    resetMessages();
    try {
      if (collectionName === 'comments') await updateCommentStatus(id, value);
      else {
        const options = collectionName === 'eventRegistrations' && value === 'accepted'
          ? { overrideCapacity: window.confirm('Accept this registration even if the event is already at capacity?') }
          : {};
        await updateReviewStatus(collectionName, id, value, options);
      }
      setMessage('Status updated.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not update status.');
    }
  }

  async function handleAttachmentUpload(files) {
    if (!files?.length) return;
    setIsUploadingAttachment(true);
    resetMessages();
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((file) => uploadAttachment(file, updateDraft.id || 'draft'))
      );
      setUpdateDraft((c) => ({ ...c, attachments: [...(c.attachments || []), ...uploaded] }));
      setMessage(`${uploaded.length} file${uploaded.length > 1 ? 's' : ''} uploaded.`);
    } catch (nextError) {
      setError(nextError?.message || 'Could not upload attachment.');
    } finally {
      setIsUploadingAttachment(false);
    }
  }

  function removeAttachment(id) {
    setUpdateDraft((c) => ({ ...c, attachments: (c.attachments || []).filter((a) => a.id !== id) }));
  }

  function toggleAttachmentDownloadable(id) {
    setUpdateDraft((c) => ({
      ...c,
      attachments: (c.attachments || []).map((a) => a.id === id ? { ...a, downloadable: !a.downloadable } : a)
    }));
  }

  async function handleSaveUpdate(event) {
    event.preventDefault();
    resetMessages();
    setIsSaving(true);
    try {
      const slug = normalizeSlug(updateDraft.slug || updateDraft.title);
      await saveUpdatePost({
        ...updateDraft,
        slug,
        bodyHtml: updateDraft.bodyHtml,
        body: htmlToParagraphs(updateDraft.bodyHtml)
      });
      const isPublished = updateDraft.publishState === 'published';
      setUpdateDraft({ id: '', title: '', slug: '', excerpt: '', bodyHtml: '', category: 'update', commentMode: 'moderated', publishState: 'draft', authorName: 'AI Unplugged Team', scope: 'general', eventId: '', attachments: [] });
      setMessage(isPublished ? 'Update published.' : 'Update saved as draft.');
      if (isPublished) {
        setPublishSuccess({
          title: 'Update published successfully',
          message: `"${updateDraft.title || 'Untitled update'}" is now live.`,
          viewLabel: 'View on updates page',
          viewUrl: `/updates/${slug}`,
          detailUrl: ''
        });
      }
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not save update.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResourceImageUpload(file) {
    if (!file) return;
    setIsUploadingResourceImage(true);
    resetMessages();
    try {
      const image = await uploadResourceImage(file, resourceDraft.id || normalizeSlug(resourceDraft.slug) || 'draft');
      setResourceDraft((current) => ({ ...current, image }));
      setMessage('Resource image uploaded.');
    } catch (nextError) {
      setError(nextError?.message || 'Could not upload resource image.');
    } finally {
      setIsUploadingResourceImage(false);
    }
  }

  async function handleSaveResource(event) {
    event.preventDefault();
    resetMessages();
    setIsSaving(true);
    try {
      const slug = normalizeSlug(resourceDraft.slug || resourceDraft.title);
      await saveResource({
        ...resourceDraft,
        slug,
        body: htmlToParagraphs(resourceDraft.bodyHtml)
      });
      const isPublished = resourceDraft.publishState === 'published';
      setResourceDraft(emptyResourceDraft());
      setMessage(isPublished ? 'Resource published.' : 'Resource saved as draft.');
      if (isPublished) {
        setPublishSuccess({
          title: 'Resource published successfully',
          message: `"${resourceDraft.title || 'Untitled resource'}" is now live.`,
          viewLabel: 'View on resources page',
          viewUrl: `/resources`,
          detailUrl: slug ? `/resources/${slug}` : ''
        });
      }
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not save resource.');
    } finally {
      setIsSaving(false);
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
    if (!window.confirm('Send this newsletter to all recipients? This cannot be undone.')) return;
    setIsSaving(true);
    try {
      const result = await sendNewsletterCampaign({
        ...newsletterDraft,
        recipientsUpload: newsletterRecipientsUpload
      });
      setMessage(`Newsletter sent to ${result.sent} recipients.`);
    } catch (nextError) {
      setError(nextError?.message || 'Could not send newsletter.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGrantAdmin(event) {
    event.preventDefault();
    resetMessages();
    setIsSaving(true);
    try {
      await grantAdminRole({ email: adminDraftEmail });
      setAdminDraftEmail('');
      setMessage('Admin access granted.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not grant admin access.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRevokeAdmin(email) {
    if (!window.confirm(`Revoke admin access for ${email}?`)) return;
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
    if (!window.confirm('Remove your own admin access? You will be locked out of this panel.')) return;
    resetMessages();
    try {
      await leaveAdminRole();
      setMessage('Your admin role was removed.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not remove your admin access.');
    }
  }

  async function handleSaveHomeSpotlight() {
    resetMessages();
    if (spotlightDraftIds.length > 2) {
      setSpotlightSelectionError('Choose up to two events for the home spotlight.');
      return;
    }

    setIsSaving(true);
    try {
      await saveHomeSpotlightSettings(spotlightDraftIds);
      setHomeSpotlightIds(spotlightDraftIds);
      setSpotlightModalOpen(false);
      setSpotlightSelectionError('');
      setMessage('Home spotlight updated.');
      refreshAll();
    } catch (nextError) {
      setError(nextError?.message || 'Could not save the home spotlight.');
    } finally {
      setIsSaving(false);
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
            <button type="button" key={item} className={`admin-tab${tab === item ? ' is-active' : ''}`} onClick={() => changeTab(item)}>
              <span className="admin-tab-icon">{TAB_ICONS[item]}</span>
              {TAB_LABELS[item]}
            </button>
          ))}
        </aside>

        <div className="admin-main">
          <div className="admin-live-status" aria-live="polite">
            <div>
              <span className="admin-live-status-label">{isRefreshing ? 'Refreshing database data...' : 'Database data loaded'}</span>
              {lastRefreshedAt ? <span className="admin-live-status-time">Last updated {lastRefreshedAt.toLocaleTimeString()}</span> : null}
            </div>
            <button type="button" className="admin-refresh-button" disabled={isRefreshing} onClick={() => refreshAll()}>
              {isRefreshing ? 'Refreshing...' : 'Refresh database'}
            </button>
          </div>
          {message ? <div className="auth-success">{message}</div> : null}
          {error ? <div className="form-error" style={{ display: 'block' }}>{error}</div> : null}
          {publishSuccess ? (
            <div
              className="skilldb-modal-backdrop"
              onClick={() => setPublishSuccess(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
            >
              <div
                className="skilldb-modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 440, width: '90%', boxShadow: '0 12px 48px rgba(0,0,0,0.3)' }}
              >
                <div style={{ fontSize: 36, marginBottom: 8, color: '#1a7f37' }}>✓</div>
                <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>{publishSuccess.title}</h2>
                <p style={{ margin: '0 0 20px', color: '#444' }}>{publishSuccess.message}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {publishSuccess.viewUrl ? (
                    <a className="btn-primary" href={publishSuccess.viewUrl} target="_blank" rel="noopener noreferrer" onClick={() => setPublishSuccess(null)}>{publishSuccess.viewLabel}</a>
                  ) : null}
                  {publishSuccess.detailUrl ? (
                    <a className="btn-secondary" href={publishSuccess.detailUrl} target="_blank" rel="noopener noreferrer" onClick={() => setPublishSuccess(null)}>Open detail page</a>
                  ) : null}
                  <button type="button" className="btn-secondary" onClick={() => setPublishSuccess(null)}>Close</button>
                </div>
              </div>
            </div>
          ) : null}

          {/* OVERVIEW */}
          {tab === 'overview' ? (
            <>
              <div className="admin-grid">
                <div className="admin-stat-card">
                  <div className="admin-stat-icon">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                  <div className="admin-stat-number">{events.length}</div>
                  <div className="admin-stat-label">Events</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 12L5 8l3 3 3-4 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="admin-stat-number">{registrations.length}</div>
                  <div className="admin-stat-label">Registrations</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M1 14c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 8v4M10 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                  <div className="admin-stat-number">{nodeLeads.length}</div>
                  <div className="admin-stat-label">Node Leads</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2.25l5.5 4v6.25A1.5 1.5 0 0 1 12 14H4a1.5 1.5 0 0 1-1.5-1.5V6.25l5.5-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M6 14V9.5h4V14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="admin-stat-number">{hostApplications.length}</div>
                  <div className="admin-stat-label">Hosts</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                  <div className="admin-stat-number">{updates.length}</div>
                  <div className="admin-stat-label">Posts</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1 5.5l7 4.5 7-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                  <div className="admin-stat-number">{subscribers.length}</div>
                  <div className="admin-stat-label">Subscribers</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5L2 4.5v4.5c0 3 2.686 5.5 6 5.5s6-2.5 6-5.5V4.5L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="admin-stat-number">{admins.length}</div>
                  <div className="admin-stat-label">Admins</div>
                </div>
              </div>

              <div className="admin-quick-actions">
                <button type="button" className="btn-secondary" onClick={() => { changeTab('events'); setEventsSubTab('events'); }}>+ Create Event</button>
                <button type="button" className="btn-secondary" onClick={() => { changeTab('updates'); setUpdatesSubTab('posts'); }}>+ New Post</button>
                <button type="button" className="btn-secondary" onClick={() => changeTab('newsletter')}>Send Newsletter</button>
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

          {/* EVENTS */}
          {tab === 'events' ? (
            <div className="admin-section">
              <SubNav
                items={[
                  { key: 'events', label: 'Events' },
                  { key: 'registrations', label: `Registrations${registrations.length ? ` (${registrations.length})` : ''}` },
                ]}
                active={eventsSubTab}
                onChange={setEventsSubTab}
              />

              {eventsSubTab === 'events' ? (
                <>
                  <form className="form-card admin-edit-form" onSubmit={handleSaveEvent} ref={eventFormRef}>
                    <h3>{eventDraft.id ? 'Edit event' : 'Create event'}</h3>
                    <div className="form-field field-inline-2">
                      <div className="form-field"><label className="form-label">Title <span className="hint">Required</span></label><input className="form-input" ref={eventTitleRef} value={eventDraft.title} onChange={(e) => setEventDraft((c) => ({ ...c, title: e.target.value }))} /></div>
                      <div className="form-field"><label className="form-label">Format</label><input className="form-input" value={eventDraft.format} onChange={(e) => setEventDraft((c) => ({ ...c, format: e.target.value }))} /></div>
                    </div>
                    <div className="form-field field-inline-2">
                      <div className="form-field"><label className="form-label">Date <span className="hint">Required</span></label><input className="form-input" type="date" value={eventDraft.date} onChange={(e) => setEventDraft((c) => ({ ...c, date: e.target.value, dateDisplay: formatDateForDisplay(e.target.value) }))} /></div>
                      <div className="form-field"><label className="form-label">Display date</label><input className="form-input" placeholder="dd/mm/yyyy" value={eventDraft.dateDisplay} readOnly /></div>
                    </div>
                    <div className="form-field field-inline-2">
                      <div className="form-field"><label className="form-label">Location <span className="hint">Required</span></label><input className="form-input" value={eventDraft.location} onChange={(e) => setEventDraft((c) => ({ ...c, location: e.target.value }))} /></div>
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
                      <div className="dashboard-card admin-form-mode-card is-custom">
                        <p className="section-label">Custom registration questions</p>
                        <h3>Ask attendees event-specific questions</h3>
                        <p className="page-sub">These fields are shown to users when they apply/register for this event. Event details above stay visible and required.</p>
                        <div className="form-field"><label className="form-label">Form title</label><input className="form-input" value={eventCustomSchema.title || ''} onChange={(e) => setEventCustomSchema((c) => ({ ...c, title: e.target.value }))} /></div>
                        <FieldBuilder schema={eventCustomSchema} onChange={setEventCustomSchema} />
                      </div>
                    ) : (
                      <div className="admin-form-mode-card is-default">
                        <strong>Default registration form active.</strong>
                        <p>The standard attendee registration questions will be used for this event.</p>
                      </div>
                    )}
                    {eventDraft.entry === 'Invite Only' ? (
                      <div className="dashboard-card admin-form-mode-card is-custom">
                        <p className="section-label">Invite-only access</p>
                        <h3>Manage invited attendees</h3>
                        <p className="page-sub">Save the event first, then add invites manually or import a CSV/XLSX with name and email columns. Invite links are emailed directly to attendees.</p>
                        {eventDraft.id ? (
                          <>
                            <div className="form-field field-inline-2">
                              <div className="form-field">
                                <label className="form-label">Invitee name</label>
                                <input className="form-input" value={inviteDraft.name} onChange={(e) => setInviteDraft((current) => ({ ...current, name: e.target.value }))} />
                              </div>
                              <div className="form-field">
                                <label className="form-label">Invitee email</label>
                                <input className="form-input" type="email" value={inviteDraft.email} onChange={(e) => setInviteDraft((current) => ({ ...current, email: e.target.value }))} />
                              </div>
                            </div>
                            <div className="admin-inline-actions">
                              <button type="button" className="btn-secondary" onClick={handleAddInvite}>Add Invite</button>
                              <label className="btn-secondary">
                                Import CSV/XLSX
                                <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleInviteUpload(e.target.files[0])} />
                              </label>
                              <button type="button" className="btn-primary" onClick={handleSendInvites}>Send Invite Emails</button>
                            </div>
                            <div className="admin-list">
                              {eventInvites.map((invite) => (
                                <div className="admin-list-row" key={invite.id}>
                                  <div>
                                    <strong>{invite.name || 'Invited guest'}</strong>
                                    <p>{invite.email}</p>
                                  </div>
                                  <span>{invite.status}</span>
                                  <button type="button" className="auth-link danger-link" onClick={() => handleRevokeInvite(invite.id)}>Revoke</button>
                                </div>
                              ))}
                              {!eventInvites.length ? <div className="empty-state">No invites yet.</div> : null}
                            </div>
                          </>
                        ) : (
                          <div className="form-status-message">Save this event before adding invitees.</div>
                        )}
                      </div>
                    ) : null}
                    {eventFormError ? <div className="form-status-message" role="alert">{eventFormError}</div> : null}
                    <div className="admin-inline-actions">
                      <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? 'Saving...' : eventDraft.id ? 'Update Event' : 'Save Event'}</button>
                      {eventDraft.id ? <button type="button" className="btn-secondary" onClick={() => { setEventDraft(emptyEventDraft()); setEventCustomSchema(schemaFromEvent(emptyEventDraft())); }}>Clear</button> : null}
                    </div>
                  </form>

                  <div className="dashboard-card">
                    <div className="admin-inline-actions admin-inline-actions-wrap">
                      <div>
                        <h3>Home spotlight</h3>
                        <p className="page-sub" style={{ marginTop: 8 }}>
                          Choose up to two published ongoing or upcoming events to feature on the home page. If a selected event becomes invalid later, the home page auto-fills from the next eligible events.
                        </p>
                      </div>
                      <button type="button" className="btn-secondary" onClick={openSpotlightModal}>
                        Curate Home Events
                      </button>
                    </div>

                    <div className="admin-list">
                      {resolvedSpotlightEvents.map((item) => (
                        <div className="admin-list-row admin-check-row" key={item.id}>
                          <div>
                            <strong>{item.title}</strong>
                            <p style={{ margin: '6px 0 0', color: 'var(--gray-2)', fontSize: '0.84rem' }}>
                              {formatEventStatusLabel(item)} · {item.dateDisplay || 'Date not set'} · {item.location || 'Location not set'}
                            </p>
                          </div>
                          <span>{homeSpotlightIds.includes(item.id) ? 'Admin selected' : 'Auto-filled'}</span>
                        </div>
                      ))}
                      {!resolvedSpotlightEvents.length ? <div className="empty-state">No eligible published upcoming or ongoing events yet.</div> : null}
                    </div>
                  </div>

                  <div className="dashboard-card">
                    <h3>Current events</h3>
                    <div className="admin-list">
                      {sortedEvents.map((item) => (
                        <div className="admin-list-row content-admin-row" key={item.id}>
                          <div>
                            <strong>{item.title}</strong>
                            <p style={{ margin: '6px 0 0', color: 'var(--gray-2)', fontSize: '0.84rem' }}>
                              {formatEventStatusLabel(item)} · {item.publishState} · {item.dateDisplay || 'Date not set'}
                            </p>
                          </div>
                          <span>{item.entry || 'Application'}</span>
                          <div className="admin-row-actions">
                            <button type="button" className="btn-secondary btn-small" onClick={() => selectEvent(item)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="auth-link danger-link"
                              onClick={() => {
                                if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
                                deleteDocument('events', item.id).then(refreshAll).catch((e) => setError(e?.message || 'Could not delete event.'));
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                      {!sortedEvents.length ? <div className="empty-state">No events yet. Create one above.</div> : null}
                    </div>
                  </div>

                  {spotlightModalOpen ? (
                    <div className="admin-modal-backdrop" onClick={closeSpotlightModal}>
                      <div className="admin-modal-card" onClick={(event) => event.stopPropagation()}>
                        <div className="admin-modal-head">
                          <div>
                            <p className="section-label">Home Spotlight</p>
                            <h3>Select up to two events</h3>
                          </div>
                          <button type="button" className="auth-link" onClick={closeSpotlightModal}>Close</button>
                        </div>
                        <p className="page-sub">Only published upcoming or ongoing events appear here.</p>

                        {spotlightSelectionError ? <div className="form-error" style={{ display: 'block' }}>{spotlightSelectionError}</div> : null}

                        <div className="admin-list">
                          {eligibleSpotlightEvents.map((item) => (
                            <label className="admin-list-row admin-check-row" key={item.id}>
                              <div>
                                <strong>{item.title}</strong>
                                <p style={{ margin: '6px 0 0', color: 'var(--gray-2)', fontSize: '0.84rem' }}>
                                  {formatEventStatusLabel(item)} · {item.dateDisplay || 'Date not set'} · {item.location || 'Location not set'}
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={spotlightDraftIds.includes(item.id)}
                                onChange={() => toggleSpotlightSelection(item.id)}
                              />
                            </label>
                          ))}
                          {!eligibleSpotlightEvents.length ? <div className="empty-state">No eligible events available right now.</div> : null}
                        </div>

                        <div className="admin-inline-actions">
                          <button type="button" className="btn-secondary" onClick={closeSpotlightModal}>Cancel</button>
                          <button type="button" className="btn-primary" disabled={isSaving} onClick={handleSaveHomeSpotlight}>
                            {isSaving ? 'Saving...' : 'Save Spotlight'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {eventsSubTab === 'registrations' ? (
                <div className="dashboard-card">
                  <div className="admin-inline-actions">
                    <h3>Registrations</h3>
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
                  <div className="admin-inline-actions" style={{ marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
                    <span className="event-tag">Total {registrationStats.total}</span>
                    <span className="event-tag">Accepted {registrationStats.accepted}</span>
                    <span className="event-tag">Pending {registrationStats.pending}</span>
                    <span className="event-tag">Waitlisted {registrationStats.waitlisted}</span>
                    <span className="event-tag">Rejected {registrationStats.rejected}</span>
                  </div>
                  <div className="admin-table">
                    {[
                      ['accepted', 'Accepted'],
                      ['pending', 'Pending review'],
                      ['waitlisted', 'Waitlist'],
                      ['rejected', 'Rejected']
                    ].map(([statusKey, label]) => (
                      <div className="registration-status-group" key={statusKey}>
                        <h4>{label} ({registrationsByStatus[statusKey].length})</h4>
                        {registrationsByStatus[statusKey].map((item) => {
                          const relatedEvent = eventLookup[item.eventId] || {};
                          const capacity = Number(relatedEvent.capacity || 0);
                          const activeForEvent = registrations.filter((registration) => registration.eventId === item.eventId && registration.reviewStatus !== 'rejected').length;
                          return (
                        <div className="admin-table-row" key={item.id}>
                          <div>
                            <strong>{item.name || item.answers?.name || 'Unnamed'}</strong>
                            <p>{item.email || item.answers?.email}</p>
                            <p>{item.registrationId}</p>
                            {item.reviewStatus === 'waitlisted' ? <p>The room is currently full. We’ll let them know if more seats open.</p> : null}
                            <AnswerDetails answers={item.answers} />
                          </div>
                          <div>
                            <strong>{item.eventTitle}</strong>
                            <p>{item.entryType || 'application'}</p>
                            {capacity ? <p>{activeForEvent}/{capacity} active registrations</p> : null}
                          </div>
                          <select className="form-select" value={item.reviewStatus || 'pending'} onChange={(e) => patchStatus('eventRegistrations', item.id, e.target.value)}>
                            <option value="pending">pending</option>
                            <option value="shortlisted">shortlisted</option>
                            <option value="accepted">accepted</option>
                            <option value="waitlisted">waitlisted</option>
                            <option value="rejected">rejected</option>
                          </select>
                        </div>
                          );
                        })}
                      </div>
                    ))}
                    {!filteredRegistrations.length ? (
                      <div className="empty-state">No registrations yet.</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* NODE LEAD */}
          {tab === 'node-lead' ? (
            <div className="admin-section">
              <SubNav
                items={[
                  { key: 'applications', label: `Applications${nodeLeads.length ? ` (${nodeLeads.length})` : ''}` },
                  { key: 'form-builder', label: 'Form Builder' },
                ]}
                active={nodeLeadSubTab}
                onChange={setNodeLeadSubTab}
              />

              {nodeLeadSubTab === 'applications' ? (
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
                        <div>
                          <strong>{item.name || item.answers?.name || 'Unnamed'}</strong>
                          <p>{item.email || item.answers?.email}</p>
                          <AnswerDetails answers={item.answers} />
                        </div>
                        <div>{item.reviewStatus}</div>
                        <select className="form-select" value={item.reviewStatus || 'pending'} onChange={(e) => patchStatus('nodeLeadApplications', item.id, e.target.value)}>
                          <option value="pending">pending</option>
                          <option value="shortlisted">shortlisted</option>
                          <option value="accepted">accepted</option>
                          <option value="rejected">rejected</option>
                        </select>
                      </div>
                    ))}
                    {!nodeLeads.length ? <div className="empty-state">No Node Lead applications yet.</div> : null}
                  </div>
                </div>
              ) : null}

              {nodeLeadSubTab === 'form-builder' ? (
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
                  <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Node Lead Form'}</button>
                </form>
              ) : null}
            </div>
          ) : null}

          {/* HOSTS */}
          {tab === 'hosts' ? (
            <div className="admin-section">
              <div className="dashboard-card">
                <div className="admin-inline-actions">
                  <h3>Host applications</h3>
                  <div className="admin-inline-actions">
                    <button type="button" className="btn-secondary" onClick={() => handleHostExport('csv')}>CSV</button>
                    <button type="button" className="btn-secondary" onClick={() => handleHostExport('xlsx')}>XLSX</button>
                    <button type="button" className="btn-secondary" onClick={() => handleHostExport('json')}>JSON</button>
                  </div>
                </div>
                <div className="admin-table">
                  {hostApplications.map((item) => (
                    <div className="admin-table-row" key={item.id}>
                      <div>
                        <strong>{item.name || item.answers?.name || 'Unnamed'}</strong>
                        <p>{item.email || item.answers?.email}</p>
                        <p>{[item.countryCode || item.answers?.countryCode, item.phone || item.answers?.phone].filter(Boolean).join(' ')}</p>
                        <AnswerDetails answers={item.answers} />
                      </div>
                      <div>
                        <strong>{item.subject || item.answers?.subject || 'Host request'}</strong>
                        <p>{item.venue || item.answers?.venue || 'Venue not provided'}</p>
                        <p>Capacity {item.venueCapacity ?? item.answers?.venueCapacity ?? 'n/a'} - Audience {item.estimatedAudience ?? item.answers?.estimatedAudience ?? 'n/a'}</p>
                        <p>{formatAdminDate(item.createdAt)}</p>
                      </div>
                      <select className="form-select" value={item.reviewStatus || 'pending'} onChange={(e) => patchStatus('hostApplications', item.id, e.target.value)}>
                        <option value="pending">pending</option>
                        <option value="shortlisted">shortlisted</option>
                        <option value="accepted">accepted</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </div>
                  ))}
                  {!hostApplications.length ? <div className="empty-state">No host applications yet.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* UPDATES */}
          {tab === 'updates' ? (
            <div className="admin-section">
              <SubNav
                items={[
                  { key: 'posts', label: 'Posts' },
                  { key: 'comments', label: `Comments${comments.length ? ` (${comments.length})` : ''}` },
                ]}
                active={updatesSubTab}
                onChange={setUpdatesSubTab}
              />

              {updatesSubTab === 'posts' ? (
                <>
                  <form className="form-card admin-edit-form" onSubmit={handleSaveUpdate} ref={updateFormRef}>
                    <h3>{updateDraft.id ? 'Edit post' : 'Create post'}</h3>
                    <div className="form-field"><label className="form-label">Title</label><input className="form-input" ref={updateTitleRef} value={updateDraft.title} onChange={(e) => setUpdateDraft((c) => ({ ...c, title: e.target.value }))} /></div>
                    <div className="form-field">
                      <label className="form-label">Slug <span className="hint">URL name, no spaces</span></label>
                      <input className="form-input" placeholder="url-friendly-name-no-spaces" value={updateDraft.slug} onChange={(e) => setUpdateDraft((c) => ({ ...c, slug: normalizeSlug(e.target.value) }))} />
                      <p className="field-help">Slug is the URL name. Use lowercase words separated by hyphens, no spaces.</p>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Excerpt <span className="hint">TL;DR</span></label>
                      <textarea className="form-textarea" placeholder="Short TL;DR shown on update cards and previews." value={updateDraft.excerpt} onChange={(e) => setUpdateDraft((c) => ({ ...c, excerpt: e.target.value }))} />
                      <p className="field-help">Excerpt is the short summary users see before opening the full content.</p>
                    </div>
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
                      <div className="form-field"><label className="form-label">Scope</label><select className="form-select" value={updateDraft.scope || 'general'} onChange={(e) => setUpdateDraft((c) => ({ ...c, scope: e.target.value, eventId: e.target.value === 'event' ? c.eventId : '' }))}><option value="general">general</option><option value="event">event-specific</option></select></div>
                      {updateDraft.scope === 'event' ? (
                        <div className="form-field"><label className="form-label">Event</label><select className="form-select" value={updateDraft.eventId || ''} onChange={(e) => setUpdateDraft((c) => ({ ...c, eventId: e.target.value }))}><option value="">Select event</option>{sortedEvents.map((item) => <option key={item.id} value={item.id}>{item.title} ({formatEventStatusLabel(item)})</option>)}</select></div>
                      ) : <div />}
                    </div>
                    <div className="form-field field-inline-2">
                      <div className="form-field"><label className="form-label">Publish state</label><select className="form-select" value={updateDraft.publishState} onChange={(e) => setUpdateDraft((c) => ({ ...c, publishState: e.target.value }))}><option value="draft">draft</option><option value="published">published</option></select></div>
                      <div className="form-field"><label className="form-label">Author</label><input className="form-input" value={updateDraft.authorName} onChange={(e) => setUpdateDraft((c) => ({ ...c, authorName: e.target.value }))} /></div>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Attachments</label>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf,.docx,.doc,.txt,.xlsx,.csv,.zip"
                        disabled={isUploadingAttachment}
                        onChange={(e) => handleAttachmentUpload(e.target.files)}
                      />
                      {isUploadingAttachment ? <p className="attachment-uploading">Uploading...</p> : null}
                      {(updateDraft.attachments || []).length ? (
                        <div className="attachment-admin-list">
                          {(updateDraft.attachments || []).map((att) => (
                            <div className="attachment-admin-row" key={att.id}>
                              <span className="attachment-admin-name" title={att.name}>{att.name}</span>
                              <span className="attachment-admin-size">{att.mimeType?.split('/').pop()?.toUpperCase()}</span>
                              <label className="checkbox-inline">
                                <input type="checkbox" checked={Boolean(att.downloadable)} onChange={() => toggleAttachmentDownloadable(att.id)} />
                                Downloadable
                              </label>
                              <button type="button" className="auth-link" onClick={() => removeAttachment(att.id)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="admin-inline-actions">
                      <button type="submit" className="btn-primary" disabled={isSaving || isUploadingAttachment}>{isSaving ? 'Saving...' : updateDraft.id ? 'Update Post' : 'Save Post'}</button>
                      {updateDraft.id ? <button type="button" className="btn-secondary" onClick={() => setUpdateDraft({ id: '', title: '', slug: '', excerpt: '', bodyHtml: '', category: 'update', commentMode: 'moderated', publishState: 'draft', authorName: 'AI Unplugged Team', scope: 'general', eventId: '', attachments: [] })}>Clear</button> : null}
                    </div>
                  </form>

                  <div className="dashboard-card">
                    <h3>Posts</h3>
                    <div className="admin-list">
                      {!updates.length ? <div className="empty-state">No posts yet. Create one above.</div> : null}
                      {updates.map((post) => (
                        <div className="admin-list-row content-admin-row" key={post.id}>
                          <div>
                            <strong>{post.title}</strong>
                            <p style={{ margin: '6px 0 0', color: 'var(--gray-2)', fontSize: '0.84rem' }}>
                              {post.publishState} · {post.scope || 'general'}{post.scope === 'event' && post.eventId ? ` · ${sortedEvents.find((item) => item.id === post.eventId)?.title || 'Event'}` : ''}
                            </p>
                          </div>
                          <span>{post.category}</span>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              onClick={() => selectUpdate(post)}
                            >
                              Edit
                            </button>
                            <button type="button" className="auth-link danger-link" onClick={() => {
                              if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
                              deleteDocument('updates', post.id).then(refreshAll).catch((e) => setError(e?.message || 'Could not delete post.'));
                            }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {updatesSubTab === 'comments' ? (
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
              ) : null}
            </div>
          ) : null}

          {/* RESOURCES */}
          {tab === 'resources' ? (
            <div className="admin-section">
              <form className="form-card admin-edit-form" onSubmit={handleSaveResource} ref={resourceFormRef}>
                <h3>{resourceDraft.id ? 'Edit resource' : 'Create resource'}</h3>
                <div className="form-field field-inline-2">
                  <div className="form-field">
                    <label className="form-label">Title</label>
                    <input className="form-input" ref={resourceTitleRef} value={resourceDraft.title} onChange={(e) => setResourceDraft((current) => ({ ...current, title: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Slug</label>
                    <input className="form-input" placeholder="url-friendly-name-no-spaces" value={resourceDraft.slug} onChange={(e) => setResourceDraft((current) => ({ ...current, slug: normalizeSlug(e.target.value) }))} />
                    <p className="field-help">Slug is the URL name. Use lowercase words separated by hyphens, no spaces.</p>
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">Publish state</label>
                  <select className="form-select" value={resourceDraft.publishState} onChange={(e) => setResourceDraft((current) => ({ ...current, publishState: e.target.value }))}>
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Card description <span className="hint">TL;DR</span></label>
                  <textarea className="form-textarea" placeholder="Short TL;DR shown on resource cards and previews." value={resourceDraft.excerpt} onChange={(e) => setResourceDraft((current) => ({ ...current, excerpt: e.target.value }))} />
                  <p className="field-help">Excerpt is the short summary users see before opening the full content.</p>
                </div>
                <div className="form-field">
                  <label className="form-label">Resource detail body</label>
                  <RichTextEditor value={resourceDraft.bodyHtml} onChange={(value) => setResourceDraft((current) => ({ ...current, bodyHtml: value }))} />
                </div>
                <div className="form-field field-inline-2">
                  <div className="form-field">
                    <label className="form-label">CTA label</label>
                    <input className="form-input" value={resourceDraft.ctaLabel} onChange={(e) => setResourceDraft((current) => ({ ...current, ctaLabel: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">CTA URL</label>
                    <input className="form-input" value={resourceDraft.ctaUrl} onChange={(e) => setResourceDraft((current) => ({ ...current, ctaUrl: e.target.value }))} />
                  </div>
                </div>
                <div className="dashboard-card">
                  <h3>Resource image</h3>
                  <p className="page-sub" style={{ marginBottom: 14 }}>
                    Best result: around 1600 x 900 px. Transparent PNG or SVG is preferred. Wide logos are fitted and centered inside the frame instead of being cropped.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingResourceImage}
                    onChange={(e) => e.target.files?.[0] && handleResourceImageUpload(e.target.files[0])}
                  />
                  {isUploadingResourceImage ? <p className="attachment-uploading">Uploading...</p> : null}
                  {resourceDraft.image?.url ? (
                    <div className="resource-admin-preview">
                      <img src={resourceDraft.image.url} alt={resourceDraft.image.name || resourceDraft.title || 'Resource preview'} />
                      <div className="resource-admin-preview-copy">
                        <strong>{resourceDraft.image.name || 'Uploaded image'}</strong>
                        <p>{resourceDraft.image.mimeType || 'image'}</p>
                        <button type="button" className="auth-link" onClick={() => setResourceDraft((current) => ({ ...current, image: null }))}>Remove image</button>
                      </div>
                    </div>
                  ) : (
                    <p className="page-sub" style={{ marginTop: 12 }}>Upload a logo or feature image. The full logo stays visible on the public card, modal, and admin preview.</p>
                  )}
                </div>
                <div className="admin-inline-actions">
                  <button type="submit" className="btn-primary" disabled={isSaving || isUploadingResourceImage}>
                    {isSaving ? 'Saving...' : resourceDraft.id ? 'Update Resource' : 'Save Resource'}
                  </button>
                  {resourceDraft.id ? (
                    <button type="button" className="btn-secondary" onClick={() => setResourceDraft(emptyResourceDraft())}>
                      Clear
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="dashboard-card">
                <div className="admin-inline-actions">
                  <div>
                    <h3>Current resources</h3>
                    <p className="page-sub" style={{ marginTop: 8 }}>
                      Published resources are visible on the public resources page. Draft resources stay internal until you publish them.
                    </p>
                  </div>
                  <span className="event-tag">{resources.length} total</span>
                </div>
                <div className="admin-list">
                  {!resources.length ? <div className="empty-state">No resources yet. Create one above.</div> : null}
                  {resources.map((resource) => (
                    <div className="admin-list-row resource-admin-row" key={resource.id}>
                      <div>
                        <strong>{resource.title}</strong>
                        <p style={{ margin: '6px 0 0', color: 'var(--gray-2)', fontSize: '0.84rem' }}>
                          {resource.slug}
                        </p>
                      </div>
                      <div className="resource-admin-meta">
                        <span className={`resource-status-pill${resource.publishState === 'published' ? ' is-published' : ' is-draft'}`}>
                          {resource.publishState}
                        </span>
                        <span>{resource.ctaLabel || 'Open resource'}</span>
                      </div>
                      <div className="admin-row-actions">
                        <button type="button" className="btn-secondary btn-small" onClick={() => selectResource(resource)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="auth-link danger-link"
                          onClick={() => {
                            if (!window.confirm(`Delete "${resource.title}"? This cannot be undone.`)) return;
                            deleteDocument('resources', resource.id).then(refreshAll).catch((e) => setError(e?.message || 'Could not delete resource.'));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'skills' ? (
            <div className="admin-section">
              <div className="dashboard-card skilldb-admin-shell">
                <div className="admin-inline-actions">
                  <div>
                    <h3>SkillDB submissions</h3>
                    <p className="page-sub" style={{ marginTop: 8 }}>
                      Review uploaded markdown skills, control public visibility, and manage community submissions without mixing this work into resource metadata.
                    </p>
                  </div>
                  <span className="event-tag">{skills.length} total</span>
                </div>

                <div className="admin-stats-grid skilldb-admin-summary">
                  <div className="admin-stat-card">
                    <div className="admin-stat-number">{skillsByState.pending.length}</div>
                    <div className="admin-stat-label">Pending</div>
                  </div>
                  <div className="admin-stat-card">
                    <div className="admin-stat-number">{skillsByState.published.length}</div>
                    <div className="admin-stat-label">Published</div>
                  </div>
                  <div className="admin-stat-card">
                    <div className="admin-stat-number">{skillsByState.rejected.length}</div>
                    <div className="admin-stat-label">Rejected</div>
                  </div>
                </div>

                <div className="admin-list skilldb-admin-list">
                  {!skills.length ? <div className="empty-state">No SkillDB submissions yet.</div> : null}
                  {skills.map((skill) => (
                    <div className="admin-list-row resource-admin-row skilldb-admin-row" key={skill.id}>
                      <div className="skilldb-admin-copy">
                        <strong>{skill.fileName}</strong>
                        <p className="skilldb-admin-line">
                          {skill.name} · {skill.category} · {formatSkillFileSize(skill.fileSize)}
                        </p>
                        <p className="skilldb-admin-subline">
                          {skill.email}
                        </p>
                      </div>
                      <div className="resource-admin-meta skilldb-admin-meta">
                        <span className={`resource-status-pill${skill.publishState === 'published' ? ' is-published' : skill.publishState === 'pending' ? '' : ' is-draft'}`}>
                          {skill.publishState}
                        </span>
                        <span className="skilldb-admin-downloads">{skill.downloads || 0} downloads</span>
                      </div>
                      <div className="skilldb-admin-actions-wrap">
                        <div className="admin-row-actions skilldb-admin-actions">
                          {skill.markdownContent || skill.fileUrl ? (
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              onClick={() => {
                                try {
                                  downloadSkillMarkdown(skill);
                                } catch (nextError) {
                                  setError(nextError?.message || 'Could not download skill.');
                                }
                              }}
                            >
                              Download
                            </button>
                          ) : null}
                          {skill.publishState !== 'published' ? (
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              onClick={() => reviewSkillSubmission(skill.id, 'published', user?.uid).then(refreshAll).catch((e) => setError(e?.message || 'Could not publish skill.'))}
                            >
                              Publish
                            </button>
                          ) : null}
                          {skill.publishState !== 'rejected' ? (
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              onClick={() => reviewSkillSubmission(skill.id, 'rejected', user?.uid).then(refreshAll).catch((e) => setError(e?.message || 'Could not reject skill.'))}
                            >
                              Reject
                            </button>
                          ) : null}
                          {skill.publishState !== 'pending' ? (
                            <button
                              type="button"
                              className="btn-secondary btn-small skilldb-admin-quiet-action"
                              onClick={() => reviewSkillSubmission(skill.id, 'pending', user?.uid).then(refreshAll).catch((e) => setError(e?.message || 'Could not move skill back to pending.'))}
                            >
                              Move to pending
                            </button>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="auth-link danger-link skilldb-admin-delete"
                          onClick={() => {
                            if (!window.confirm(`Delete "${skill.fileName}"? This cannot be undone.`)) return;
                            deleteSkillSubmission(skill, user, true).then(refreshAll).catch((e) => setError(e?.message || 'Could not delete skill.'));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* NEWSLETTER */}
          {tab === 'newsletter' ? (
            <div className="admin-section">
              <form className="form-card" onSubmit={handleSendCampaign}>
                <h3>Send newsletter</h3>
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
                <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? 'Sending...' : 'Send Newsletter'}</button>
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
                  {!subscribers.length ? <div className="empty-state">No subscribers yet.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* PROFILE */}
          {tab === 'profile' ? (
            <div className="admin-section">
              <div className="dashboard-card profile-card">
                <p className="section-label">Admin profile</p>
                <h3>{profile?.displayName || user?.displayName || user?.email || 'Admin'}</h3>
                <p className="page-sub">Manage the current admin account here. This section only affects your own settings, not other admins.</p>
                <div className="admin-kv-list">
                  <div className="detail-row"><span className="label">Email</span><span className="val">{user?.email || 'Unknown'}</span></div>
                  <div className="detail-row"><span className="label">Role</span><span className="val">{profile?.role || 'admin'}</span></div>
                  <div className="detail-row"><span className="label">Newsletter</span><span className="val">{profile?.newsletterSubscribed ? 'subscribed' : 'unsubscribed'}</span></div>
                </div>
                <p className="page-sub profile-note">Event notices, platform updates, and campaign emails sent to your own admin account can be managed here.</p>
                <div className="admin-quick-actions profile-actions">
                  {profile?.newsletterSubscribed ? (
                    <button type="button" className="btn-secondary" disabled={profileSaving} onClick={() => handleProfileNewsletterChange(false)}>
                      Unsubscribe
                    </button>
                  ) : (
                    <button type="button" className="btn-primary" disabled={profileSaving} onClick={() => handleProfileNewsletterChange(true)}>
                      Resubscribe
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* ERRORS */}
          {tab === 'errors' ? (
            <div className="admin-section">
              <div className="dashboard-card">
                <div className="admin-inline-actions">
                  <div>
                    <h3>Backend error logs</h3>
                    <p className="page-sub" style={{ marginTop: 8 }}>Recent server-side errors logged to Postgres. Public users only see safe messages.</p>
                  </div>
                  <span className="event-tag">{errorLogs.length} recent</span>
                </div>
                <div className="admin-list">
                  {errorLogs.map((log) => (
                    <details className="admin-answer-details" key={log.id}>
                      <summary>{log.statusCode || 500} - {log.safeMessage || 'Error'} - {formatAdminDate(log.createdAt)}</summary>
                      <dl>
                        <div><dt>Route</dt><dd>{log.method} {log.route}</dd></div>
                        <div><dt>User</dt><dd>{log.userId || 'guest/unknown'}</dd></div>
                        <div><dt>Internal</dt><dd>{log.internalMessage || 'Not recorded'}</dd></div>
                        <div><dt>Stack</dt><dd>{log.stack || 'Not recorded'}</dd></div>
                      </dl>
                    </details>
                  ))}
                  {!errorLogs.length ? <div className="empty-state">No backend errors logged yet.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* ADMINS */}
          {tab === 'admins' ? (
            <div className="admin-section">
              <form className="form-card" onSubmit={handleGrantAdmin}>
                <h3>Grant admin access</h3>
                <p className="page-sub">Use the email of an existing user.</p><br />
                <div className="form-field">
                  <label className="form-label">User email</label>
                  <input className="form-input" value={adminDraftEmail} onChange={(e) => setAdminDraftEmail(e.target.value)} />
                </div>
                <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Grant Admin'}</button>
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
