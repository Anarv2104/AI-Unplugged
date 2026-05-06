import staticEvents from '../data/events';

export const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'radio', label: 'Radio' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'URL' },
  { value: 'helper', label: 'Helper text' }
];

export const UPDATE_CATEGORIES = ['news', 'update', 'tips', 'event-recap'];
export const COMMENT_MODES = ['disabled', 'auto-publish', 'moderated'];

export const defaultEventFormSchema = {
  id: 'default-event-form',
  kind: 'event',
  title: 'Default Event Registration Form',
  isDefault: true,
  publishState: 'published',
  fields: [
    { id: 'name', type: 'text', label: 'Full name', required: true, placeholder: '' },
    { id: 'email', type: 'email', label: 'Email', required: true, placeholder: '' },
    { id: 'role', type: 'select', label: 'Role', required: true, options: ['Student', 'Builder', 'Founder', 'Operator', 'Other'] },
    { id: 'organization', type: 'text', label: 'Organization / College', required: true },
    { id: 'building', type: 'textarea', label: 'What are you building right now?', required: true, minLength: 20, helperText: '20-500 characters', placeholder: 'Short and honest. Rough projects count.' },
    { id: 'whyEvent', type: 'textarea', label: 'Why this event?', required: true, minLength: 15, placeholder: "Be specific. 'To network' is not a reason." },
    { id: 'social', type: 'url', label: 'LinkedIn / Twitter / Website', required: false, helperText: 'Optional' }
  ]
};

export const defaultNodeLeadFormSchema = {
  id: 'default-node-lead-form',
  kind: 'nodeLead',
  title: 'Default Node Lead Application',
  isDefault: true,
  publishState: 'published',
  fields: [
    { id: 'name', type: 'text', label: 'Full name', required: true },
    { id: 'email', type: 'email', label: 'Email', required: true },
    { id: 'phone', type: 'phone', label: 'Phone', required: false, helperText: 'Optional' },
    { id: 'linkedin', type: 'url', label: 'LinkedIn', required: true, placeholder: 'https://linkedin.com/in/...' },
    { id: 'college', type: 'text', label: 'College / University', required: true },
    { id: 'year', type: 'select', label: 'Year of study', required: true, options: ['1st year', '2nd year', '3rd year', '4th year', 'Postgrad', 'Recent grad', 'Other'] },
    { id: 'city', type: 'text', label: 'City', required: true },
    { id: 'hasOrganized', type: 'radio', label: 'Have you organized events before?', required: true, options: ['Yes', 'No'] },
    { id: 'organizedDetail', type: 'textarea', label: 'Describe what you organized', required: true, minLength: 15, showWhen: { field: 'hasOrganized', equals: 'Yes' }, placeholder: 'Event name, scale, what you actually did.' },
    { id: 'whyNodeLead', type: 'textarea', label: 'Why do you want to run AI Unplugged at your campus?', required: true, minLength: 40, placeholder: 'Specific beats generic. What is missing at your campus? What will you build?' },
    { id: 'firstEventEstimate', type: 'number', label: 'How many builders can you bring to the first event?', required: true },
    { id: 'currentlyBuilding', type: 'textarea', label: "Anything you're currently building?", required: false, helperText: 'Optional', placeholder: 'Projects, side products, papers, research - anything counts.' }
  ]
};

export const fallbackUpdates = [
  {
    id: 'getting-better-at-ai-open-hours',
    slug: 'getting-better-at-ai-open-hours',
    title: 'What Builders Asked At The Last AI Open Hours',
    excerpt: 'A recap of the sharpest questions from the last room, plus what the conversation revealed about where builders are getting stuck.',
    body: [
      'The most useful discussions in the last AI Open Hours were not about tools in isolation. They were about where people are losing momentum between experimentation and a real workflow.',
      'The recurring pattern was clear: most builders can prototype, but they struggle to define a repeatable use case, a small deployment surface, and a practical feedback loop. That is where the next set of AI Unplugged sessions will keep pushing.'
    ],
    category: 'event-recap',
    publishState: 'published',
    commentMode: 'moderated',
    authorName: 'AI Unplugged Team',
    publishedAt: '2026-04-20T12:00:00.000Z'
  },
  {
    id: 'three-ai-workflow-habits-for-students',
    slug: 'three-ai-workflow-habits-for-students',
    title: 'Three AI Workflow Habits That Actually Compound',
    excerpt: 'Small habits that make AI work sessions sharper: tighter prompts, cleaner notes, and a faster loop from test to revision.',
    body: [
      'Most students lose leverage because they treat AI sessions as one-off chats instead of workflow layers.',
      'Three habits matter more than any model comparison: save your good prompts, keep a decision log, and define what a useful output should look like before you ask for it.'
    ],
    category: 'tips',
    publishState: 'published',
    commentMode: 'auto-publish',
    authorName: 'AI Unplugged Team',
    publishedAt: '2026-04-18T12:00:00.000Z'
  }
];

export const fallbackResources = [
  {
    id: 'skill-vault',
    slug: 'skill-vault',
    title: 'Skill Vault',
    excerpt: 'A platform for publishing, discovering, reviewing, and featuring high-signal AI skills built by the community.',
    body: [
      'Skill Vault is where builders can publish reusable Claude skills, agent workflows, prompts, and operating systems that actually help other people ship faster.',
      'The platform highlights reviewed submissions, surfaces the most liked and downloaded skills, and introduces a leaderboard layer so the best work compounds into visibility instead of getting buried.',
      'If you want to contribute your own skill stack or explore what other builders are already using in the wild, Skill Vault is the public archive.'
    ],
    bodyHtml: '<p>Skill Vault is where builders can publish reusable Claude skills, agent workflows, prompts, and operating systems that actually help other people ship faster.</p><p>The platform highlights reviewed submissions, surfaces the most liked and downloaded skills, and introduces a leaderboard layer so the best work compounds into visibility instead of getting buried.</p><p>If you want to contribute your own skill stack or explore what other builders are already using in the wild, Skill Vault is the public archive.</p>',
    ctaLabel: 'Open Skill Vault',
    ctaUrl: 'https://skills.houseofstarts.com/',
    image: {
      url: '/skill-vault-logo.svg',
      name: 'Skill Vault',
      mimeType: 'image/svg+xml'
    },
    publishState: 'published',
    createdAt: '2026-05-01T12:00:00.000Z',
    updatedAt: '2026-05-01T12:00:00.000Z'
  }
];

export const fallbackEvents = staticEvents.map((event) => ({
  ...event,
  publishState: event.status === 'upcoming' ? 'published' : 'published',
  formId: null
}));
