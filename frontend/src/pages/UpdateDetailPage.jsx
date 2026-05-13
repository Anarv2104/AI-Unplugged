import DOMPurify from 'dompurify';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getCommentsForUpdate, getUpdateBySlug, submitUpdateComment } from '../lib/platform';
import SEO from '../components/SEO';

function AttachmentItem({ att }) {
  const isImage = att.mimeType?.startsWith('image/');
  const isVideo = att.mimeType?.startsWith('video/');
  const typeLabel = att.mimeType?.split('/').pop()?.toUpperCase() || 'FILE';

  return (
    <div className="attachment-item">
      {isImage ? <img src={att.url} alt={att.name} className="attachment-image" /> : null}
      {isVideo ? <video controls src={att.url} className="attachment-video" /> : null}
      <div className="attachment-meta">
        <div className="attachment-info">
          <span className="attachment-name">{att.name}</span>
          <span className="attachment-type">{typeLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!isImage && !isVideo ? (
            <a href={att.url} target="_blank" rel="noopener noreferrer" className="btn-secondary attachment-download">
              View
            </a>
          ) : null}
          {att.downloadable ? (
            <a href={att.url} download={att.name} className="btn-secondary attachment-download">
              Download
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function UpdateDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [update, setUpdate] = useState(undefined);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getUpdateBySlug(slug).then(async (item) => {
      setUpdate(item);
      if (item?.id) {
        const list = await getCommentsForUpdate(item.id);
        setComments(list);
      }
    });
  }, [slug]);


  async function handleCommentSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const result = await submitUpdateComment({
        updateId: update.id,
        updateSlug: update.slug,
        title: update.title,
        excerpt: update.excerpt,
        commentMode: update.commentMode,
        body: comment
      });
      setComment('');
      if (result.status === 'approved') {
        const list = await getCommentsForUpdate(update.id);
        setComments(list);
        setMessage('Comment published.');
      } else {
        setMessage('Comment submitted for moderation.');
      }
    } catch (nextError) {
      setError(nextError?.message || 'Could not submit comment.');
    }
  }

  if (update === undefined) {
    return <div className="page-header"><p className="page-sub">Loading update...</p></div>;
  }

  if (!update) {
    return (
      <header className="page-header">
        <p className="section-label">404</p>
        <h1>Update not found</h1>
        <p className="page-sub">That update either does not exist yet or has not been published.</p>
      </header>
    );
  }

  const updatePath = `/updates/${slug}`;
  const updateSchemas = [
    {
      '@type': 'Article',
      headline: update.title,
      description: update.excerpt || '',
      author: { '@type': 'Organization', name: update.authorName || 'AI Unplugged' },
      publisher: {
        '@type': 'Organization',
        name: 'AI Unplugged',
        logo: { '@type': 'ImageObject', url: 'https://aiunplugged.club/AI%20UP.png' },
      },
      datePublished: update.publishedAt || update.createdAt || '',
      url: `https://aiunplugged.club${updatePath}`,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aiunplugged.club' },
        { '@type': 'ListItem', position: 2, name: 'Updates', item: 'https://aiunplugged.club/updates' },
        { '@type': 'ListItem', position: 3, name: update.title, item: `https://aiunplugged.club${updatePath}` },
      ],
    },
  ];

  return (
    <article className="update-detail">
      <SEO
        title={update.title}
        description={update.excerpt ? update.excerpt.slice(0, 160) : update.title}
        path={updatePath}
        ogType="article"
        schemas={updateSchemas}
      />
      <div className="page-header">
        <p className="section-label">{update.category}</p>
        <h1>{update.title}</h1>
        <p className="page-sub">{update.excerpt}</p>
      </div>

      <div className="section-wrap" style={{ paddingTop: 0 }}>
        <div className="update-detail-grid">
          <div className="event-body-content">
            {update.bodyHtml ? (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(update.bodyHtml) }} />
            ) : (
              (update.body || []).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))
            )}
            {update.attachments?.length ? (
              <div className="update-attachments">
                <p className="section-label">Attachments</p>
                {update.attachments.map((att) => (
                  <AttachmentItem key={att.id} att={att} />
                ))}
              </div>
            ) : null}
          </div>

          <aside className="event-side-card">
            <div className="detail-row">
              <span className="label">Category</span>
              <span className="val">{update.category}</span>
            </div>
            <div className="detail-row">
              <span className="label">Comments</span>
              <span className="val">{update.commentMode}</span>
            </div>
            <div className="detail-row">
              <span className="label">Author</span>
              <span className="val">{update.authorName || 'AI Unplugged'}</span>
            </div>
            <div className="detail-row">
              <span className="label">State</span>
              <span className="val">{update.publishState}</span>
            </div>
          </aside>
        </div>

        <section className="comment-section">
          <div className="comment-section-head">
            <h2>Comments</h2>
            {!isAuthenticated ? (
              <button type="button" className="btn-secondary" onClick={() => navigate('/login', { state: { backgroundLocation: location } })}>
                Log In To Comment
              </button>
            ) : null}
          </div>

          {isAuthenticated && update.commentMode !== 'disabled' ? (
            <form className="form-card comment-form" onSubmit={handleCommentSubmit}>
              <div className="form-field">
                <label className="form-label" htmlFor="comment-body">Commenting as {user?.email}</label>
                <textarea className="form-textarea" id="comment-body" value={comment} onChange={(event) => setComment(event.target.value)} />
              </div>
              {error ? <div className="form-status-message" role="alert">{error}</div> : null}
              {message ? <div className="auth-success">{message}</div> : null}
              <button type="submit" className="btn-primary">Post Comment</button>
            </form>
          ) : null}

          {update.commentMode === 'disabled' ? (
            <div className="empty-state">Comments are disabled for this update.</div>
          ) : null}

          <div className="comment-list">
            {comments.map((item) => (
              <div className="comment-card" key={item.id}>
                <div className="comment-meta">
                  <strong>{item.authorName || 'Member'}</strong>
                  <span>{item.status}</span>
                </div>
                <p>{item.body}</p>
              </div>
            ))}
            {!comments.length ? <div className="empty-state">No approved comments yet.</div> : null}
          </div>
        </section>
      </div>
    </article>
  );
}
