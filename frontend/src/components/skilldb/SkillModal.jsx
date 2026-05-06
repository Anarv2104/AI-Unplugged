import { formatSkillFileSize } from '../../lib/skilldb';

function formatAddedDate(value) {
  if (!value) return 'Unknown date';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function SkillModal({ skill, canManage = false, canDownload = true, onClose, onDownload, onEdit, onDelete }) {
  if (!skill) return null;

  return (
    <div className="skilldb-modal-backdrop" onClick={onClose}>
      <div className="skilldb-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="skilldb-modal-head">
          <div>
            <p className="skilldb-modal-kicker">{skill.category}</p>
            <h2>{skill.name}</h2>
          </div>
          <button type="button" className="auth-close skilldb-modal-close" aria-label="Close modal" onClick={onClose}>×</button>
        </div>

        <div className="skilldb-modal-grid">
          <div className="skilldb-modal-section">
            <h3>Description</h3>
            <p>{skill.description}</p>
          </div>
          <div className="skilldb-modal-section">
            <h3>Use case</h3>
            <p>{skill.useCase}</p>
          </div>
        </div>

        <div className="skilldb-modal-metadata">
          <span>{skill.fileName}</span>
          <span>{formatSkillFileSize(skill.fileSize)}</span>
          <span>{skill.downloads || 0} downloads</span>
          <span>Added on {formatAddedDate(skill.createdAt)}</span>
        </div>

        <div className="skilldb-modal-actions">
          {canDownload ? (
            <button type="button" className="btn-primary" onClick={() => onDownload(skill)}>
              Download <span className="btn-arrow">&rarr;</span>
            </button>
          ) : null}
          {canManage ? (
            <div className="skilldb-modal-manage">
              <button type="button" className="btn-secondary" onClick={() => onEdit(skill)}>Edit</button>
              <button type="button" className="btn-secondary btn-danger-secondary" onClick={() => onDelete(skill)}>Delete</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
