export default function Footer() {
  return (
    <footer>
      <div className="footer-left">&copy; {new Date().getFullYear()} AI Unplugged. Built for builders.</div>
      <div className="footer-links">
        <a href="/events">Events</a>
        <a href="/updates">Updates</a>
        <a href="/attend">Attend</a>
        <a href="/become-a-host">Become a Host</a>
        <a href="/node-lead">Node Lead</a>
        <a href="/about">About</a>
        <a href="https://x.com/houseofstarts" target="_blank" rel="noopener">Twitter</a>
        <a href="https://www.linkedin.com/company/houseofstarts" target="_blank" rel="noopener">LinkedIn</a>
      </div>
    </footer>
  );
}
