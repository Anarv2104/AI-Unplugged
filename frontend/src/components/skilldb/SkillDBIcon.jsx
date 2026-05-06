export default function SkillDBIcon({ className = '', title = 'SkillDB' }) {
  return (
    <svg className={className} viewBox="0 0 96 96" fill="none" role="img" aria-label={title}>
      <rect x="8" y="14" width="80" height="68" rx="22" stroke="currentColor" strokeWidth="6" />
      <ellipse cx="48" cy="26" rx="26" ry="10" stroke="currentColor" strokeWidth="6" />
      <path d="M26 44h44M26 58h28" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M58 62l8-8 8 8" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
