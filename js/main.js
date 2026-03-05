/**
 * Seattle Emergency Hubs – Main JavaScript
 */

(function () {
  'use strict';

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
