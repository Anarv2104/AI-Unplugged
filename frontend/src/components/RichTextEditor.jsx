import { useEffect, useRef } from 'react';

const actions = [
  { command: 'bold', label: 'B' },
  { command: 'italic', label: 'I' },
  { command: 'underline', label: 'U' },
  { command: 'insertUnorderedList', label: '• List' },
  { command: 'insertOrderedList', label: '1. List' }
];

export default function RichTextEditor({ value, onChange, placeholder = 'Write here...' }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  function applyCommand(command) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    onChange(editorRef.current?.innerHTML || '');
  }

  function addLink() {
    const url = window.prompt('Enter a URL');
    if (!url) return;
    try {
      const parsed = new URL(url, window.location.origin);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        window.alert('Only http, https, and mailto links are allowed.');
        return;
      }
    } catch {
      window.alert('That URL is not valid.');
      return;
    }
    editorRef.current?.focus();
    document.execCommand('createLink', false, url);
    onChange(editorRef.current?.innerHTML || '');
  }

  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar">
        {actions.map((action) => (
          <button
            key={action.command}
            type="button"
            className="rich-editor-button"
            onClick={() => applyCommand(action.command)}
          >
            {action.label}
          </button>
        ))}
        <button type="button" className="rich-editor-button" onClick={addLink}>Link</button>
      </div>
      <div
        ref={editorRef}
        className="rich-editor-surface"
        contentEditable
        data-placeholder={placeholder}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        suppressContentEditableWarning
      />
    </div>
  );
}
