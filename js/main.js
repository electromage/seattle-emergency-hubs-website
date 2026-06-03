/**
 * Seattle Emergency Hubs – Main JavaScript
 */

(function () {
  'use strict';

  /* ---- Theme toggle ---- */
  const themeToggle = document.getElementById('theme-toggle');
  const themeKey = 'seh-theme';

  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    if (themeToggle) {
      themeToggle.textContent = dark ? '☀️' : '🌙';
      themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  var isDark = false;
  try { isDark = localStorage.getItem(themeKey) === 'dark'; } catch (e) {}
  applyTheme(isDark);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      isDark = !isDark;
      try { localStorage.setItem(themeKey, isDark ? 'dark' : 'light'); } catch (e) {}
      applyTheme(isDark);
    });
  }

  /* ---- Mobile navigation toggle ---- */
  const navToggle = document.getElementById('nav-toggle');
  const siteNav = document.getElementById('site-nav');

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      siteNav.classList.toggle('open', !expanded);
    });
  }

  /* ---- Dropdown menus ---- */
  const dropdownBtns = document.querySelectorAll('.dropdown-btn');

  dropdownBtns.forEach(function (btn) {
    const menu = btn.nextElementSibling;
    if (!menu) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Close all other open dropdowns
      dropdownBtns.forEach(function (other) {
        if (other !== btn) {
          other.setAttribute('aria-expanded', 'false');
          const otherMenu = other.nextElementSibling;
          if (otherMenu) otherMenu.classList.remove('open');
        }
      });

      btn.setAttribute('aria-expanded', String(!isOpen));
      menu.classList.toggle('open', !isOpen);
    });
  });

  /* ---- Close dropdowns when clicking outside ---- */
  document.addEventListener('click', function () {
    dropdownBtns.forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.remove('open');
    });
  });

  /* ---- Close dropdowns on Escape key ---- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      dropdownBtns.forEach(function (btn) {
        btn.setAttribute('aria-expanded', 'false');
        const menu = btn.nextElementSibling;
        if (menu) menu.classList.remove('open');
      });
    }
  });

  /* ---- Mark active nav link ---- */
  const currentPath = window.location.pathname;

  function normalizePath(p) {
    return p.replace(/\/index\.html$/, '/');
  }

  const currentNorm = normalizePath(currentPath);

  // Exact-match top-level nav links (Blog, Calendar, Map, Resources, hub sub-pages)
  document.querySelectorAll('.nav-list > li > a[href]').forEach(function (link) {
    // link.href is the browser-resolved absolute URL
    const linkPath = link.href.replace(window.location.origin, '');
    if (normalizePath(linkPath) === currentNorm) {
      link.classList.add('active');
    }
  });

  // Blog post pages (/blog/...) → mark Blog nav link active
  if (currentPath.includes('/blog/')) {
    const blogLink = document.querySelector('.nav-list > li > a[href$="index.html"]');
    if (blogLink) blogLink.classList.add('active');
  }

  // Hub pages (/hubs/...) → mark Hubs dropdown button active
  if (currentPath.includes('/hubs/')) {
    const hubsBtn = document.querySelector('.nav-list .dropdown-btn');
    if (hubsBtn) hubsBtn.classList.add('active');
  }

  /* ---- Alpha warning modal ---- */
  const alphaWarningKey = 'seh-alpha-warning-dismissed';

  function createAlphaWarningModal() {
    const modal = document.createElement('div');
    modal.className = 'alpha-warning-modal';
    modal.innerHTML = `
      <div class="alpha-warning-backdrop" data-alpha-warning-close></div>
      <div class="alpha-warning-dialog" role="dialog" aria-modal="true" aria-labelledby="alpha-warning-title" aria-describedby="alpha-warning-description">
        <div class="alpha-warning-badge">Alpha Version</div>
        <h2 id="alpha-warning-title">Testing and demonstration site</h2>
        <p id="alpha-warning-description">This site is an alpha version, subject to change. Data may be incomplete, inaccurate, or out of date. It is for testing and demonstration purposes only. The main site <a href="https://seattleemergencyhubs.org" target="_blank" rel="noopener noreferrer">seattleemergencyhubs.org</a> is the only official web site.</p>
        <div class="alpha-warning-actions">
          <button type="button" class="btn btn-primary" data-alpha-warning-close>Continue to site</button>
        </div>
      </div>
    `;

    function dismissModal() {
      sessionStorage.setItem(alphaWarningKey, 'true');
      modal.remove();
      document.body.classList.remove('alpha-warning-open');
    }

    modal.addEventListener('click', function (e) {
      const closeTarget = e.target.closest('[data-alpha-warning-close]');
      if (closeTarget) {
        dismissModal();
      }
    });

    document.addEventListener('keydown', function onKeydown(e) {
      if (e.key === 'Escape' && document.body.classList.contains('alpha-warning-open')) {
        dismissModal();
        document.removeEventListener('keydown', onKeydown);
      }
    });

    document.body.appendChild(modal);
    document.body.classList.add('alpha-warning-open');
  }

  try {
    if (!sessionStorage.getItem(alphaWarningKey)) {
      createAlphaWarningModal();
    }
  } catch (err) {
    createAlphaWarningModal();
  }

  /* ---- Render blog cards from content/posts.json ---- */
  const latestPostsGrid = document.getElementById('latest-posts-grid');

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(isoDate) {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function renderPostCard(post) {
    return `
      <article class="post-card">
        <div class="post-card-body">
          <span class="post-tag">${escapeHtml(post.tag || 'Blog')}</span>
          <h2><a href="${escapeHtml(post.url)}">${escapeHtml(post.title)}</a></h2>
          <p class="post-meta">${escapeHtml(formatDate(post.date))} &middot; ${escapeHtml(post.author || 'Seattle Emergency Hubs')}</p>
          <p class="post-excerpt">${escapeHtml(post.excerpt || '')}</p>
        </div>
        <div class="post-card-footer">
          <a href="${escapeHtml(post.url)}" class="read-more">Read more →</a>
        </div>
      </article>
    `;
  }

  if (latestPostsGrid) {
    fetch('content/posts.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Could not load blog posts.');
        }
        return response.json();
      })
      .then(function (data) {
        const posts = Array.isArray(data.posts) ? data.posts.slice() : [];

        posts.sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });

        if (!posts.length) {
          latestPostsGrid.innerHTML = '<p>No posts yet. Check back soon.</p>';
          return;
        }

        latestPostsGrid.innerHTML = posts.map(renderPostCard).join('');
      })
      .catch(function () {
        latestPostsGrid.innerHTML = '<p>We could not load blog posts right now. Please try again later.</p>';
      });
  }

})();
