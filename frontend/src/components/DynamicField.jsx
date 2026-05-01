import { fieldIsVisible } from '../lib/forms';

export default function DynamicField({ field, value, onChange, error, values }) {
  if (field.type === 'helper') {
    return (
      <div className="form-helper-block">
        <strong>{field.label}</strong>
        {field.helperText ? <p>{field.helperText}</p> : null}
      </div>
    );
  }

  if (!fieldIsVisible(field, values)) return null;

  const fieldClassName = `form-field${error ? ' has-error' : ''}`;
  const id = field.id;

  function renderControl() {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            className="form-textarea"
            id={id}
            placeholder={field.placeholder || ''}
            value={value ?? ''}
            onChange={(event) => onChange(field.id, event.target.value)}
          />
        );
      case 'select':
        return (
          <select
            className="form-select"
            id={id}
            value={value ?? ''}
            onChange={(event) => onChange(field.id, event.target.value)}
          >
            <option value="">Select</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'radio':
        return (
          <div className="form-radio-group">
            {(field.options || []).map((option) => (
              <div className="form-radio" key={option}>
                <input
                  type="radio"
                  id={`${id}-${option}`}
                  name={id}
                  value={option}
                  checked={value === option}
                  onChange={(event) => onChange(field.id, event.target.value)}
                />
                <label htmlFor={`${id}-${option}`}>{option}</label>
              </div>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <label className="checkbox-row" htmlFor={id}>
            <input
              id={id}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => onChange(field.id, event.target.checked)}
            />
            <span>{field.placeholder || field.label}</span>
          </label>
        );
      default:
        return (
          <input
            className="form-input"
            id={id}
            type={field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : field.type}
            placeholder={field.placeholder || ''}
            value={value ?? ''}
            onChange={(event) => onChange(field.id, event.target.value)}
          />
        );
    }
  }

  return (
    <div className={fieldClassName}>
      <label className="form-label" htmlFor={id}>
        {field.label}
        {field.helperText ? <span className="hint">{field.helperText}</span> : null}
      </label>
      {renderControl()}
      <div className="form-error">{error || 'This field is required.'}</div>
    </div>
  );
}
