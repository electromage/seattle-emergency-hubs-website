/**
 * Seattle Emergency Hubs - Theme switching
 *
 * One place to add a look: the SKINS list below, plus a matching block in
 * css/themes.css. Everything else -- the picker in the header, the saved
 * choice, the shareable link, the Google embeds -- follows from it.
 *
 * Two independent axes:
 *   data-skin   on <html>  the palette/typography ('' = the default look)
 *   data-theme  on <html>  'dark' or absent; owned by the toggle in main.js
 *
 * Both persist in localStorage, so a volunteer's choice survives clicking
 * through to the blog, the map or a hub page.
 *
 * Shareable links -- send a volunteer straight into one look:
 *   /index.html?theme=beacon
 *   /index.html?theme=sound&mode=dark
 *   /index.html?theme=            (back to the default)
 * The choice is saved, so it carries as they browse. The inline script in
 * each page's <head> reads it before first paint, so there is no flash of
 * the wrong theme.
 *
 * To hide the picker when the demo is over, set SHOW_PICKER to false.
 */
(function () {
  'use strict';

  var SHOW_PICKER = true;

  var SKIN_KEY = 'seh-skin';
  var MODE_KEY = 'seh-theme';

  /* id '' is the palette that ships in css/style.css. */
  var SKINS = [
    { id: '',        label: 'Default - Harbor Blue', note: 'The current site' },
    { id: 'rainier', label: 'Rainier - Evergreen',   note: 'Civic, serif, square corners' },
    { id: 'sound',   label: 'Sound - Teal',          note: 'Modern, soft, roomy' },
    { id: 'beacon',  label: 'Beacon - High Visibility', note: 'Signage-like, strongest contrast' }
  ];

  var root = document.documentElement;

  function read(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  function write(key, val) {
    try { if (val) localStorage.setItem(key, val); else localStorage.removeItem(key); } catch (e) {}
  }

  function currentSkin() {
    var s = root.getAttribute('data-skin') || '';
    /* Ignore a skin id we do not ship, so a stale link cannot wedge the site. */
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === s) return s;
    return '';
  }

  function applySkin(id) {
    if (id) root.setAttribute('data-skin', id);
    else root.removeAttribute('data-skin');
    write(SKIN_KEY, id);
    notify();
  }

  /* ---- let other scripts react (Google embeds, canvas, etc.) ---- */

  function notify() {
    syncCalendars();
    document.dispatchEvent(new CustomEvent('seh:themechange', {
      detail: { skin: currentSkin(), dark: root.getAttribute('data-theme') === 'dark' }
    }));
  }

  /* main.js owns the dark toggle and sets data-theme directly, so watch the
     attribute rather than wrapping its click handler. */
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].attributeName === 'data-theme') { notify(); return; }
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /** Resolve a CSS token to its computed value for the active theme. */
  function token(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback || '';
  }

  /* ---- third-party embeds ---- */

  /** getComputedStyle hands back whatever the token says; Google wants hex. */
  function toHex(v) {
    var m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!m) return v;
    return '#' + [m[1], m[2], m[3]].map(function (n) {
      return ('0' + parseInt(n, 10).toString(16)).slice(-2);
    }).join('');
  }

  /**
   * Google Calendar's embed exposes one colour: bgcolor. It has no dark mode,
   * so --embed-calendar-bg stays light in both themes on purpose (see the
   * comment on the token). Changing the src reloads the iframe, so only touch
   * it when the value actually changed.
   */
  function syncCalendars() {
    var bg = toHex(token('--embed-calendar-bg', '#ffffff'));
    var frames = document.querySelectorAll('iframe[data-theme-bgcolor]');
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      var base = f.getAttribute('data-src-base') || f.getAttribute('src');
      if (!f.getAttribute('data-src-base')) f.setAttribute('data-src-base', base);
      var next = base + (base.indexOf('?') === -1 ? '?' : '&') +
                 'bgcolor=' + encodeURIComponent(bg);
      if (f.getAttribute('src') !== next) f.setAttribute('src', next);
    }
  }

  /**
   * A Maps JS API style array built from the theme's own tokens, so the Hub
   * Finder map follows the site instead of staying bright white in dark mode.
   * Consumed by js/hub-finder.js. (The Neighborlink map on map.html is a
   * Google My Maps iframe and cannot be restyled -- only its frame follows.)
   */
  function mapStyles() {
    var bg    = toHex(token('--color-bg', '#f4f6f8'));
    var road  = toHex(token('--color-surface', '#ffffff'));
    var text  = toHex(token('--color-text', '#2c3e50'));
    var water = toHex(token('--map-water', '#c9dced'));
    var line  = toHex(token('--color-border', '#d5dbdb'));
    return [
      { elementType: 'geometry',            stylers: [{ color: bg }] },
      { elementType: 'labels.text.fill',    stylers: [{ color: text }] },
      { elementType: 'labels.text.stroke',  stylers: [{ color: bg }] },
      { featureType: 'water',               elementType: 'geometry', stylers: [{ color: water }] },
      { featureType: 'road',                elementType: 'geometry', stylers: [{ color: road }] },
      { featureType: 'road',                elementType: 'geometry.stroke', stylers: [{ color: line }] },
      { featureType: 'poi',                 elementType: 'labels', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit',             elementType: 'labels', stylers: [{ visibility: 'off' }] },
      { featureType: 'administrative',      elementType: 'geometry.stroke', stylers: [{ color: line }] }
    ];
  }

  /* ---- the picker in the site header ---- */

  function mountPicker() {
    if (!SHOW_PICKER) return;
    var header = document.querySelector('.header-inner');
    if (!header || header.querySelector('.theme-picker')) return;

    var wrap = document.createElement('div');
    wrap.className = 'theme-picker';

    var select = document.createElement('select');
    select.id = 'theme-picker';
    select.className = 'theme-picker-select';
    select.setAttribute('aria-label', 'Preview a site theme');
    select.title = 'Preview a different look and feel';

    var active = currentSkin();
    SKINS.forEach(function (skin) {
      var opt = document.createElement('option');
      opt.value = skin.id;
      opt.textContent = skin.label;
      opt.title = skin.note;
      if (skin.id === active) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', function () { applySkin(select.value); });

    wrap.appendChild(select);

    /* Sit just before the dark-mode toggle so the two controls read as a pair. */
    var toggle = header.querySelector('.theme-toggle');
    if (toggle) header.insertBefore(wrap, toggle);
    else header.appendChild(wrap);
  }

  /* components.js injects the header synchronously, but run on DOM ready too
     in case script order changes. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountPicker);
  } else {
    mountPicker();
  }

  window.SEHTheme = {
    skins: SKINS,
    get: currentSkin,
    set: applySkin,
    isDark: function () { return root.getAttribute('data-theme') === 'dark'; },
    token: token,
    mapStyles: mapStyles,
    onChange: function (fn) {
      document.addEventListener('seh:themechange', function (e) { fn(e.detail); });
    }
  };

  /* A stale or hand-edited ?theme= link can leave an id we do not ship on the
     element, where it matches no CSS but still contradicts the picker. Drop it
     so the attribute always reflects a real theme. */
  (function normalise() {
    var raw = root.getAttribute('data-skin');
    if (raw && currentSkin() === '') {
      root.removeAttribute('data-skin');
      write(SKIN_KEY, '');
    }
  })();

  notify();
})();
