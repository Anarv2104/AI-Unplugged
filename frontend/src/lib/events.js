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
