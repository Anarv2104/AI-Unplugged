export default function PageHeader({ label, title, accent, subtitle }) {
  return (
    <header className="page-header">
      <p className="section-label">{label}</p>
      <h1>
        {title}
        <br />
        <span className="italic">{accent}</span>
      </h1>
      <p className="page-sub">{subtitle}</p>
    </header>
  );
}
