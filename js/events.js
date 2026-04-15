/**
 * AI Unplugged — events.html
 * Renders the full events grid and handles type filtering.
 */
(function () {
  function formatMeta(ev) {
    return ev.dateDisplay + ' · ' + ev.location;
  }

  function createCard(ev) {
    var a = document.createElement('a');
    a.className = 'event-card-light';
    a.href = 'event.html?id=' + encodeURIComponent(ev.id);
    a.setAttribute('data-type', ev.type);
    a.setAttribute('data-status', ev.status);

    var typeLabel = ev.status === 'past' ? ev.type + ' · PAST' : ev.type;

    a.innerHTML =
      '<p class="event-card-type">' + typeLabel + '</p>' +
      '<h3>' + ev.title + '</h3>' +
      '<div class="event-meta">' +
        '<span>' + ev.dateDisplay + '</span>' +
        '<span>' + ev.location + '</span>' +
      '</div>' +
      '<p>' + ev.tagline + '</p>' +
      '<span class="event-tag">' + ev.entry + '</span>';
    return a;
  }

  function render() {
    var grid = document.querySelector('[data-events-grid]');
    if (!grid || !window.AI_UNPLUGGED_EVENTS) return;

    var events = window.AI_UNPLUGGED_EVENTS.slice().sort(function (a, b) {
      // Upcoming first (ascending by date), then past (descending).
      if (a.status !== b.status) return a.status === 'upcoming' ? -1 : 1;
      if (a.status === 'upcoming') return new Date(a.date) - new Date(b.date);
      return new Date(b.date) - new Date(a.date);
    });

    grid.innerHTML = '';
    events.forEach(function (ev) { grid.appendChild(createCard(ev)); });
  }

  function setupFilters() {
    var pills = document.querySelectorAll('[data-filter-pill]');
    var grid = document.querySelector('[data-events-grid]');
    var empty = document.querySelector('[data-events-empty]');
    if (!pills.length || !grid) return;

    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        pills.forEach(function (p) { p.classList.remove('is-active'); });
        pill.classList.add('is-active');

        var filter = pill.getAttribute('data-filter-pill');
        var visibleCount = 0;
        grid.querySelectorAll('.event-card-light').forEach(function (card) {
          var matches = filter === 'all' || card.getAttribute('data-type') === filter;
          card.style.display = matches ? '' : 'none';
          if (matches) visibleCount++;
        });

        if (empty) empty.style.display = visibleCount === 0 ? 'block' : 'none';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    render();
    setupFilters();
  });
})();
