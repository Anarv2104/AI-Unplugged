import { formatSkillFileSize } from '../../lib/skilldb';

export default function SkillCard({ skill, onView }) {
  return (
    <article className="skilldb-card">
      <div className="skilldb-card-main">
        <div className="skilldb-card-copy">
          <div className="skilldb-card-head">
            <h4>{skill.name}</h4>
            <button type="button" className="btn-secondary btn-small" onClick={() => onView(skill)}>
              View
            </button>
          </div>
          <p>{skill.description}</p>
          <div className="skilldb-card-meta">
            <span>{skill.fileName}</span>
            <span>{formatSkillFileSize(skill.fileSize)}</span>
            <span>{skill.downloads || 0} downloads</span>
          </div>
        </div>
      </div>
      <div className="skilldb-card-footer">
        <span className="skilldb-card-label">Published in SkillDB</span>
      </div>
    </article>
  );
}
