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
  const navLinks = document.querySelectorAll('.nav-list a, .nav-list button');

  navLinks.forEach(function (el) {
    const href = el.getAttribute('href') || '';
    if (!href) return;

    // Normalize paths for comparison
    const normalizedHref = href.replace(/index\.html$/, '').replace(/\/$/, '');
    const normalizedPath = currentPath.replace(/index\.html$/, '').replace(/\/$/, '');

    if (normalizedPath !== '' && normalizedPath.startsWith(normalizedHref) && normalizedHref !== '') {
      el.classList.add('active');
    }
  });

})();
