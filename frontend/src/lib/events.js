function parseTimeOnDate(dateString, timeString) {
  if (!dateString || !timeString) return null;
  const match = String(timeString).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const value = new Date(`${dateString}T00:00:00`);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function ensureNumber(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeAgenda(value) {
  return ensureArray(value)
    .map((item) => ({
      time: ensureString(item?.time),
      item: ensureString(item?.item),
    }))
    .filter((item) => item.time || item.item);
}

function normalizeSpeakers(value) {
  return ensureArray(value)
    .map((item) => ({
      name: ensureString(item?.name),
      role: ensureString(item?.role),
    }))
    .filter((item) => item.name || item.role);
}

function coerceDateOnly(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export function normalizeEventRecord(event) {
  if (!event) return null;

  const description = ensureArray(event.description)
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  const dateOnly = coerceDateOnly(event.date);

  const normalized = {
    ...event,
    title: ensureString(event.title, 'Untitled Event'),
    type: ensureString(event.type, 'Flagship'),
    format: ensureString(event.format, 'TBA'),
    entry: ensureString(event.entry, 'Application'),
    duration: ensureString(event.duration, ''),
    location: ensureString(event.location, ''),
    tagline: ensureString(event.tagline, ''),
    date: dateOnly,
    dateDisplay: ensureString(event.dateDisplay, dateOnly || 'Date TBA'),
    startTime: ensureString(event.startTime),
    endTime: ensureString(event.endTime),
    publishState: ensureString(event.publishState, 'draft'),
    status: ensureString(event.status, 'upcoming'),
    description,
    agenda: normalizeAgenda(event.agenda),
    speakers: normalizeSpeakers(event.speakers),
    capacity: ensureNumber(event.capacity, null),
    mapEnabled: Boolean(event.mapEnabled && (event.mapLat != null || event.mapLng != null || event.mapAddress || event.location)),
    mapLat: ensureNumber(event.mapLat, null),
    mapLng: ensureNumber(event.mapLng, null),
    mapAddress: ensureString(event.mapAddress, ''),
  };

  return normalized;
}

function parseDurationMinutes(duration) {
  const value = String(duration || '').toLowerCase();
  const hoursMatch = value.match(/(\d+(?:\.\d+)?)\s*hour/);
  const minutesMatch = value.match(/(\d+)\s*min/);
  let total = 0;
  if (hoursMatch) total += Number(hoursMatch[1]) * 60;
  if (minutesMatch) total += Number(minutesMatch[1]);
  return total || null;
}

function resolveEventWindow(event) {
  if (event.startTime && event.endTime && event.date) {
    const start = new Date(`${event.date}T${event.startTime}:00`);
    const end = new Date(`${event.date}T${event.endTime}:00`);
    return { start, end };
  }

  if (event.agenda?.length && event.date) {
    const start = parseTimeOnDate(event.date, event.agenda[0]?.time);
    const end = parseTimeOnDate(event.date, event.agenda[event.agenda.length - 1]?.time);
    if (start && end) return { start, end };
  }

  if (event.date) {
    const start = new Date(`${event.date}T00:00:00`);
    const durationMinutes = parseDurationMinutes(event.duration);
    if (durationMinutes) {
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      return { start, end };
    }
    const end = new Date(`${event.date}T23:59:59`);
    return { start, end };
  }

  return { start: null, end: null };
}

export function getEventStatus(event, now = new Date()) {
  const { start, end } = resolveEventWindow(event);
  if (!start || !end) return event.status || 'upcoming';
  if (now < start) return 'upcoming';
  if (now > end) return 'past';
  return 'ongoing';
}

export function withDerivedEventState(event, now = new Date()) {
  const { start, end } = resolveEventWindow(event);
  return {
    ...event,
    derivedStatus: getEventStatus(event, now),
    startsAt: start ? start.toISOString() : null,
    endsAt: end ? end.toISOString() : null
  };
}

export function sortEventsByState(events, now = new Date()) {
  const order = { ongoing: 0, upcoming: 1, past: 2 };
  return [...events]
    .map((event) => withDerivedEventState(event, now))
    .sort((a, b) => {
      if (order[a.derivedStatus] !== order[b.derivedStatus]) {
        return order[a.derivedStatus] - order[b.derivedStatus];
      }
      if (a.derivedStatus === 'past') return new Date(b.startsAt || b.date) - new Date(a.startsAt || a.date);
      return new Date(a.startsAt || a.date) - new Date(b.startsAt || b.date);
    });
}

export function formatEventStatusLabel(event) {
  const derived = event.derivedStatus || getEventStatus(event);
  return derived.toUpperCase();
}

export function resolveHomeSpotlightEvents(events, featuredHomeEventIds = [], now = new Date()) {
  const sorted = sortEventsByState(events, now);
  const eligible = sorted.filter((event) => (
    event.publishState === 'published'
    && (event.derivedStatus === 'ongoing' || event.derivedStatus === 'upcoming')
  ));

  const featuredIds = Array.isArray(featuredHomeEventIds) ? featuredHomeEventIds.slice(0, 2) : [];
  const featured = featuredIds
    .map((id) => eligible.find((event) => event.id === id))
    .filter(Boolean);

  if (featured.length > 0) return featured;

  return eligible.slice(0, 2);
}
