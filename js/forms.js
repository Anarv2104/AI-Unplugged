/**
 * AI Unplugged — form handler.
 * Auto-attaches to any <form data-form="attend|node-lead">.
 *
 * Behavior:
 *   1. preventDefault + validate required fields, email, min-length.
 *   2. Collect fields into a plain object.
 *   3. POST the payload to /api/submissions where the server appends it
 *      to a CSV file.
 *   4. Show a short success state, then redirect to thank-you.html?form=<type>.
 *
 * To replace with a real endpoint later, change the body of
 * `submit()` below — the one marked "// === SWAP POINT ===".
 * Example (Formspree):
 *   await fetch('https://formspree.io/f/XXXX', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
 *     body: JSON.stringify(payload)
 *   });
 */
(function () {
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var REDIRECT_DELAY_MS = 1200;

  function setFieldError(field, message) {
    field.classList.add('has-error');
    var err = field.querySelector('.form-error');
    if (err && message) err.textContent = message;
  }

  function clearFieldError(field) {
    field.classList.remove('has-error');
  }

  function validateField(input) {
    var field = input.closest('.form-field');
    if (!field) return true;

    if (input.hasAttribute('data-skip-validation')) {
      clearFieldError(field);
      return true;
    }

    // Radio groups: require at least one checked within the group (by name).
    if (input.type === 'radio') {
      var form = input.form;
      if (!form) return true;
      var groupRequired = form.querySelector('input[type="radio"][name="' + input.name + '"][required]');
      if (!groupRequired) {
        clearFieldError(field);
        return true;
      }
      var checked = form.querySelector('input[type="radio"][name="' + input.name + '"]:checked');
      if (!checked) {
        setFieldError(field, 'Please pick one.');
        return false;
      }
      clearFieldError(field);
      return true;
    }

    var value = (input.value || '').trim();
    var required = input.hasAttribute('required');
    var minLen = parseInt(input.getAttribute('data-minlength'), 10);
    var type = input.getAttribute('type');

    if (required && !value) {
      setFieldError(field, 'This field is required.');
      return false;
    }
    if (type === 'email' && value && !EMAIL_RE.test(value)) {
      setFieldError(field, 'Please enter a valid email address.');
      return false;
    }
    if (!isNaN(minLen) && value && value.length < minLen) {
      setFieldError(field, 'Please write at least ' + minLen + ' characters.');
      return false;
    }

    clearFieldError(field);
    return true;
  }

  function collect(form) {
    var data = {};
    var inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else if (el.type === 'checkbox') {
        data[el.name] = el.checked;
      } else {
        data[el.name] = el.value;
      }
    });
    return data;
  }

  function sendSubmission(payload) {
    return fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.error || 'Could not save submission.');
        });
      }
      return res.json();
    });
  }

  function ensureOverlay() {
    var existing = document.querySelector('[data-submission-overlay]');
    if (existing) return existing;

    var overlay = document.createElement('div');
    overlay.className = 'submission-overlay';
    overlay.setAttribute('data-submission-overlay', '');
    overlay.innerHTML =
      '<div class="submission-toast" role="status" aria-live="polite">' +
        '<div class="submission-mark">✓</div>' +
        '<h3 data-success-title>Application received</h3>' +
        '<p data-success-body>Saving your submission and taking you to the confirmation page.</p>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function showSuccessState(formType) {
    var overlay = ensureOverlay();
    var title = overlay.querySelector('[data-success-title]');
    var body = overlay.querySelector('[data-success-body]');

    if (formType === 'node-lead') {
      if (title) title.textContent = 'Node Lead application received';
      if (body) body.textContent = 'Your application is saved locally on this device. Redirecting to the confirmation page.';
    } else {
      if (title) title.textContent = 'Event application received';
      if (body) body.textContent = 'Your application is saved locally on this device. Redirecting to the confirmation page.';
    }

    requestAnimationFrame(function () {
      overlay.classList.add('is-visible');
    });
  }

  function setSubmitState(form, pending) {
    var button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (!button.hasAttribute('data-original-label')) {
      button.setAttribute('data-original-label', button.innerHTML);
    }
    button.disabled = pending;
    button.classList.toggle('is-disabled', pending);
    button.innerHTML = pending ? 'Submitting...' : button.getAttribute('data-original-label');
  }

  function setFormMessage(form, message) {
    var row = form.querySelector('.form-submit-row');
    if (!row) return;
    var existing = form.querySelector('[data-form-message]');
    if (!existing) {
      existing = document.createElement('div');
      existing.setAttribute('data-form-message', '');
      existing.className = 'form-error';
      existing.style.display = 'block';
      existing.style.marginTop = '12px';
      row.insertAdjacentElement('afterend', existing);
    }
    existing.textContent = message;
  }

  function clearFormMessage(form) {
    var existing = form.querySelector('[data-form-message]');
    if (existing) existing.remove();
  }

  function submit(form, formType) {
    var payload = collect(form);
    payload.form = formType;
    payload.submittedAt = new Date().toISOString();

    // === SWAP POINT ===
    // Replace this block with another fetch() target / email service if needed.
    clearFormMessage(form);
    setSubmitState(form, true);
    sendSubmission(payload)
      .then(function () {
        showSuccessState(formType);
        window.setTimeout(function () {
          window.location.href = 'thank-you.html?form=' + encodeURIComponent(formType);
        }, REDIRECT_DELAY_MS);
      })
      .catch(function (err) {
        setSubmitState(form, false);
        setFormMessage(form, err && err.message ? err.message : 'Could not submit. Please try again.');
      });
  }

  function focusFirstError(form) {
    var first = form.querySelector('.form-field.has-error input, .form-field.has-error textarea, .form-field.has-error select');
    if (first) first.focus();
  }

  function attach(form) {
    var formType = form.getAttribute('data-form');

    // Live-clear errors while user types.
    form.addEventListener('input', function (e) {
      var field = e.target.closest('.form-field');
      if (field && field.classList.contains('has-error')) {
        validateField(e.target);
      }
    });

    // Conditional field toggles (e.g. Node Lead "organized before" => detail textarea).
    form.querySelectorAll('[data-conditional-trigger]').forEach(function (input) {
      input.addEventListener('change', function () {
        var targetSel = input.getAttribute('data-conditional-trigger');
        var showOn = input.getAttribute('data-conditional-value');
        var targets = form.querySelectorAll(targetSel);
        var show = input.checked && input.value === showOn;
        targets.forEach(function (t) {
          t.classList.toggle('is-visible', show);
          var nested = t.querySelector('input, textarea, select');
          if (nested) {
            if (show) nested.setAttribute('required', 'required');
            else {
              nested.removeAttribute('required');
              var f = nested.closest('.form-field');
              if (f) f.classList.remove('has-error');
            }
          }
        });
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll('input, textarea, select').forEach(function (el) {
        if (!validateField(el)) ok = false;
      });
      if (!ok) {
        focusFirstError(form);
        return;
      }
      submit(form, formType);
    });
  }

  function prefillEventContext() {
    var pin = document.querySelector('[data-event-context]');
    if (!pin || !window.AI_UNPLUGGED_EVENTS) return;

    var params = new URLSearchParams(window.location.search);
    var eventId = params.get('event');
    var eventInput = document.querySelector('[data-event-input]');

    if (!eventId) {
      pin.style.display = 'none';
      return;
    }

    var ev = window.AI_UNPLUGGED_EVENTS.find(function (e) { return e.id === eventId; });
    if (!ev) {
      pin.style.display = 'none';
      return;
    }

    var titleEl = pin.querySelector('[data-pin-title]');
    var metaEl = pin.querySelector('[data-pin-meta]');
    if (titleEl) titleEl.textContent = ev.title;
    if (metaEl) metaEl.textContent = ev.dateDisplay + ' · ' + ev.location;
    if (eventInput) {
      // The select may not contain past events (populateEventSelect only adds
      // upcoming) — inject an option for the current event if it's missing.
      if (eventInput.tagName === 'SELECT') {
        var hasOption = Array.prototype.some.call(eventInput.options, function (o) {
          return o.value === ev.id;
        });
        if (!hasOption) {
          var opt = document.createElement('option');
          opt.value = ev.id;
          opt.textContent = ev.title + ' — ' + ev.dateDisplay;
          eventInput.appendChild(opt);
        }
      }
      eventInput.value = ev.id;
      // Hide the field visually — the value still submits.
      var wrapper = document.querySelector('[data-event-select-wrapper]');
      if (wrapper) wrapper.style.display = 'none';
    }
  }

  function populateEventSelect() {
    var select = document.querySelector('[data-event-select]');
    if (!select || !window.AI_UNPLUGGED_EVENTS) return;
    var upcoming = window.AI_UNPLUGGED_EVENTS
      .filter(function (e) { return e.status === 'upcoming'; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    upcoming.forEach(function (ev) {
      var opt = document.createElement('option');
      opt.value = ev.id;
      opt.textContent = ev.title + ' — ' + ev.dateDisplay;
      select.appendChild(opt);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    populateEventSelect();
    prefillEventContext();
    document.querySelectorAll('form[data-form]').forEach(attach);
  });
})();
