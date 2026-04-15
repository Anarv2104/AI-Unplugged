/**
 * AI Unplugged — shared page behavior.
 * - Highlights the current page in the nav.
 * - Fills in the footer year.
 * - Pauses the ticker on hover (landing only).
 * - On the landing page, injects the nearest upcoming event into the
 *   "Next Event" spotlight so the homepage always reflects events-data.js.
 */
(function () {
  function getCurrentPage() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    if (path === '') return 'index.html';
    return path;
  }

  function setNavActive() {
    var page = getCurrentPage();
    var links = document.querySelectorAll('.nav-links a[data-nav]');
    links.forEach(function (link) {
      if (link.getAttribute('data-nav') === page) {
        link.classList.add('nav-active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function setFooterYear() {
    var el = document.querySelector('[data-footer-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  function pauseTickerOnHover() {
    var ticker = document.querySelector('.ticker');
    if (!ticker) return;
    ticker.addEventListener('mouseenter', function () {
      ticker.style.animationPlayState = 'paused';
    });
    ticker.addEventListener('mouseleave', function () {
      ticker.style.animationPlayState = 'running';
    });
  }

  function renderNextEventSpotlight() {
    var root = document.querySelector('[data-next-event]');
    if (!root || !window.AI_UNPLUGGED_EVENTS) return;

    var upcoming = window.AI_UNPLUGGED_EVENTS
      .filter(function (e) { return e.status === 'upcoming'; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });

    if (!upcoming.length) return;
    var next = upcoming[0];

    var titleEl = root.querySelector('[data-next-title]');
    var dateEl = root.querySelector('[data-next-date]');
    var locEl = root.querySelector('[data-next-location]');
    var taglineEl = root.querySelector('[data-next-tagline]');
    var applyBtn = root.querySelector('[data-next-apply]');

    var capEl = root.querySelector('[data-next-capacity]');
    var entryEl = root.querySelector('[data-next-entry]');
    var durEl = root.querySelector('[data-next-duration]');
    var fmtEl = root.querySelector('[data-next-format]');

    if (titleEl) titleEl.textContent = next.title;
    if (dateEl) dateEl.textContent = next.dateDisplay;
    if (locEl) locEl.textContent = next.location;
    if (taglineEl) taglineEl.textContent = next.tagline;
    if (applyBtn) applyBtn.setAttribute('href', 'apply.html?event=' + encodeURIComponent(next.id));

    if (capEl) capEl.textContent = next.capacity + ' builders';
    if (entryEl) entryEl.textContent = next.entry;
    if (durEl) durEl.textContent = next.duration;
    if (fmtEl) fmtEl.textContent = next.format;
  }

  document.addEventListener('DOMContentLoaded', function () {
    setNavActive();
    setFooterYear();
    pauseTickerOnHover();
    renderNextEventSpotlight();
  });
})();
