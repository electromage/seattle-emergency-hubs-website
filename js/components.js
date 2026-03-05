/**
 * Seattle Emergency Hubs – Shared Components
 * Injects the common site header and footer into every page.
 *
 * Each page includes this script with a relative src:
 *   Root pages    → src="js/components.js"
 *   Sub-dir pages → src="../js/components.js"
 *
 * The prefix ('', or '../') is derived from the script's own src attribute
 * so that all internal links resolve correctly regardless of directory depth.
 */
(function () {
  'use strict';

  // Determine the path prefix from this script's src attribute.
  const src = (document.currentScript && document.currentScript.getAttribute('src')) || '';
  const prefix = src.replace('js/components.js', '');

  /* ===== Header ===== */
  const headerHTML = `<header class="site-header" role="banner">
  <div class="header-inner">

    <div class="site-branding">
      <div class="logo-placeholder" aria-hidden="true" title="Logo coming soon">🏘️</div>
      <a href="${prefix}index.html" class="site-title">
        Seattle Emergency Hubs
        <span>Community Preparedness &amp; Mutual Aid</span>
      </a>
    </div>

    <button class="nav-toggle" id="nav-toggle"
            aria-controls="site-nav" aria-expanded="false"
            aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>

    <nav class="site-nav" id="site-nav" aria-label="Main navigation">
      <ul class="nav-list" role="list">

        <li>
          <a href="${prefix}index.html">📰 Blog</a>
        </li>

        <li>
          <a href="${prefix}calendar.html">📅 Calendar</a>
        </li>

        <li>
          <a href="${prefix}map.html">🗺️ Neighborlink Map</a>
        </li>

        <li>
          <button class="dropdown-btn" aria-haspopup="true" aria-expanded="false">
            🏘️ Hubs <span class="caret" aria-hidden="true">▾</span>
          </button>
          <ul class="dropdown-menu" role="list">
            <li><a href="${prefix}hubs/index.html">All Hubs</a></li>
            <li><a href="${prefix}hubs/beacon-hill.html">Beacon Hill Hub</a></li>
            <li><a href="${prefix}hubs/capitol-hill.html">Capitol Hill Hub</a></li>
            <li><a href="${prefix}hubs/fremont.html">Fremont Hub</a></li>
            <li><a href="${prefix}hubs/rainier-valley.html">Rainier Valley Hub</a></li>
            <li><a href="${prefix}hubs/west-seattle.html">West Seattle Hub</a></li>
          </ul>
        </li>

        <li>
          <a href="${prefix}resources.html">📚 Resources</a>
        </li>

      </ul>
    </nav>

  </div>
</header>`;

  /* ===== Footer ===== */
  const footerHTML = `<footer class="site-footer" role="contentinfo">
  <div class="footer-inner">

    <div class="footer-cta">

      <div class="footer-cta-card">
        <h3>📬 Join Our Mailing List</h3>
        <p>Stay informed about events, training opportunities, and emergency preparedness tips delivered to your inbox.</p>
        <a href="https://mailchimp.com" class="btn-footer btn-mail" target="_blank" rel="noopener noreferrer">
          Subscribe Now
        </a>
      </div>

      <div class="footer-cta-card">
        <h3>💛 Donate</h3>
        <p>Support Seattle Emergency Hubs through our fiscal sponsor, the Seattle Parks Foundation. Your gift funds training, supplies, and outreach.</p>
        <a href="https://give.seattleparksfoundation.org/campaign/755259/donate" class="btn-footer btn-donate" target="_blank" rel="noopener noreferrer">
          Donate via Seattle Parks Foundation
        </a>
      </div>

    </div><!-- /.footer-cta -->

    <div class="footer-bottom">
      <span>&copy; 2026 Seattle Emergency Hubs. All rights reserved.</span>
      <nav aria-label="Footer navigation" class="footer-links">
        <a href="${prefix}index.html">Blog</a>
        <a href="${prefix}calendar.html">Calendar</a>
        <a href="${prefix}map.html">Neighborlink Map</a>
        <a href="${prefix}hubs/index.html">Hubs</a>
        <a href="${prefix}resources.html">Resources</a>
      </nav>
    </div>

  </div>
</footer>`;

  /* ===== Inject ===== */
  const headerEl = document.getElementById('site-header-placeholder');
  if (headerEl) headerEl.outerHTML = headerHTML;

  const footerEl = document.getElementById('site-footer-placeholder');
  if (footerEl) footerEl.outerHTML = footerHTML;

})();
