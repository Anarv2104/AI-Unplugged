import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import SEO, { SITE_URL } from '../components/SEO';
import { getPublishedResources } from '../lib/platform';

export default function ResourcesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const selectedSlug = searchParams.get('resource') || '';
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);

  useEffect(() => {
    document.title = 'Resources - AI Unplugged';
    getPublishedResources()
      .then((items) => {
        setResources(items);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedResource = useMemo(
    () => resources.find((item) => item.slug === selectedSlug) || null,
    [resources, selectedSlug]
  );
  const totalPages = Math.max(1, Math.ceil(resources.length / 15));
  const currentPage = Math.min(page, totalPages);
  const visibleResources = useMemo(
    () => resources.slice((currentPage - 1) * 15, currentPage * 15),
    [resources, currentPage]
  );

  useEffect(() => {
    if (!selectedResource) {
      document.body.style.overflow = '';
      return undefined;
    }

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedResource]);

  useEffect(() => {
    if (page === currentPage) return;
    const nextParams = new URLSearchParams(searchParams);
    if (currentPage <= 1) nextParams.delete('page');
    else nextParams.set('page', String(currentPage));
    setSearchParams(nextParams, { replace: true });
  }, [page, currentPage, searchParams, setSearchParams]);

  function openResource(resource) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('resource', resource.slug);
    setSearchParams(nextParams, { replace: false });
  }

  function closeResource() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('resource');
    setSearchParams(nextParams, { replace: false });
  }

  const schemas = useMemo(() => {
    const items = resources.map((resource, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'CreativeWork',
        name: resource.title,
        description: resource.excerpt || resource.body?.[0] || '',
        url: `${SITE_URL}/resources?resource=${resource.slug}`,
        image: resource.image?.url || `${SITE_URL}/AI%20UP.png`
      }
    }));

    return [
      {
        '@type': 'CollectionPage',
        name: 'AI Unplugged Resources',
        url: `${SITE_URL}/resources`,
        description: 'Published tools, systems, and operating resources from House of Starts, AI Unplugged, and the wider builder ecosystem.'
      },
      {
        '@type': 'ItemList',
        name: 'AI Unplugged Resources',
        itemListElement: items
      }
    ];
  }, [resources]);

  function goToPage(nextPage) {
    const safePage = Math.max(1, Math.min(totalPages, nextPage));
    const nextParams = new URLSearchParams(searchParams);
    if (safePage <= 1) nextParams.delete('page');
    else nextParams.set('page', String(safePage));
    setSearchParams(nextParams, { replace: false });
  }

  return (
    <>
      <SEO
        title="Resources"
        path={selectedSlug ? `/resources?resource=${selectedSlug}` : '/resources'}
        description="Published tools, systems, and builder resources from House of Starts, AI Unplugged, and the wider ecosystem."
        schemas={schemas}
      />

      <PageHeader
        label="Resources"
        title="Builder"
        accent="infrastructure."
        subtitle="Tools, platforms, and systems worth opening when you want leverage, not noise."
      />

      <section>
        <div className="section-wrap" style={{ paddingTop: 0 }}>
          {loading ? <div className="empty-state">Loading resources...</div> : null}

          {!loading && !resources.length ? (
            <div className="empty-state">No published resources yet.</div>
          ) : null}

          {!loading && resources.length ? (
            <div className="resources-grid">
              {visibleResources.map((resource) => (
                <button
                  type="button"
                  className="resource-card"
                  key={resource.id}
                  onClick={() => openResource(resource)}
                >
                  <div className="resource-card-media">
                    {resource.image?.url ? (
                      <img src={resource.image.url} alt={resource.image.name || resource.title} />
                    ) : (
                      <div className="resource-card-media-fallback">{resource.title}</div>
                    )}
                  </div>

                  <div className="resource-card-copy">
                    <h3>{resource.title}</h3>
                    <p>{resource.excerpt}</p>
                    <span className="cta-arrow">Open &rarr;</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {!loading && totalPages > 1 ? (
            <div className="resource-pagination">
              <button type="button" className="btn-secondary resource-page-button" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>
                Previous
              </button>
              <div className="resource-page-numbers">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1;
                  return (
                    <button
                      type="button"
                      key={pageNumber}
                      className={`resource-page-number${pageNumber === currentPage ? ' is-active' : ''}`}
                      onClick={() => goToPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="btn-secondary resource-page-button" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>
                Next
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {selectedResource ? (
        <div className="resource-modal-backdrop" onClick={closeResource}>
          <div className="resource-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="resource-modal-head">
              <div>
                <h2>{selectedResource.title}</h2>
              </div>
              <button type="button" className="auth-close resource-modal-close" aria-label="Close resource" onClick={closeResource}>×</button>
            </div>

            <div className="resource-modal-body">
              <div className="resource-modal-media">
                {selectedResource.image?.url ? (
                  <img src={selectedResource.image.url} alt={selectedResource.image.name || selectedResource.title} />
                ) : (
                  <div className="resource-card-media-fallback">{selectedResource.title}</div>
                )}
              </div>

              <div className="resource-modal-copy">
                <p className="page-sub resource-modal-excerpt">{selectedResource.excerpt}</p>
                {selectedResource.bodyHtml ? (
                  <div
                    className="resource-rich-copy"
                    dangerouslySetInnerHTML={{ __html: selectedResource.bodyHtml }}
                  />
                ) : (
                  <div className="resource-rich-copy">
                    {(selectedResource.body || []).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                  </div>
                )}
                {selectedResource.ctaUrl ? (
                  selectedResource.ctaUrl.startsWith('/') ? (
                    <button
                      type="button"
                      className="btn-primary resource-modal-cta"
                      onClick={() => {
                        closeResource();
                        navigate(selectedResource.ctaUrl);
                      }}
                    >
                      {selectedResource.ctaLabel || 'Open resource'} <span className="btn-arrow">&rarr;</span>
                    </button>
                  ) : (
                    <a
                      href={selectedResource.ctaUrl}
                      className="btn-primary resource-modal-cta"
                      target="_blank"
                      rel="noopener"
                    >
                      {selectedResource.ctaLabel || 'Open resource'} <span className="btn-arrow">&rarr;</span>
                    </a>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
