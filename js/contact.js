/**
 * Seattle Emergency Hubs – Contact form
 *
 * Renders the Cloudflare Turnstile widget and submits the form as JSON to
 * the Netlify function at /api/contact (netlify/functions/contact.mjs).
 * The Turnstile site key comes from js/runtime-config.js, written at build.
 */
(function () {
  'use strict';

  const form = document.getElementById('contact-form');
  if (!form) return;

  const status = document.getElementById('contact-status');
  const submitBtn = form.querySelector('button[type="submit"]');
  const siteKey = window.TURNSTILE_SITE_KEY;
  let widgetId = null;

  function showStatus(kind, text) {
    status.className = 'form-status form-status-' + kind;
    status.textContent = text;
    status.hidden = false;
  }

  if (!siteKey) {
    showStatus('error', 'The contact form is not configured yet. Please check back soon.');
    submitBtn.disabled = true;
    return;
  }

  // Called by the Turnstile script once loaded (see ?onload= in contact.html).
  window.sehTurnstileReady = function () {
    widgetId = window.turnstile.render('#contact-turnstile', {
      sitekey: siteKey,
      // Follow the site's own light/dark toggle rather than the OS setting.
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
    });
  };

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const token = widgetId !== null ? window.turnstile.getResponse(widgetId) : '';
    if (!token) {
      showStatus('error', 'Please complete the spam check above the Send button.');
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    data.token = token;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    status.hidden = true;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(function () { return {}; });

      if (res.ok) {
        form.reset();
        showStatus('success', 'Thanks! Your message has been sent. We’ll get back to you soon.');
      } else {
        showStatus('error', result.error || 'Your message could not be sent. Please try again later.');
      }
    } catch (e) {
      showStatus('error', 'Network error. Please check your connection and try again.');
    } finally {
      // Tokens are single-use, so every attempt needs a fresh one.
      if (widgetId !== null) window.turnstile.reset(widgetId);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }
  });

})();
