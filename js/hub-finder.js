(function () {
  'use strict';

  // ── Singleton Maps API loader ─────────────────────────────────────────────
  // Only one script tag is injected even if multiple <hub-finder> elements exist.
  let _mapsPromise = null;
  function _loadMapsAPI(apiKey) {
    if (!apiKey) {
      return Promise.reject(new Error('Google Maps API key is missing.'));
    }
    if (_mapsPromise) return _mapsPromise;
    if (window.google?.maps?.Map) return (_mapsPromise = Promise.resolve());
    _mapsPromise = new Promise((resolve, reject) => {
      const cb = '__hubFinderMapsReady';
      window[cb] = () => { delete window[cb]; resolve(); };
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) +
              '&libraries=places&callback=' + cb;
      s.onerror = () => {
        delete window[cb];
        reject(new Error('Failed to load Google Maps API script.'));
      };
      s.async = true;
      document.head.appendChild(s);
    });
    return _mapsPromise;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const STYLES = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --navy:   var(--color-primary, #2e86c1);
      --blue:   var(--color-primary, #2e86c1);
      --red:    #c0392b;
      --bg:     var(--color-bg, #f4f6f8);
      --white:  var(--color-surface, #ffffff);
      --text:   var(--color-text, #2c3e50);
      --muted:  var(--color-muted, #5d6d7e);
      --border: var(--color-border, #d5dbdb);
      --green:  var(--color-secondary, #1e8449);
      --amber:  var(--color-accent, #ff4d00);
      display: block;
      font-family: 'Noto Sans', system-ui, -apple-system, sans-serif;
      color: var(--text);
    }

    .wrapper { display: block; }

    main {
      margin: 0;
      padding: 0;
      width: 100%;
    }

    .card {
      background: var(--white);
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
    }

    .search-label {
      display: block;
      font-weight: 600;
      font-size: 0.95rem;
      margin-bottom: 0.6rem;
    }
    .search-row { display: flex; gap: 0.6rem; }
    .search-row input {
      flex: 1;
      padding: 0.7rem 1rem;
      border: 2px solid var(--border);
      border-radius: 7px;
      font-size: 1rem;
      color: var(--text);
      transition: border-color 0.15s;
    }
    .search-row input:focus { outline: none; border-color: var(--blue); }
    .search-row button {
      padding: 0.7rem 1.4rem;
      background: var(--navy);
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .search-row button:hover   { background: var(--blue); }
    .search-row button:active  { background: var(--navy); }
    .search-row button:disabled { background: var(--muted); cursor: not-allowed; }
    .btn-geo {
      background: transparent;
      color: var(--navy);
      border: 2px solid var(--navy);
      padding: 0.6rem 1rem;
    }
    .btn-geo:hover   { background: var(--navy) !important; color: #fff; }
    .btn-geo:active  { background: var(--navy) !important; }
    .btn-geo:disabled { border-color: var(--muted); color: var(--muted); background: transparent !important; cursor: not-allowed; }
    .geo-note {
      margin-top: 0.55rem;
      font-size: 0.8rem;
      color: var(--amber);
      font-style: italic;
    }
    .map-hint { margin-top: 0.45rem; font-size: 0.78rem; color: var(--muted); text-align: center; }

    .loading-card { display: flex; align-items: center; gap: 0.9rem; color: var(--muted); }
    .spinner {
      width: 22px; height: 22px; flex-shrink: 0;
      border: 3px solid var(--border);
      border-top-color: var(--blue);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-card { border-left: 4px solid var(--red); color: var(--red); font-weight: 500; }

    .map-card { padding: 0.6rem; }
    #map { width: 100%; height: 420px; border-radius: 7px; background: #dde4ec; }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.1rem;
    }

    .info-card { padding: 1.1rem 1.25rem; }
    .card-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--muted);
      margin-bottom: 0.6rem;
    }

    .hub-type-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.18rem 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    .hub-type-badge.hub       { background: #d4edda; color: var(--green); }
    .hub-type-badge.gathering { background: #e8edf2; color: var(--muted); }

    .inactive-toggle {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .inactive-toggle input { cursor: pointer; }

    .hub-list-item {
      padding: 0.55rem 0.65rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      margin-bottom: 0.5rem;
      cursor: pointer;
      transition: background 0.1s;
    }
    .hub-list-item:hover { background: rgba(0,0,0,0.03); }
    .hub-list-item:last-child { margin-bottom: 0; }
    .hub-list-item.active {
      border-color: var(--red);
      background: rgba(192,57,43,0.04);
    }
    .hub-list-item.active:hover { background: rgba(192,57,43,0.07); }
    .hub-list-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.4rem;
      margin-bottom: 0.2rem;
    }
    .hub-list-name {
      font-weight: 600;
      font-size: 0.88rem;
      color: var(--navy);
      line-height: 1.3;
    }
    .hub-list-dist { font-size: 0.78rem; color: var(--muted); white-space: nowrap; flex-shrink: 0; }
    .hub-list-addr { font-size: 0.78rem; color: var(--muted); }

    .captain-name { font-size: 1rem; font-weight: 600; margin-bottom: 0.65rem; line-height: 1.35; }
    .contact-list { display: flex; flex-direction: column; gap: 0.55rem; }
    .contact-item { display: flex; flex-direction: column; gap: 0.1rem; }
    .contact-item-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .contact-item a {
      color: var(--blue);
      text-decoration: none;
      font-size: 0.88rem;
      word-break: break-all;
    }
    .contact-item a:hover { text-decoration: underline; }

    .resource-section { margin-bottom: 1rem; }
    .resource-section:last-child { margin-bottom: 0; }
    .resource-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin-bottom: 0.3rem;
    }
    .resource-value  { font-size: 0.9rem; font-weight: 600; }
    .resource-note   { font-size: 0.85rem; color: var(--muted); font-style: italic; }

    .gmrs-section-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--muted);
      margin-bottom: 0.9rem;
    }
    .gmrs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    .gmrs-card {
      border-radius: 8px;
      border: 1px solid var(--border);
      border-left: 4px solid var(--border);
      padding: 0.8rem 0.9rem 0.7rem;
      background: var(--bg);
    }
    .gmrs-card.clear               { border-left-color: var(--green); }
    .gmrs-card.possibly-obstructed { border-left-color: #e6a817; }
    .gmrs-card.likely-obstructed   { border-left-color: var(--red); }
    .gmrs-card-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.25rem;
    }
    .gmrs-friendly-name { font-weight: 700; font-size: 0.9rem; color: var(--navy); }
    .gmrs-status {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
    }
    .gmrs-status.clear               { background: #d4edda; color: var(--green); }
    .gmrs-status.possibly-obstructed { background: #fef3cd; color: #856404; }
    .gmrs-status.likely-obstructed   { background: #fde8e8; color: var(--red); }
    .gmrs-status.pending    { background: #e8edf2; color: var(--muted); }
    .gmrs-meta { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.55rem; }
    .gmrs-profile { border-radius: 4px; overflow: hidden; line-height: 0; }
    .gmrs-pending-msg {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.8rem;
      color: var(--muted);
      padding: 0.6rem 0 0.3rem;
    }

    .hidden { display: none !important; }

    @media (max-width: 720px) {
      .info-grid  { grid-template-columns: 1fr; }
      .gmrs-grid  { grid-template-columns: 1fr; }
      #map        { height: 300px; }
      .search-row { flex-direction: column; }
    }

    .tool-meta {
      margin: 0.6rem 0 0;
      color: var(--muted);
      font-size: 0.82rem;
    }
    .tool-meta a {
      color: var(--blue);
      text-decoration: none;
    }
    .tool-meta a:hover { text-decoration: underline; }

    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal {
      background: var(--white);
      border-radius: 10px;
      max-width: 520px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 1.75rem 1.75rem 1.5rem;
      position: relative;
    }
    .modal h2 { font-size: 1.15rem; font-weight: 700; color: var(--navy); margin-bottom: 1rem; }
    .modal h3 {
      font-size: 0.8rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--muted); margin: 1rem 0 0.3rem;
    }
    .modal p { font-size: 0.9rem; line-height: 1.6; color: var(--text); }
    .modal a { color: var(--blue); }
    .modal-close {
      position: absolute; top: 1rem; right: 1rem;
      background: none; border: none; cursor: pointer;
      font-size: 1.4rem; line-height: 1; color: var(--muted);
      padding: 0.2rem 0.4rem; border-radius: 4px;
    }
    .modal-close:hover { color: var(--text); background: var(--bg); }
  `;

  // ── HTML template ─────────────────────────────────────────────────────────
  const TEMPLATE = `
    <div class="wrapper">
      <main>
        <div class="card">
          <label class="search-label" for="address-input">Your address</label>
          <div class="search-row">
            <input id="address-input" type="text"
                   placeholder="123 Main St, Seattle, WA"
                   autocomplete="off" autocorrect="off" spellcheck="false">
            <button id="search-btn">Find My Hub</button>
            <button id="geo-btn" class="btn-geo" title="Use my current location">Locate Me</button>
          </div>
          <p id="geo-note" class="geo-note hidden">GPS location may not be exact &mdash; please verify your address above before relying on these results.</p>
        </div>

        <div id="loading" class="card loading-card hidden">
          <div class="spinner"></div>
          <span>Finding your nearest hub&hellip;</span>
        </div>

        <div id="error-section" class="card error-card hidden">
          <span id="error-msg"></span>
        </div>

        <div id="results" class="hidden">

          <div class="card map-card">
            <div id="map"></div>
            <p class="map-hint">Click anywhere on the map to search that location</p>
          </div>

          <div class="info-grid">
            <div class="card info-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">
                <div class="card-label" style="margin-bottom:0">Nearby Hubs</div>
                <label class="inactive-toggle">
                  <input type="checkbox" id="show-inactive" checked>
                  <span>Show Inactive</span>
                </label>
              </div>
              <div id="hub-list"></div>
            </div>
            <div class="card info-card">
              <div class="card-label">Hub Captain</div>
              <div id="captain-name" class="captain-name"></div>
              <div class="contact-list" id="contact-list"></div>
            </div>
            <div class="card info-card">
              <div class="card-label">Emergency Resources</div>
              <div class="resource-section">
                <div class="resource-label">ACS Sector</div>
                <div id="acs-sector" class="resource-value"></div>
              </div>
            </div>
          </div>

          <div id="gmrs-section" class="card hidden">
            <div class="gmrs-section-label">GMRS Repeaters &mdash; RF Path Analysis</div>
            <p id="gmrs-no-data" class="resource-note hidden">No GMRS repeaters configured yet.</p>
            <div id="gmrs-grid" class="gmrs-grid"></div>
          </div>

          <p class="tool-meta">
            <a href="#" id="privacy-link">Privacy notice</a>
            &middot;
            <a href="https://gitlab.com/seattle-emergency-hubs/seattlehubslookuptool" target="_blank" rel="noopener">Hub Finder source</a>
          </p>

        </div>
      </main>

      <div id="privacy-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
        <div class="modal">
          <button class="modal-close" id="privacy-close" aria-label="Close">&times;</button>
          <h2 id="privacy-title">Privacy Notice</h2>
          <h3>What this tool does</h3>
          <p>This tool helps you find the nearest Seattle Emergency Hub to any address or map location. No account or sign-in is required.</p>
          <h3>Data we do not collect</h3>
          <p>This server does not log, store, or share the addresses or coordinates you enter. No cookies, analytics, or tracking scripts are used.</p>
          <h3>Google Maps</h3>
          <p>Address lookups, autocomplete suggestions, map display, and reverse-geocoding are handled by the <a href="https://developers.google.com/maps" target="_blank" rel="noopener">Google Maps Platform</a>, subject to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>. Google may receive the addresses or coordinates you search in order to return results.</p>
          <h3>Location data</h3>
          <p>If you use the "Locate Me" button, your browser will ask for permission before sharing your device location. Your coordinates are sent only to Google's Geocoding API to produce a readable address label; they are not stored by this server.</p>
          <h3>Hub contact information</h3>
          <p>Hub names, addresses, and captain contact details are loaded from a publicly maintained KML file hosted by Seattle Emergency Hubs Network. Questions about that data should be directed to <a href="https://seattleemergencyhubs.org" target="_blank" rel="noopener">seattleemergencyhubs.org</a>.</p>
          <h3>Open source</h3>
          <p>The source code for this tool is publicly available at <a href="https://gitlab.com/seattle-emergency-hubs/seattlehubslookuptool" target="_blank" rel="noopener">GitLab</a>.</p>
        </div>
      </div>
    </div>
  `;

  // ── Web Component ─────────────────────────────────────────────────────────
  class HubFinder extends HTMLElement {
    constructor() {
      super();
      this._root = this.attachShadow({ mode: 'open' });
      this._map             = null;
      this._autocomplete    = null;
      this._hubs            = null;
      this._gmrsData        = null;
      this._activeMarkers   = [];
      this._activeLine      = null;
      this._lastUserLat     = 0;
      this._lastUserLng     = 0;
      this._shownHubs       = [];
      this._hubMarkers      = [];
      this._showInactive    = true;
    }

    connectedCallback() {
      this._root.innerHTML = '<style>' + STYLES + '</style>' + TEMPLATE;
      const apiKey = this._resolveApiKey();
      _loadMapsAPI(apiKey)
        .then(() => this._init())
        .catch(err => this._showFatalError(err.message));
    }

    // Scoped element lookup
    $(id) { return this._root.getElementById(id); }

    _resolveApiKey() {
      const attrKey = this.getAttribute('api-key');
      if (attrKey && !attrKey.includes('{{')) return attrKey;

      const globalKey = window.GOOGLE_MAPS_API_KEY || window.SEH_GOOGLE_MAPS_API_KEY;
      if (typeof globalKey === 'string' && globalKey.trim()) return globalKey.trim();

      const metaName = this.getAttribute('key-meta') || 'seh-google-maps-api-key';
      const meta = document.querySelector('meta[name="' + metaName + '"]');
      const metaKey = meta ? meta.getAttribute('content') : '';
      if (metaKey && !metaKey.includes('{{')) return metaKey;

      return '';
    }

    _showFatalError(message) {
      this.$('error-msg').textContent = message + ' Configure this page with a valid key, then reload.';
      this.$('error-section').classList.remove('hidden');
      this.$('loading').classList.add('hidden');
      this.$('search-btn').disabled = true;
      this.$('geo-btn').disabled = true;
    }

    _init() {
      const kmlUrl  = this.getAttribute('kml-url')  || '/data/hubs.kml';
      const gmrsUrl = this.getAttribute('gmrs-url') || '/data/gmrs_repeaters.json';

      this._map = new google.maps.Map(this.$('map'), {
        center: { lat: 47.606, lng: -122.332 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      this._map.addListener('click', e => {
        const lat = e.latLng.lat(), lng = e.latLng.lng();
        this._setLoading(true);
        this._hideError();
        new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
          this._setLoading(false);
          const label = (status === 'OK' && results[0]) ? results[0].formatted_address : 'Selected location';
          this.$('address-input').value = label;
          this.$('geo-note').classList.add('hidden');
          this._processSearch(lat, lng, label);
        });
      });

      this._autocomplete = new google.maps.places.Autocomplete(
        this.$('address-input'),
        {
          componentRestrictions: { country: 'us' },
          fields: ['geometry', 'formatted_address'],
          bounds: new google.maps.LatLngBounds(
            { lat: 47.48, lng: -122.46 },
            { lat: 47.74, lng: -122.22 }
          ),
          strictBounds: false,
        }
      );

      this._autocomplete.addListener('place_changed', () => {
        const place = this._autocomplete.getPlace();
        if (place.geometry?.location) {
          this._processSearch(
            place.geometry.location.lat(),
            place.geometry.location.lng(),
            place.formatted_address || this.$('address-input').value
          );
        }
      });

      this.$('search-btn').addEventListener('click',  () => this._handleSearch());
      this.$('address-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') this._handleSearch();
      });

      const geoBtn = this.$('geo-btn');
      if (!navigator.geolocation) {
        geoBtn.classList.add('hidden');
      } else {
        geoBtn.addEventListener('click', () => {
          this._setLoading(true);
          this._hideError();
          geoBtn.disabled = true;
          navigator.geolocation.getCurrentPosition(
            pos => {
              this._setLoading(false);
              geoBtn.disabled = false;
              const { latitude: lat, longitude: lng } = pos.coords;
              new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
                const label = (status === 'OK' && results[0]) ? results[0].formatted_address : 'Your location';
                this.$('address-input').value = label;
                this.$('geo-note').classList.remove('hidden');
                this._processSearch(lat, lng, label);
              });
            },
            () => {
              this._setLoading(false);
              geoBtn.disabled = false;
              this._showError('Location access was denied or is unavailable on this device.');
            },
            { timeout: 10000 }
          );
        });
      }

      this.$('show-inactive').addEventListener('change', e => {
        this._showInactive = e.target.checked;
        if (this._shownHubs.length) {
          const addr = this.$('address-input').value;
          const { shown, active } = this._getHubsToShow(this._lastUserLat, this._lastUserLng);
          this._shownHubs = shown;
          this._renderMap(this._lastUserLat, this._lastUserLng, addr, shown, active);
          this._renderPanel(shown, active);
        }
      });

      const privacyModal = this.$('privacy-modal');
      this.$('privacy-link').addEventListener('click', e => {
        e.preventDefault();
        privacyModal.classList.remove('hidden');
      });
      this.$('privacy-close').addEventListener('click', () => privacyModal.classList.add('hidden'));
      privacyModal.addEventListener('click', e => {
        if (e.target === privacyModal) privacyModal.classList.add('hidden');
      });
      this._root.addEventListener('keydown', e => {
        if (e.key === 'Escape') privacyModal.classList.add('hidden');
      });

      this._loadData(kmlUrl, gmrsUrl);
    }

    async _loadData(kmlUrl, gmrsUrl) {
      try {
        const [kmlText, gmrsJson] = await Promise.all([
          fetch(kmlUrl).then(r => r.text()),
          fetch(gmrsUrl).then(r => r.json()),
        ]);
        this._hubs    = this._parseKML(kmlText);
        this._gmrsData = gmrsJson;
      } catch (e) {
        console.error('hub-finder: failed to load data', e);
      }
    }

    _parseKML(kmlText) {
      const parser = new DOMParser();
      const kml    = parser.parseFromString(kmlText, 'text/xml');
      const result = [];

      for (const folder of kml.getElementsByTagName('Folder')) {
        let folderName = '';
        for (const node of folder.childNodes) {
          if (node.localName === 'name') { folderName = node.textContent.trim(); break; }
        }
        if (!/Sector Hubs/i.test(folderName)) continue;

        const sector = folderName.replace(/\s*Sector\s*Hubs/i, '').trim();

        for (const pm of folder.getElementsByTagName('Placemark')) {
          if (!pm.getElementsByTagName('Point').length) continue;
          const coordEl = pm.getElementsByTagName('coordinates')[0];
          if (!coordEl) continue;
          const [lng, lat] = coordEl.textContent.trim().split(',').map(Number);
          if (isNaN(lat) || isNaN(lng)) continue;

          let name = '';
          for (const node of pm.childNodes) {
            if (node.localName === 'name') { name = node.textContent.trim(); break; }
          }

          const ext = {};
          for (const dataEl of pm.getElementsByTagName('Data')) {
            const key = dataEl.getAttribute('name');
            const val = dataEl.getElementsByTagName('value')[0]?.textContent?.trim() || '';
            ext[key] = val;
          }

          const captain  = ext['Hub Captain'] || '';
          const descText = ext['description']  || '';
          const type = (captain === 'Seattle Hubs Network' ||
                        descText.toLowerCase().includes('does not have an active volunteer'))
                       ? 'gathering' : 'hub';

          result.push({
            name, lat, lng, sector,
            address: ext['Hub Location'] || '',
            captain,
            email:   ext['Email']   || '',
            phone:   ext['Phone']   || '',
            website: ext['Website'] || '',
            type,
          });
        }
      }
      return result;
    }

    _distanceMiles(lat1, lng1, lat2, lng2) {
      const R = 3958.8;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2
              + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
              * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    _getHubsToShow(lat, lng) {
      const pool   = this._showInactive ? this._hubs : this._hubs.filter(h => h.type === 'hub');
      const ranked = [...pool]
        .map(h => ({ hub: h, dist: this._distanceMiles(lat, lng, h.lat, h.lng) }))
        .sort((a, b) => a.dist - b.dist);

      const top3         = ranked.slice(0, 3);
      const nearestActive = ranked.find(x => x.hub.type === 'hub');

      if (!nearestActive || top3.some(x => x.hub === nearestActive.hub)) {
        return { shown: top3, active: nearestActive ?? top3[0] };
      }
      return { shown: [top3[0], top3[1], nearestActive], active: nearestActive };
    }

    _handleSearch() {
      const address = this.$('address-input').value.trim();
      if (!address) return;
      this._setLoading(true);
      this._hideError();
      this.$('geo-note').classList.add('hidden');
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address, componentRestrictions: { country: 'US' } },
        (results, status) => {
          this._setLoading(false);
          if (status === 'OK') {
            const loc = results[0].geometry.location;
            this._processSearch(loc.lat(), loc.lng(), results[0].formatted_address);
          } else {
            this._showError('Address not found. Please try a more specific address.');
          }
        }
      );
    }

    _processSearch(userLat, userLng, formattedAddress) {
      if (!this._hubs) {
        this._showError('Hub data not loaded. Please refresh the page.');
        return;
      }
      this._lastUserLat = userLat;
      this._lastUserLng = userLng;
      const { shown, active } = this._getHubsToShow(userLat, userLng);
      this._shownHubs = shown;

      this._renderMap(userLat, userLng, formattedAddress, shown, active);
      this._renderPanel(shown, active);

      this._hideError();
      this.$('results').classList.remove('hidden');
      this.$('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

      this._renderGMRS(userLat, userLng);
    }

    _hubIcon(isSelected) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: isSelected ? 13 : 8,
        fillColor: isSelected ? '#c0392b' : '#6b7a8d',
        fillOpacity: isSelected ? 1 : 0.8,
        strokeColor: '#ffffff',
        strokeWeight: isSelected ? 2 : 1.5,
      };
    }

    _renderMap(userLat, userLng, address, shown, active) {
      this._activeMarkers.forEach(m => m.setMap(null));
      this._activeMarkers = [];
      this._hubMarkers    = [];
      if (this._activeLine) { this._activeLine.setMap(null); this._activeLine = null; }

      this._activeMarkers.push(new google.maps.Marker({
        position: { lat: userLat, lng: userLng },
        map: this._map,
        title: address,
        zIndex: 4,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#2563a8',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      }));

      shown.forEach(({ hub }) => {
        const isSelected = hub === active.hub;
        const marker = new google.maps.Marker({
          position: { lat: hub.lat, lng: hub.lng },
          map: this._map,
          title: hub.name,
          zIndex: isSelected ? 3 : 2,
          icon: this._hubIcon(isSelected),
        });
        this._activeMarkers.push(marker);
        this._hubMarkers.push({ hub, marker });
      });

      this._activeLine = new google.maps.Polyline({
        path: [{ lat: userLat, lng: userLng }, { lat: active.hub.lat, lng: active.hub.lng }],
        strokeOpacity: 0,
        icons: [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.85, strokeColor: '#c0392b', scale: 3 },
          offset: '0',
          repeat: '14px',
        }],
        map: this._map,
      });

      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: userLat, lng: userLng });
      shown.forEach(({ hub }) => bounds.extend({ lat: hub.lat, lng: hub.lng }));
      this._map.fitBounds(bounds, 80);
    }

    _renderPanel(shown, active) {
      const listEl = this.$('hub-list');
      listEl.innerHTML = '';
      shown.forEach(({ hub, dist }) => {
        const isActive   = hub === active.hub;
        const item       = document.createElement('div');
        item.className   = 'hub-list-item' + (isActive ? ' active' : '');
        const badgeClass = hub.type === 'hub' ? 'hub' : 'gathering';
        const badgeText  = hub.type === 'hub' ? 'Active Hub' : 'Inactive Hub';
        item.innerHTML = `
          <div class="hub-list-row">
            <span class="hub-list-name">${hub.name}</span>
            <span class="hub-list-dist">${dist.toFixed(1)} mi</span>
          </div>
          <div class="hub-list-row" style="margin-bottom:0.15rem">
            <span class="hub-type-badge ${badgeClass}">${badgeText}</span>
          </div>
          ${hub.address ? `<div class="hub-list-addr">${hub.address}</div>` : ''}`;
        item.addEventListener('click', () => this._selectHub({ hub, dist }));
        listEl.appendChild(item);
      });

      this._updateContactPanel(active.hub);
    }

    _selectHub(entry) {
      const { hub } = entry;

      this._hubMarkers.forEach(({ hub: h, marker }) => {
        const sel = h === hub;
        marker.setIcon(this._hubIcon(sel));
        marker.setZIndex(sel ? 3 : 2);
      });

      this._activeLine.setPath([
        { lat: this._lastUserLat, lng: this._lastUserLng },
        { lat: hub.lat,           lng: hub.lng },
      ]);

      this._updateContactPanel(hub);

      this._root.querySelectorAll('.hub-list-item').forEach((el, i) => {
        el.classList.toggle('active', this._shownHubs[i]?.hub === hub);
      });
    }

    _updateContactPanel(hub) {
      this.$('captain-name').textContent = hub.captain || 'No captain listed';
      const contactList = this.$('contact-list');
      contactList.innerHTML = '';
      if (hub.email)   contactList.appendChild(this._makeContact('Email',   'mailto:' + hub.email, hub.email));
      if (hub.phone)   contactList.appendChild(this._makeContact('Phone',   'tel:' + hub.phone.replace(/\D/g, ''), hub.phone));
      if (hub.website) {
        const url = hub.website.startsWith('http') ? hub.website : 'https://' + hub.website;
        contactList.appendChild(this._makeContact('Website', url, hub.website, true));
      }
      this.$('acs-sector').textContent = hub.sector ? hub.sector + ' ACS Sector' : 'Sector not listed';
    }

    _makeContact(label, href, text, external) {
      const wrap = document.createElement('div');
      wrap.className = 'contact-item';
      const lbl = document.createElement('span');
      lbl.className = 'contact-item-label';
      lbl.textContent = label;
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      if (external) { a.target = '_blank'; a.rel = 'noopener'; }
      wrap.appendChild(lbl);
      wrap.appendChild(a);
      return wrap;
    }

    _setLoading(on) {
      this.$('loading').classList.toggle('hidden', !on);
      this.$('search-btn').disabled = on;
    }

    _showError(msg) {
      this.$('error-msg').textContent = msg;
      this.$('error-section').classList.remove('hidden');
    }

    _hideError() { this.$('error-section').classList.add('hidden'); }

    // ── GMRS RF path analysis ──────────────────────────────────────────────

    async _renderGMRS(userLat, userLng) {
      const section = this.$('gmrs-section');
      const grid    = this.$('gmrs-grid');
      const noData  = this.$('gmrs-no-data');

      grid.innerHTML = '';
      noData.classList.add('hidden');
      section.classList.remove('hidden');

      const repeaters = this._gmrsData?.repeaters ?? [];
      if (!repeaters.length) { noData.classList.remove('hidden'); return; }

      const nearest5 = [...repeaters]
        .map(r => ({ r, d: this._distanceMiles(userLat, userLng, r.lat, r.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 5)
        .map(x => x.r);

      const cards = nearest5.map(rep => {
        const card = document.createElement('div');
        card.className = 'gmrs-card';
        card.innerHTML = `
          <div class="gmrs-card-header">
            <span class="gmrs-friendly-name">${rep.friendly_name}</span>
            <span class="gmrs-status pending">Analyzing&hellip;</span>
          </div>
          <div class="gmrs-meta">
            Ch&nbsp;${rep.channel_slot} &middot; ${rep.channel_name} &middot; PL&nbsp;${rep.tone}
          </div>
          <div class="gmrs-profile">
            <div class="gmrs-pending-msg">
              <div class="spinner" style="width:14px;height:14px;border-width:2px"></div>
              Computing RF path&hellip;
            </div>
          </div>`;
        grid.appendChild(card);
        return card;
      });

      const results = await Promise.allSettled(
        nearest5.map(rep => this._analyzeRepeaterPath(userLat, userLng, rep))
      );

      results.forEach((result, i) => {
        const card = cards[i];
        const rep  = nearest5[i];
        if (result.status === 'rejected') {
          card.querySelector('.gmrs-status').textContent = 'Error';
          card.querySelector('.gmrs-profile').innerHTML =
            '<p class="resource-note" style="padding:0.4rem 0">RF analysis unavailable.</p>';
          return;
        }
        const a   = result.value;
        const statusLabel = { clear: 'Clear', 'possibly-obstructed': 'Needs Testing', 'likely-obstructed': 'Likely Obstructed' };
        card.className = 'gmrs-card ' + a.status;
        card.querySelector('.gmrs-card-header').innerHTML = `
          <span class="gmrs-friendly-name">${rep.friendly_name}</span>
          <span class="gmrs-status ${a.status}">${statusLabel[a.status]}</span>`;
        card.querySelector('.gmrs-meta').textContent =
          'Ch ' + rep.channel_slot + ' · ' + rep.channel_name + ' · PL ' + rep.tone + ' · ' + a.distMi.toFixed(1) + ' mi';
        card.querySelector('.gmrs-profile').innerHTML = this._buildProfileSVG(a);
      });
    }

    async _analyzeRepeaterPath(userLat, userLng, rep) {
      const SAMPLES    = 64;
      const USER_HEIGHT = 1.5;
      const REP_HEIGHT  = rep.antenna_height_m || 10;
      const elevator    = new google.maps.ElevationService();

      const { results } = await elevator.getElevationAlongPath({
        path: [{ lat: userLat, lng: userLng }, { lat: rep.lat, lng: rep.lng }],
        samples: SAMPLES,
      });

      const totalDistM = this._distanceMiles(userLat, userLng, rep.lat, rep.lng) * 1609.344;
      const lambda     = 299.792458 / rep.frequency_out;
      const h1         = results[0].elevation           + USER_HEIGHT;
      const h2         = results[SAMPLES - 1].elevation + REP_HEIGHT;

      let minClearance = Infinity;
      let minLosClearance = Infinity;
      const points = results.map((r, i) => {
        const frac = i / (SAMPLES - 1);
        const d1   = frac * totalDistM;
        const d2   = (1 - frac) * totalDistM;
        const fr   = (d1 > 0 && d2 > 0) ? Math.sqrt(lambda * d1 * d2 / totalDistM) : 0;
        const los  = h1 + (h2 - h1) * frac;
        const losClearance = los - r.elevation;
        const clearance    = losClearance - 0.6 * fr;
        if (clearance < minClearance)       minClearance    = clearance;
        if (losClearance < minLosClearance) minLosClearance = losClearance;
        return { elev: r.elevation, los, fr };
      });

      const status = minLosClearance < 0  ? 'likely-obstructed'
                   : minClearance    < 0  ? 'possibly-obstructed'
                   :                        'clear';

      return {
        rep, points, totalDistM, minClearance, status,
        distMi: this._distanceMiles(userLat, userLng, rep.lat, rep.lng),
      };
    }

    _buildProfileSVG(analysis) {
      const { points, status } = analysis;
      const N = points.length;
      const W = 400, H = 90;

      const allY = points.flatMap(p => [p.elev, p.los + p.fr, p.los - p.fr]);
      const minY = Math.min(...allY) - 8;
      const span = Math.max(...allY) + 8 - minY;

      const px = i  => ((i / (N - 1)) * W).toFixed(1);
      const py = el => (H - ((el - minY) / span * H)).toFixed(1);

      let terrain = 'M ' + px(0) + ',' + py(points[0].elev);
      for (let i = 1; i < N; i++) terrain += ' L ' + px(i) + ',' + py(points[i].elev);
      terrain += ' L ' + W + ',' + H + ' L 0,' + H + ' Z';

      let fresnel = 'M ' + px(0) + ',' + py(points[0].los + points[0].fr);
      for (let i = 1;       i < N;  i++) fresnel += ' L ' + px(i) + ',' + py(points[i].los + points[i].fr);
      for (let i = N - 1; i >= 0; i--) fresnel += ' L ' + px(i) + ',' + py(points[i].los - points[i].fr);
      fresnel += ' Z';

      const los     = 'M ' + px(0) + ',' + py(points[0].los) + ' L ' + px(N - 1) + ',' + py(points[N - 1].los);
      const lineClr = status === 'likely-obstructed'   ? '#c0392b'
                    : status === 'possibly-obstructed' ? '#e6a817'
                    :                                    '#1e7e45';
      const fillClr = status === 'likely-obstructed'   ? 'rgba(192,57,43,0.15)'
                    : status === 'possibly-obstructed' ? 'rgba(230,168,23,0.15)'
                    :                                    'rgba(30,126,69,0.15)';

      return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"' +
             ' width="100%" height="' + H + '" xmlns="http://www.w3.org/2000/svg">' +
             '<rect width="' + W + '" height="' + H + '" fill="#eef1f5"/>' +
             '<path d="' + fresnel + '" fill="' + fillClr + '"/>' +
             '<path d="' + terrain + '" fill="#b8a898" stroke="#7a6050" stroke-width="0.5"/>' +
             '<path d="' + los + '" stroke="' + lineClr + '" stroke-width="2" fill="none" stroke-dasharray="6,3"/>' +
             '</svg>';
    }
  }

  customElements.define('hub-finder', HubFinder);
})();
