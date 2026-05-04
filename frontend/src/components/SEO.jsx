import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://aiunplugged.club';
const DEFAULT_IMAGE = `${SITE_URL}/AI%20UP.png`;
const DEFAULT_DESCRIPTION =
  'AI Unplugged is a builder-first platform for high-signal AI rooms, curated events, and compounding access inside the House of Starts ecosystem. Join as an attendee, host, or node lead.';

export { SITE_URL };

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '',
  ogImage = DEFAULT_IMAGE,
  ogType = 'website',
  noIndex = false,
  schemas = [],
}) {
  const fullTitle = title
    ? `${title} — AI Unplugged`
    : 'AI Unplugged — The AI Ecosystem for Builders';
  const canonical = `${SITE_URL}${path}`;
  const jsonLd = schemas.length > 0
    ? { '@context': 'https://schema.org', '@graph': schemas }
    : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noIndex ? <meta name="robots" content="noindex, nofollow" /> : null}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="AI Unplugged" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </Helmet>
  );
}
