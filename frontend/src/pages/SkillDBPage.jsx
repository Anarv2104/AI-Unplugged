import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import SEO, { SITE_URL } from '../components/SEO';
import SkillCard from '../components/skilldb/SkillCard';
import SkillDBIcon from '../components/skilldb/SkillDBIcon';
import SkillForm from '../components/skilldb/SkillForm';
import SkillModal from '../components/skilldb/SkillModal';
import { useAuth } from '../context/useAuth';
import {
  SKILLDB_CATEGORIES,
  createSkillSubmission,
  downloadSkillMarkdown,
  deleteSkillSubmission,
  formatSkillFileSize,
  getPublishedSkills,
  getSkillDBStats,
  getUserSkills,
  incrementSkillDownloads,
  updateSkillSubmission
} from '../lib/skilldb';

function groupSkills(skills) {
  return SKILLDB_CATEGORIES
    .map((category) => ({
      category,
      skills: skills.filter((skill) => skill.category === category)
    }))
    .filter((group) => group.skills.length);
}

export default function SkillDBPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [skills, setSkills] = useState([]);
  const [userSkills, setUserSkills] = useState([]);
  const [stats, setStats] = useState({ totalSkills: 0, categories: 0, contributors: 0 });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [collapsed, setCollapsed] = useState({});
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const currentView = searchParams.get('view') === 'submissions' ? 'submissions' : 'explore';
  const isFormOpen = searchParams.get('modal') === 'submit';
  const draftSkillId = searchParams.get('edit') || '';

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [publishedSkills, nextStats, ownSkills] = await Promise.all([
        getPublishedSkills(),
        getSkillDBStats(),
        user?.uid ? getUserSkills(user.uid) : Promise.resolve([])
      ]);
      setSkills(publishedSkills);
      setStats(nextStats);
      setUserSkills(ownSkills);
    } catch (nextError) {
      setError(nextError?.message || 'Could not load SkillDB.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.title = 'SkillDB - AI Unplugged';
    loadData();
  }, [user?.uid]);

  useEffect(() => {
    setCollapsed((current) => {
      const next = { ...current };
      for (const category of SKILLDB_CATEGORIES) {
        if (!(category in next)) next[category] = false;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const visibleSkills = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    return skills.filter((skill) => {
      const matchesCategory = selectedCategory === 'All' || skill.category === selectedCategory;
      const haystack = [skill.name, skill.description, skill.useCase, skill.fileName, skill.category].join(' ').toLowerCase();
      const matchesSearch = !queryText || haystack.includes(queryText);
      return matchesCategory && matchesSearch;
    });
  }, [skills, search, selectedCategory]);

  const groupedSkills = useMemo(() => groupSkills(visibleSkills), [visibleSkills]);

  const schemas = useMemo(() => ([
    {
      '@type': 'CollectionPage',
      name: 'SkillDB',
      url: `${SITE_URL}/resources/skilldb`,
      description: 'Publish and discover Claude skill markdown files inside AI Unplugged.'
    },
    {
      '@type': 'ItemList',
      name: 'Published SkillDB entries',
      itemListElement: skills.map((skill, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'CreativeWork',
          name: `${skill.name} - ${skill.fileName}`,
          description: skill.description,
          dateCreated: skill.createdAt ? new Date(skill.createdAt).toISOString() : undefined
        }
      }))
    }
  ]), [skills]);

  function requireLogin() {
    navigate('/login', {
      state: {
        backgroundLocation: location,
        nextPath: '/resources/skilldb'
      }
    });
  }

  function setView(nextView) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextView === 'submissions') nextParams.set('view', 'submissions');
    else nextParams.delete('view');
    setSearchParams(nextParams, { replace: false });
  }

  function closeForm() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('modal');
    nextParams.delete('edit');
    setSearchParams(nextParams, { replace: false });
    setUploadProgress(0);
  }

  const draftSkill = useMemo(() => {
    if (!draftSkillId) return null;
    return [...userSkills, ...skills].find((skill) => skill.id === draftSkillId) || null;
  }, [draftSkillId, skills, userSkills]);

  function openForm(skill = null) {
    if (!isAuthenticated) {
      requireLogin();
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('modal', 'submit');
    if (skill?.id) nextParams.set('edit', skill.id);
    else nextParams.delete('edit');
    setSearchParams(nextParams, { replace: false });
    setError('');
  }

  async function handleSubmitSkill(formValues, file) {
    setSubmitting(true);
    setError('');
    setMessage('');
    setUploadProgress(1);
    try {
      let result;
      if (draftSkill?.id) {
        result = await updateSkillSubmission(draftSkill.id, draftSkill, formValues, file, user, setUploadProgress);
      } else {
        result = await createSkillSubmission(formValues, file, user, setUploadProgress);
      }
      await loadData();
      setView('submissions');
      setMessage(result?.subMessage || 'Your submission is now waiting for approval.');
      setUploadProgress(100);
      return result;
    } catch (nextError) {
      setUploadProgress(0);
      setError(nextError?.message || 'Could not submit this skill. Please try again.');
      throw nextError;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSkill(skill) {
    if (!window.confirm(`Delete "${skill.fileName}"? This cannot be undone.`)) return;
    try {
      await deleteSkillSubmission(skill, user, isAdmin);
      setSelectedSkill(null);
      setMessage('Skill deleted.');
      await loadData();
    } catch (nextError) {
      setError(nextError?.message || 'Could not delete this skill.');
    }
  }

  async function handleDownload(skill) {
    try {
      downloadSkillMarkdown(skill);
      await incrementSkillDownloads(skill.id);
    } catch (nextError) {
      setError(nextError?.message || 'Could not download this skill.');
      return;
    }
    setSelectedSkill((current) => current ? { ...current, downloads: Number(current.downloads || 0) + 1 } : current);
    setSkills((current) => current.map((item) => item.id === skill.id ? { ...item, downloads: Number(item.downloads || 0) + 1 } : item));
    setUserSkills((current) => current.map((item) => item.id === skill.id ? { ...item, downloads: Number(item.downloads || 0) + 1 } : item));
  }

  const ownedSkills = useMemo(
    () => userSkills.filter((skill) => skill.userId === user?.uid),
    [userSkills, user?.uid]
  );
  const categoryOptions = useMemo(() => ['All', ...SKILLDB_CATEGORIES], []);

  return (
    <>
      <SEO
        title="SkillDB"
        path="/resources/skilldb"
        description="Publish and discover Claude skill markdown files inside AI Unplugged."
        schemas={schemas}
      />

      <PageHeader
        label="Resources"
        title="SkillDB"
        accent="for Claude skills."
        subtitle="A cleaner layer for uploading, reviewing, browsing, and downloading practical Claude skills."
      />

      <section>
        <div className="section-wrap skilldb-wrap">
          <div className="skilldb-hero-card">
            <div className="skilldb-hero-copy">
              <p className="skilldb-kicker">Resource</p>
              <h2>Built for reusable AI knowledge, not one-time showcase posts.</h2>
              <p className="skilldb-subtitle">SkillDB keeps submissions, moderation, downloads, and ownership in one place so teams can share Claude skills that are actually reusable.</p>
              <div className="skilldb-view-toggle">
                <button
                  type="button"
                  className={`skilldb-view-pill${currentView === 'explore' ? ' is-active' : ''}`}
                  onClick={() => setView('explore')}
                >
                  Explore skills
                </button>
                {isAuthenticated ? (
                  <button
                    type="button"
                    className={`skilldb-view-pill${currentView === 'submissions' ? ' is-active' : ''}`}
                    onClick={() => setView('submissions')}
                  >
                    Your submissions ({ownedSkills.length})
                  </button>
                ) : null}
              </div>
            </div>
            <div className="skilldb-hero-panel">
              <div className="skilldb-hero-badge" aria-hidden="true">
                <SkillDBIcon className="skilldb-hero-icon" />
              </div>
              <button type="button" className="btn-primary" onClick={() => openForm()}>
                Add Skill <span className="btn-arrow">&rarr;</span>
              </button>
            </div>
          </div>

          <div className="skilldb-stats">
            <div className="skilldb-stat-card"><strong>{stats.totalSkills}</strong><span>Total Skills</span></div>
            <div className="skilldb-stat-card"><strong>{stats.categories}</strong><span>Categories</span></div>
            <div className="skilldb-stat-card"><strong>{stats.contributors}</strong><span>Contributors</span></div>
          </div>

          <div className="skilldb-toolbar">
            <input
              className="skilldb-search"
              placeholder="Search skills, contributors, categories, or file names"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="skilldb-filters">
              {categoryOptions.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={`skilldb-filter-pill${selectedCategory === category ? ' is-active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="skilldb-filter-select-wrap">
              <label className="sr-only" htmlFor="skilldb-category-select">Category</label>
              <select
                id="skilldb-category-select"
                className="skilldb-filter-select"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          {message ? <div className="form-success">{message}</div> : null}
          {error ? <div className="form-status-message" role="alert">{error}</div> : null}

          <div className="skilldb-content-grid">
            <div className="skilldb-main">
              {currentView === 'explore' ? (
                <>
                  {loading ? <div className="empty-state skilldb-empty">Loading SkillDB...</div> : null}
                  {!loading && !groupedSkills.length ? <div className="empty-state skilldb-empty">No published skills match this view yet.</div> : null}

                  {!loading && groupedSkills.map((group) => (
                <section className={`skilldb-category${collapsed[group.category] ? ' is-collapsed' : ''}`} key={group.category}>
                      <button
                        type="button"
                        className="skilldb-category-head"
                        onClick={() => setCollapsed((current) => ({ ...current, [group.category]: !current[group.category] }))}
                      >
                        <div className="skilldb-category-titlebar">
                          <h2>{group.category}</h2>
                          <p>{group.skills.length} skill{group.skills.length === 1 ? '' : 's'}</p>
                        </div>
                        <span className="skilldb-category-toggle">{collapsed[group.category] ? '+' : '−'}</span>
                      </button>

                      {!collapsed[group.category] ? (
                        <div className="skilldb-card-grid">
                          {group.skills.map((skill) => (
                            <SkillCard key={skill.id} skill={skill} onView={setSelectedSkill} />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))}
                </>
              ) : (
                <section className="skilldb-submissions-panel">
                  <div className="skilldb-submissions-head">
                    <div>
                      <h2>Your submissions</h2>
                      <p className="page-sub">Manage your uploaded skills, keep track of review state, and update the markdown file when needed.</p>
                    </div>
                    <span className="event-tag">{ownedSkills.length} total</span>
                  </div>
                  {!ownedSkills.length ? <div className="empty-state skilldb-empty">No submissions yet. Upload your first skill when you are ready.</div> : null}
                  <div className="skilldb-submissions-list">
                    {ownedSkills.map((skill) => (
                      <div className="skilldb-submission-row" key={skill.id}>
                        <div className="skilldb-submission-copy">
                          <strong>{skill.fileName}</strong>
                          <p>{skill.description}</p>
                          <div className="skilldb-card-meta">
                            <span>{skill.category}</span>
                            <span>{formatSkillFileSize(skill.fileSize)}</span>
                            <span>{skill.downloads || 0} downloads</span>
                          </div>
                        </div>
                        <div className="skilldb-submission-actions">
                          <span className={`resource-status-pill${skill.publishState === 'published' ? ' is-published' : skill.publishState === 'rejected' ? ' is-draft' : ''}`}>
                            {skill.publishState}
                          </span>
                          <button type="button" className="btn-secondary btn-small" onClick={() => setSelectedSkill(skill)}>View</button>
                          <button type="button" className="btn-secondary btn-small" onClick={() => openForm(skill)}>Edit</button>
                          <button type="button" className="auth-link danger-link" onClick={() => handleDeleteSkill(skill)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="skilldb-side">
              <div className="skilldb-side-card">
                <h3>How SkillDB works</h3>
                <ul className="skilldb-side-list">
                  <li>Upload a Claude skill file with a clear use case and description.</li>
                  <li>Each submission starts in review so the public archive stays useful.</li>
                  <li>After approval, people can browse, open, and download your skill from the public SkillDB page.</li>
                </ul>
              </div>

              {isAuthenticated ? (
                <div className="skilldb-side-card">
                  <div className="admin-inline-actions">
                    <h3>Your submissions</h3>
                    <span className="event-tag">{ownedSkills.length}</span>
                  </div>
                  {!ownedSkills.length ? <p className="page-sub">No submissions yet.</p> : null}
                  {ownedSkills.length ? <p className="page-sub">You currently have {ownedSkills.length} skill submission{ownedSkills.length === 1 ? '' : 's'} in SkillDB.</p> : null}
                  <div className="skilldb-side-actions">
                    <button type="button" className="btn-secondary" onClick={() => setView('submissions')}>
                      Manage submissions
                    </button>
                  </div>
                </div>
              ) : (
                <div className="skilldb-side-card">
                  <h3>Want to upload?</h3>
                  <p className="page-sub">Log in first. Your skill will go into pending review before it appears publicly.</p>
                  <button type="button" className="btn-secondary" onClick={requireLogin}>Log in to upload</button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      <SkillForm
        open={isFormOpen}
        draftSkill={draftSkill}
        submitting={submitting}
        uploadProgress={uploadProgress}
        onClose={() => {
          if (submitting) return;
          closeForm();
        }}
        onSubmit={handleSubmitSkill}
      />

      <SkillModal
        skill={selectedSkill}
        canDownload={Boolean(selectedSkill?.markdownContent || selectedSkill?.fileUrl)}
        canManage={Boolean(selectedSkill && (isAdmin || selectedSkill.userId === user?.uid))}
        onClose={() => setSelectedSkill(null)}
        onDownload={handleDownload}
        onEdit={(skill) => {
          setSelectedSkill(null);
          openForm(skill);
        }}
        onDelete={handleDeleteSkill}
      />
    </>
  );
}
