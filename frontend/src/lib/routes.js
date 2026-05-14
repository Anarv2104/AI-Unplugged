export function normalizeRouteSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildUpdatePath(slug) {
  const safeSlug = normalizeRouteSlug(slug);
  return safeSlug ? `/updates/${safeSlug}` : '/updates';
}

export function buildResourcePath(slug) {
  const safeSlug = normalizeRouteSlug(slug);
  return safeSlug ? `/resources/${safeSlug}` : '/resources';
}
