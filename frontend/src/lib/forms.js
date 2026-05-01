const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REDIRECT_DELAY_MS = 1200;

export function isBlank(value) {
  return String(value ?? '').trim() === '';
}

export function fieldIsVisible(field, values) {
  if (!field.showWhen) return true;
  return values[field.showWhen.field] === field.showWhen.equals;
}

export function validateAgainstSchema(fields, values) {
  const errors = {};

  for (const field of fields || []) {
    if (field.type === 'helper' || !fieldIsVisible(field, values)) continue;
    const value = values[field.id];
    const stringValue = typeof value === 'string' ? value.trim() : value;
    const empty =
      stringValue === '' ||
      stringValue == null ||
      stringValue === false ||
      (Array.isArray(stringValue) && stringValue.length === 0);

    if (field.required && empty) {
      errors[field.id] = 'This field is required.';
      continue;
    }

    if (field.type === 'email' && stringValue && !EMAIL_RE.test(stringValue)) {
      errors[field.id] = 'Please enter a valid email address.';
    }

    if (field.type === 'url' && stringValue) {
      try {
        new URL(stringValue);
      } catch (error) {
        errors[field.id] = 'Please enter a valid URL.';
      }
    }

    if (field.minLength && typeof stringValue === 'string' && stringValue.length < field.minLength) {
      errors[field.id] = `Please write at least ${field.minLength} characters.`;
    }
  }

  return errors;
}

export function buildInitialValues(fields, seed = {}) {
  const values = { ...seed };
  for (const field of fields || []) {
    if (field.type === 'helper') continue;
    if (!(field.id in values)) {
      values[field.id] = field.type === 'checkbox' ? Boolean(field.defaultValue) : field.defaultValue || '';
    }
  }
  return values;
}
