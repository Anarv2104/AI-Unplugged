/**
 * AI Unplugged — event.html
 * Reads ?id= from the URL and renders the corresponding event.
 */
(function () {
  function render() {
    var root = document.querySelector('[data-event-detail]');
    var notFound = document.querySelector('[data-event-notfound]');
    if (!root || !window.AI_UNPLUGGED_EVENTS) return;

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    var ev = window.AI_UNPLUGGED_EVENTS.find(function (e) { return e.id === id; });

    if (!ev) {
      root.style.display = 'none';
      if (notFound) notFound.style.display = 'block';
      document.title = 'Event not found — AI Unplugged';
      return;
    }

    document.title = ev.title + ' — AI Unplugged';

    setText(root, '[data-type]', ev.type);
    setText(root, '[data-title]', ev.title);
    setText(root, '[data-date]', ev.dateDisplay);
    setText(root, '[data-location]', ev.location);
    setText(root, '[data-duration-inline]', ev.duration);

    var descRoot = root.querySelector('[data-description]');
    if (descRoot && ev.description) {
      descRoot.innerHTML = '';
      ev.description.forEach(function (para) {
        var p = document.createElement('p');
        p.textContent = para;
        descRoot.appendChild(p);
      });
    }

    var agendaRoot = root.querySelector('[data-agenda]');
    var agendaBlock = root.querySelector('[data-agenda-block]');
    if (agendaRoot && ev.agenda && ev.agenda.length) {
      agendaRoot.innerHTML = '';
      ev.agenda.forEach(function (a) {
        var row = document.createElement('div');
        row.className = 'agenda-row';
        row.innerHTML = '<span class="time">' + a.time + '</span><span>' + a.item + '</span>';
        agendaRoot.appendChild(row);
      });
    } else if (agendaBlock) {
      agendaBlock.style.display = 'none';
    }

    var speakersRoot = root.querySelector('[data-speakers]');
    var speakersBlock = root.querySelector('[data-speakers-block]');
    if (speakersRoot && ev.speakers && ev.speakers.length) {
      speakersRoot.innerHTML = '';
      ev.speakers.forEach(function (s) {
        var row = document.createElement('div');
        row.className = 'speaker-row';
        row.innerHTML = '<div class="name">' + s.name + '</div><div class="role">' + s.role + '</div>';
        speakersRoot.appendChild(row);
      });
    } else if (speakersBlock) {
      speakersBlock.style.display = 'none';
    }

    setText(root, '[data-format]', ev.format);
    setText(root, '[data-capacity]', ev.capacity + ' builders');
    setText(root, '[data-entry]', ev.entry);
    setText(root, '[data-duration]', ev.duration);

    var applyBtn = root.querySelector('[data-apply-btn]');
    var endedBtn = root.querySelector('[data-ended-btn]');
    if (ev.status === 'past') {
      if (applyBtn) applyBtn.style.display = 'none';
      if (endedBtn) endedBtn.style.display = 'inline-flex';
    } else {
      if (applyBtn) applyBtn.setAttribute('href', 'apply.html?event=' + encodeURIComponent(ev.id));
      if (endedBtn) endedBtn.style.display = 'none';
    }
  }

  function setText(root, selector, value) {
    var el = root.querySelector(selector);
    if (el) el.textContent = value;
  }

  document.addEventListener('DOMContentLoaded', render);
})();
