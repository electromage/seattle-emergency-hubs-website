/**
 * Seattle Emergency Hubs – Brand Assets
 *
 * Renders the Brand Assets page from two JSON files that non-technical
 * contributors edit through the CMS at /admin/:
 *
 *   content/brand.json   → logos, colors, fonts, usage rules
 *   content/photos.json  → member-contributed photo library
 *
 * Nothing here is hardcoded: adding a logo or a photo in the CMS is all it
 * takes for it to appear on the page.
 */
(function () {
  'use strict';

  // Path prefix derived from this script's own src, matching components.js.
  const src = (document.currentScript && document.currentScript.getAttribute('src')) || '';
  const prefix = src.replace('js/brand.js', '');

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function assetPath(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//.test(path) || path.indexOf('data:') === 0) return path;
    return prefix + path.replace(/^\.\//, '').replace(/^\//, '');
  }

  function formatDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function fileName(path) {
    return String(path || '').split('/').pop();
  }

  /* ===== Logos ===== */

  function renderLogo(logo) {
    const image = assetPath(logo.image);
    const bgClass = logo.background === 'dark' ? ' dark-bg' : '';

    const preview = image
      ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(logo.name)}" loading="lazy" decoding="async">`
      : `<span class="placeholder-text">${escapeHtml(logo.name)}<br>(file not uploaded yet)</span>`;

    const downloads = (logo.downloads || [])
      .filter(function (d) { return d && d.file; })
      .map(function (d, i) {
        const cls = i === 0 ? 'btn btn-primary' : 'btn btn-secondary';
        return `<a href="${escapeHtml(assetPath(d.file))}" class="${cls}" download>${escapeHtml(d.label || 'Download')}</a>`;
      })
      .join('');

    return `
      <div class="logo-card">
        <div class="logo-card-preview${bgClass}">${preview}</div>
        <div class="logo-card-body">
          <h3>${escapeHtml(logo.name)}</h3>
          <p>${escapeHtml(logo.description || '')}</p>
          <div class="logo-downloads">
            ${downloads || '<span class="asset-pending">Files coming soon</span>'}
          </div>
        </div>
      </div>
    `;
  }

  /* ===== Colors ===== */

  function renderColor(color) {
    const hex = String(color.hex || '').trim();
    return `
      <div class="color-swatch">
        <div class="swatch-block" style="background:${escapeHtml(hex)};"></div>
        <div class="swatch-info">
          <strong>${escapeHtml(color.name)}</strong>
          <button type="button" class="swatch-copy" data-copy="${escapeHtml(hex)}" title="Copy hex code">
            <code>${escapeHtml(hex)}</code><span class="swatch-copy-icon" aria-hidden="true">⧉</span>
            <span class="visually-hidden">Copy ${escapeHtml(hex)} to clipboard</span>
          </button>
          ${color.role ? `<span class="swatch-role">${escapeHtml(color.role)}</span>` : ''}
          ${color.note ? `<span class="swatch-note">${escapeHtml(color.note)}</span>` : ''}
        </div>
      </div>
    `;
  }

  function wireSwatchCopy(root) {
    root.addEventListener('click', function (e) {
      const btn = e.target.closest('.swatch-copy');
      if (!btn || !navigator.clipboard) return;

      navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(function () {
        btn.classList.add('copied');
        setTimeout(function () { btn.classList.remove('copied'); }, 1200);
      }).catch(function () { /* clipboard unavailable – hex is still visible */ });
    });
  }

  /* ===== Fonts ===== */

  function renderFont(font) {
    const isHeading = /head/i.test(font.role || '');
    const sampleClass = isHeading ? 'specimen-heading' : 'specimen-body';
    const source = font.sourceUrl
      ? `<p class="specimen-source"><a href="${escapeHtml(font.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(font.sourceLabel || 'Download font')} ↗</a></p>`
      : '';

    return `
      <div class="type-specimen">
        <div class="label">${escapeHtml(font.role || 'Typeface')}</div>
        <div class="${sampleClass}">${escapeHtml(font.sample || font.family)}</div>
        <div class="specimen-detail">${escapeHtml(font.family)}${font.weight ? ' — ' + escapeHtml(font.weight) : ''}</div>
        ${font.note ? `<p class="specimen-note">${escapeHtml(font.note)}</p>` : ''}
        ${source}
      </div>
    `;
  }

  /* ===== Usage rules ===== */

  function renderUsageList(items) {
    return (items || []).map(function (item) {
      return `<li>${escapeHtml(item)}</li>`;
    }).join('');
  }

  /* ===== Photo library ===== */

  var photoList = [];

  function renderPhotoCard(photo, index) {
    const image = assetPath(photo.image);
    const thumb = photo.thumbnail ? assetPath(photo.thumbnail) : image;
    const meta = [photo.location, formatDate(photo.date)].filter(Boolean).join(' · ');

    return `
      <figure class="photo-card" data-tags="${escapeHtml((photo.tags || []).join('|'))}">
        <button type="button" class="photo-card-media" data-photo-index="${index}"
                aria-label="View larger: ${escapeHtml(photo.title)}">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(photo.caption || photo.title)}" loading="lazy" decoding="async">
        </button>
        <figcaption class="photo-card-body">
          <h3>${escapeHtml(photo.title)}</h3>
          ${meta ? `<p class="photo-meta">${escapeHtml(meta)}</p>` : ''}
          <p class="photo-credit">Photo: ${escapeHtml(photo.credit || 'Seattle Emergency Hubs')}</p>
          <a href="${escapeHtml(image)}" class="btn btn-secondary photo-download" download>Download</a>
        </figcaption>
      </figure>
    `;
  }

  function renderPhotoFilters(photos, container) {
    const tags = [];
    photos.forEach(function (p) {
      (p.tags || []).forEach(function (t) {
        if (t && tags.indexOf(t) === -1) tags.push(t);
      });
    });

    if (!tags.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = ['All'].concat(tags.sort()).map(function (tag, i) {
      const value = i === 0 ? '' : tag;
      return `<button type="button" class="photo-filter${i === 0 ? ' active' : ''}" data-tag="${escapeHtml(value)}" aria-pressed="${i === 0}">${escapeHtml(tag)}</button>`;
    }).join('');

    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.photo-filter');
      if (!btn) return;

      const tag = btn.getAttribute('data-tag');

      container.querySelectorAll('.photo-filter').forEach(function (b) {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });

      document.querySelectorAll('.photo-card').forEach(function (card) {
        const cardTags = (card.getAttribute('data-tags') || '').split('|');
        card.hidden = Boolean(tag) && cardTags.indexOf(tag) === -1;
      });
    });
  }

  /* ===== Lightbox ===== */

  var lightbox = null;
  var lightboxIndex = 0;
  var lastFocused = null;

  function buildLightbox() {
    const el = document.createElement('div');
    el.className = 'photo-lightbox';
    el.hidden = true;
    el.innerHTML = `
      <div class="photo-lightbox-backdrop" data-lightbox-close></div>
      <div class="photo-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Photo viewer">
        <button type="button" class="photo-lightbox-close" data-lightbox-close aria-label="Close photo viewer">×</button>
        <button type="button" class="photo-lightbox-nav prev" data-lightbox-step="-1" aria-label="Previous photo">‹</button>
        <img class="photo-lightbox-image" src="" alt="">
        <button type="button" class="photo-lightbox-nav next" data-lightbox-step="1" aria-label="Next photo">›</button>
        <div class="photo-lightbox-info">
          <h3 class="photo-lightbox-title"></h3>
          <p class="photo-lightbox-caption"></p>
          <p class="photo-lightbox-credit"></p>
          <p class="photo-lightbox-usage"></p>
          <a class="btn btn-primary photo-lightbox-download" href="" download>Download full size</a>
        </div>
      </div>
    `;

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-lightbox-close]')) {
        closeLightbox();
        return;
      }
      const stepBtn = e.target.closest('[data-lightbox-step]');
      if (stepBtn) stepLightbox(Number(stepBtn.getAttribute('data-lightbox-step')));
    });

    document.body.appendChild(el);
    return el;
  }

  function showLightbox(index) {
    if (!photoList.length) return;
    if (!lightbox) lightbox = buildLightbox();

    lightboxIndex = (index + photoList.length) % photoList.length;
    const photo = photoList[lightboxIndex];
    const image = assetPath(photo.image);

    lightbox.querySelector('.photo-lightbox-image').src = image;
    lightbox.querySelector('.photo-lightbox-image').alt = photo.caption || photo.title || '';
    lightbox.querySelector('.photo-lightbox-title').textContent = photo.title || '';
    lightbox.querySelector('.photo-lightbox-caption').textContent = photo.caption || '';
    lightbox.querySelector('.photo-lightbox-credit').textContent = 'Photo: ' + (photo.credit || 'Seattle Emergency Hubs');
    lightbox.querySelector('.photo-lightbox-usage').textContent = photo.usage || '';

    const dl = lightbox.querySelector('.photo-lightbox-download');
    dl.href = image;
    dl.setAttribute('download', fileName(photo.image));

    const multiple = photoList.length > 1;
    lightbox.querySelectorAll('.photo-lightbox-nav').forEach(function (b) { b.hidden = !multiple; });

    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
    lightbox.querySelector('.photo-lightbox-close').focus();
  }

  function stepLightbox(delta) {
    showLightbox(lightboxIndex + delta);
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
    if (lastFocused) lastFocused.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (!lightbox || lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') stepLightbox(-1);
    else if (e.key === 'ArrowRight') stepLightbox(1);
  });

  /* ===== Load & render ===== */

  function loadJson(path) {
    return fetch(assetPath(path)).then(function (res) {
      if (!res.ok) throw new Error('Could not load ' + path);
      return res.json();
    });
  }

  function renderBrand() {
    const logoGrid = document.getElementById('logo-grid');
    const colorGrid = document.getElementById('color-grid');
    const fontList = document.getElementById('font-list');
    const introEl = document.getElementById('brand-intro-text');
    const doList = document.getElementById('usage-do-list');
    const dontList = document.getElementById('usage-dont-list');
    const contactEl = document.getElementById('brand-contact');

    if (!logoGrid && !colorGrid && !fontList) return;

    loadJson('content/brand.json').then(function (data) {
      if (introEl && data.intro) introEl.textContent = data.intro;

      if (contactEl && data.contactEmail) {
        contactEl.innerHTML = `Questions or requests not covered here? Email us at <a href="mailto:${escapeHtml(data.contactEmail)}">${escapeHtml(data.contactEmail)}</a>.`;
      }

      if (logoGrid) {
        logoGrid.innerHTML = (data.logos || []).map(renderLogo).join('') ||
          '<p>No logo files have been published yet.</p>';
      }

      if (colorGrid) {
        colorGrid.innerHTML = (data.colors || []).map(renderColor).join('');
        wireSwatchCopy(colorGrid);
      }

      if (fontList) {
        fontList.innerHTML = (data.fonts || []).map(renderFont).join('');
      }

      if (doList) doList.innerHTML = renderUsageList(data.usageDo);
      if (dontList) dontList.innerHTML = renderUsageList(data.usageDont);
    }).catch(function () {
      if (logoGrid) logoGrid.innerHTML = '<p>We could not load the brand assets right now. Please try again later.</p>';
    });
  }

  function renderPhotos() {
    const grid = document.getElementById('photo-grid');
    if (!grid) return;

    const filters = document.getElementById('photo-filters');
    const introEl = document.getElementById('photo-intro-text');

    loadJson('content/photos.json').then(function (data) {
      photoList = Array.isArray(data.photos) ? data.photos.filter(function (p) { return p && p.image; }) : [];

      if (introEl && data.intro) introEl.textContent = data.intro;

      if (!photoList.length) {
        grid.innerHTML = '<p>No member photos have been published yet.</p>';
        if (filters) filters.innerHTML = '';
        return;
      }

      grid.innerHTML = photoList.map(renderPhotoCard).join('');
      if (filters) renderPhotoFilters(photoList, filters);

      grid.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-photo-index]');
        if (!btn) return;
        lastFocused = btn;
        showLightbox(Number(btn.getAttribute('data-photo-index')));
      });
    }).catch(function () {
      grid.innerHTML = '<p>We could not load the photo library right now. Please try again later.</p>';
    });
  }

  renderBrand();
  renderPhotos();

})();
