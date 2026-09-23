/**
 * Seattle Emergency Hubs – Hub Registry
 *
 * Single source of truth for which hubs exist:
 *
 *   content/hubs.json → hub cards on hubs/index.html + the Hubs nav dropdown
 *
 * Adding a hub means adding one entry to that file (via the CMS at /admin/,
 * or via tools/migrate_hub.py). Nothing else needs editing.
 *
 * This file is loaded before components.js so that SEHHubs.load() is available
 * when the header is injected.
 */
(function () {
  'use strict';

  // Path prefix derived from this script's own src, matching components.js.
  const src = (document.currentScript && document.currentScript.getAttribute('src')) || '';
  const prefix = src.replace('js/hubs.js', '');

  const STATUS_LABELS = {
    active: '✅ Active',
    forming: '🟠 Forming',
    inactive: '⚪ Not yet staffed'
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function statusLabel(hub) {
    return STATUS_LABELS[hub.status] || STATUS_LABELS.active;
  }

  /** Where a hub's card and nav entry should point. */
  function hubHref(hub) {
    if (hub.externalUrl) return hub.externalUrl;
    return prefix + 'hubs/' + (hub.page || hub.slug + '.html');
  }

  function isExternal(hub) {
    return Boolean(hub.externalUrl);
  }

  let cache = null;

  /** Fetches and caches content/hubs.json. Resolves to an array of hubs. */
  function load() {
    if (cache) return cache;

    cache = fetch(prefix + 'content/hubs.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Could not load the hub registry.');
        }
        return response.json();
      })
      .then(function (data) {
        return Array.isArray(data.hubs) ? data.hubs : [];
      });

    return cache;
  }

  /* ===== Hub cards (hubs/index.html) ===== */

  function renderCard(hub) {
    const href = escapeHtml(hubHref(hub));
    const target = isExternal(hub)
      ? ' target="_blank" rel="noopener noreferrer"'
      : '';
    const linkLabel = isExternal(hub) ? 'Visit Site ↗' : 'View Hub →';

    // The second tile is optional: not every hub publishes a headcount.
    const metric = hub.metricValue
      ? `<div class="hub-info-item">
            <div class="label">${escapeHtml(hub.metricLabel || 'Volunteers')}</div>
            <div class="value">${escapeHtml(hub.metricValue)}</div>
          </div>`
      : '';

    return `<div class="hub-card">
        <h2>${escapeHtml(hub.name)}</h2>
        <p>${escapeHtml(hub.blurb)}</p>
        <div class="hub-info-grid" style="margin:0.75rem 0;">
          <div class="hub-info-item">
            <div class="label">Status</div>
            <div class="value">${escapeHtml(statusLabel(hub))}</div>
          </div>
          ${metric}
        </div>
        <a href="${href}" class="btn btn-primary"${target}>${linkLabel}</a>
      </div>`;
  }

  function renderCards() {
    const grid = document.getElementById('hubs-grid');
    if (!grid) return;

    load()
      .then(function (hubs) {
        if (!hubs.length) {
          grid.innerHTML = '<p>No hubs are listed yet. Check back soon.</p>';
          return;
        }
        grid.innerHTML = hubs.map(renderCard).join('');
      })
      .catch(function () {
        grid.innerHTML = '<p>We could not load the hub list right now. ' +
          'Please try again later, or use the <a href="' + prefix +
          'hub-finder.html">Hub Finder</a>.</p>';
      });
  }

  /* ===== Nav dropdown (injected by components.js) ===== */

  /**
   * Appends one <li> per hub to the Hubs dropdown. The "All Hubs" link is
   * already in the static markup, so a failed fetch still leaves working
   * navigation rather than an empty menu.
   */
  function populateNav() {
    const menu = document.querySelector('.dropdown-menu[data-hub-menu]');
    if (!menu) return;

    load()
      .then(function (hubs) {
        const items = hubs.map(function (hub) {
          const target = isExternal(hub)
            ? ' target="_blank" rel="noopener noreferrer"'
            : '';
          return `<li><a href="${escapeHtml(hubHref(hub))}"${target}>${escapeHtml(hub.name)}</a></li>`;
        });
        menu.insertAdjacentHTML('beforeend', items.join(''));
      })
      .catch(function () {
        // Leave the "All Hubs" fallback link in place.
      });
  }

  window.SEHHubs = { load: load, populateNav: populateNav, renderCards: renderCards };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCards);
  } else {
    renderCards();
  }

})();
