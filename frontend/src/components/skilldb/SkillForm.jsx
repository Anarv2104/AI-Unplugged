import { useEffect, useState } from 'react';
import { SKILLDB_CATEGORIES, SKILLDB_MAX_FILE_SIZE } from '../../lib/skilldb';

const EMPTY_DRAFT = {
  name: '',
  phone: '',
  email: '',
  category: SKILLDB_CATEGORIES[0],
  description: '',
  useCase: ''
};

export default function SkillForm({ open, draftSkill = null, submitting = false, uploadProgress = 0, onClose, onSubmit }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [successState, setSuccessState] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDraft(draftSkill ? {
      name: draftSkill.name || '',
      phone: draftSkill.phone || '',
      email: draftSkill.email || '',
      category: draftSkill.category || SKILLDB_CATEGORIES[0],
      description: draftSkill.description || '',
      useCase: draftSkill.useCase || ''
    } : EMPTY_DRAFT);
    setFile(null);
    setError('');
    setSuccessState(null);
  }, [open, draftSkill]);

  if (!open) return null;

  function assignFile(nextFile) {
    setFile(nextFile || null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!draft.name.trim() || !draft.email.trim() || !draft.category || !draft.description.trim() || !draft.useCase.trim()) {
      setError('Fill every required field before uploading.');
      return;
    }

    if (!draftSkill?.id && !file) {
      setError('Upload a Markdown file.');
      return;
    }

    try {
      const result = await onSubmit(draft, file);
      setSuccessState({
        title: result?.message || 'Thank you. Your skill has been submitted.',
        subtitle: result?.subMessage || 'It is now in review and will appear publicly after approval.'
      });
    } catch (nextError) {
      setError(nextError?.message || 'Could not save this skill.');
    }
  }

  return (
    <div className="skilldb-modal-backdrop" onClick={onClose}>
      <div className="skilldb-modal-card skilldb-form-card" onClick={(event) => event.stopPropagation()}>
        <div className="skilldb-modal-head">
          <div className="skilldb-form-intro">
            <p className="skilldb-modal-kicker">{successState ? 'Submitted' : draftSkill?.id ? 'Edit submission' : 'Add Skill'}</p>
            <h2>{successState ? 'Submission received' : draftSkill?.id ? 'Update your skill' : 'Upload a Claude skill'}</h2>
            {!successState ? (
              <p className="skilldb-form-subtitle">
                Share a clean markdown skill with enough context for review, approval, and reuse.
              </p>
            ) : null}
          </div>
          <button type="button" className="auth-close skilldb-modal-close" aria-label="Close modal" onClick={onClose}>×</button>
        </div>

        {successState ? (
          <div className="skilldb-success-state">
            <div className="skilldb-success-check" aria-hidden="true">✓</div>
            <h3>{successState.title}</h3>
            <p>{successState.subtitle}</p>
            <div className="skilldb-modal-actions">
              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
        <form className="skilldb-form" onSubmit={handleSubmit}>
          <div className="skilldb-form-grid">
            <label className="form-field">
              <span className="form-label">Name</span>
              <input className="form-input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="form-field">
              <span className="form-label">Phone Number</span>
              <input className="form-input" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label className="form-field">
              <span className="form-label">Email</span>
              <input className="form-input" type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label className="form-field">
              <span className="form-label">Category</span>
              <select className="form-select" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                {SKILLDB_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="form-field">
            <span className="form-label">Description</span>
            <textarea className="form-textarea" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>

          <label className="form-field">
            <span className="form-label">Use Case</span>
            <textarea className="form-textarea" value={draft.useCase} onChange={(event) => setDraft((current) => ({ ...current, useCase: event.target.value }))} />
          </label>

          <div
            className={`skilldb-dropzone${isDragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              assignFile(event.dataTransfer.files?.[0] || null);
            }}
          >
            <p className="skilldb-dropzone-title">Skill Markdown file</p>
            <p className="skilldb-dropzone-copy">Drop a `.md` file here or choose one manually. Max size {Math.round(SKILLDB_MAX_FILE_SIZE / 1024)} KB.</p>
            <input type="file" accept=".md,text/markdown,text/plain" onChange={(event) => assignFile(event.target.files?.[0] || null)} />
            {file ? <p className="skilldb-dropzone-selected">✓ {file.name} selected</p> : null}
            {!file && draftSkill?.fileName ? <p className="skilldb-dropzone-selected">Current file: {draftSkill.fileName}. Upload a new `.md` file only if you want to replace it.</p> : null}
          </div>

          {error ? <div className="form-error">{error}</div> : null}
          {submitting ? (
            <div className="skilldb-upload-progress">
              {uploadProgress >= 100
                ? 'Submission complete.'
                : uploadProgress >= 70
                  ? 'Saving submission...'
                  : uploadProgress >= 15
                    ? 'Reading markdown file...'
                    : 'Preparing submission...'}
            </div>
          ) : null}

          <div className="skilldb-modal-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : draftSkill?.id ? 'Save changes' : 'Upload Skill'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
