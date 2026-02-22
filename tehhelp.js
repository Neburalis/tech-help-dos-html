/**
 * TECH Help! -- SPA Navigation Engine + Full-Text Search
 *
 * Works on both http:// (uses fetch) and file:// (uses hidden iframe,
 * because browsers block fetch() on the file: protocol).
 *
 * Search: loads pages.json at startup, builds a lunr.js index, then
 * provides a live dropdown with title + highlighted excerpt per result.
 */

(function () {
  'use strict';

  const PAGES_DIR   = 'pages/';
  const DEFAULT_PAGE = PAGES_DIR + '2-main_menu.html';

  // DOM refs
  const loadingBar = document.getElementById('loading-bar');
  const contentH1  = document.getElementById('page-h1');
  const contentPre = document.getElementById('page-pre');
  const navTitles  = document.querySelectorAll('.nav-title');
  const prevBtns   = document.querySelectorAll('.nav-prev');
  const nextBtns   = document.querySelectorAll('.nav-next');
  const homeName   = document.getElementById('home-name');

  // Navigation history stack
  let navStack = [];
  let navPos   = -1;

  // ----------------------------------------------------------------
  // Loading bar
  // ----------------------------------------------------------------
  let loadTimer = null;

  function showLoading() {
    loadingBar.classList.remove('done');
    loadingBar.classList.add('active');
  }

  function doneLoading() {
    loadingBar.classList.remove('active');
    loadingBar.classList.add('done');
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => loadingBar.classList.remove('done'), 500);
  }

  // ----------------------------------------------------------------
  // Page loader -- fetch on http://, iframe on file://
  // ----------------------------------------------------------------
  const parser      = new DOMParser();
  const useFileMode = location.protocol === 'file:';

  function extractData(doc, filename) {
    return {
      title:      doc.querySelector('title')?.textContent ?? filename,
      h1:         doc.querySelector('h1')?.textContent    ?? '',
      preContent: doc.querySelector('pre')?.innerHTML     ?? '',
    };
  }

  // Persistent hidden iframe used in file:// mode
  let loaderFrame = null;

  function getFrame() {
    if (!loaderFrame) {
      loaderFrame = document.createElement('iframe');
      loaderFrame.style.cssText =
        'position:absolute;width:0;height:0;border:0;visibility:hidden';
      loaderFrame.setAttribute('aria-hidden', 'true');
      document.body.appendChild(loaderFrame);
    }
    return loaderFrame;
  }

  function fetchViaFrame(filename) {
    return new Promise((resolve, reject) => {
      const frame = getFrame();

      function onLoad() {
        frame.removeEventListener('load',  onLoad);
        frame.removeEventListener('error', onErr);
        try {
          const doc = frame.contentDocument || frame.contentWindow.document;
          resolve(extractData(doc, filename));
        } catch (e) {
          reject(e);
        }
      }

      function onErr() {
        frame.removeEventListener('load',  onLoad);
        frame.removeEventListener('error', onErr);
        reject(new Error('Failed to load ' + filename));
      }

      frame.addEventListener('load',  onLoad);
      frame.addEventListener('error', onErr);
      frame.src = filename;
    });
  }

  async function fetchViaHttp(filename) {
    const resp = await fetch(filename);
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' loading ' + filename);
    const html = await resp.text();
    return extractData(parser.parseFromString(html, 'text/html'), filename);
  }

  function fetchPage(filename) {
    return useFileMode ? fetchViaFrame(filename) : fetchViaHttp(filename);
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  function renderPage(data) {
    contentH1.textContent = data.h1;
    contentPre.innerHTML  = data.preContent;
    document.title        = data.title;
    navTitles.forEach(el => { el.textContent = data.h1; });

    const pane = document.querySelector('.shell-content');
    if (pane) pane.scrollTop = 0;
  }

  function updateButtons() {
    const canBack    = navPos > 0;
    const canForward = navPos < navStack.length - 1;
    prevBtns.forEach(b => { b.disabled = !canBack;    });
    nextBtns.forEach(b => { b.disabled = !canForward; });
  }

  // ----------------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------------
  async function navigateTo(filename) {
    showLoading();
    try {
      const data = await fetchPage(filename);

      navStack.splice(navPos + 1);
      navStack.push(filename);
      navPos = navStack.length - 1;

      history.pushState({ navPos, filename }, '', '#' + filename);
      renderPage(data);
      updateButtons();
    } catch (err) {
      contentH1.textContent  = 'Error loading page';
      contentPre.textContent = String(err);
    } finally {
      doneLoading();
    }
  }

  async function loadAt(pos) {
    if (pos < 0 || pos >= navStack.length) return;
    navPos = pos;
    showLoading();
    try {
      const data = await fetchPage(navStack[pos]);
      renderPage(data);
      updateButtons();
    } catch (err) {
      contentH1.textContent  = 'Error loading page';
      contentPre.textContent = String(err);
    } finally {
      doneLoading();
    }
  }

  // Normalise a bare filename (no directory) to include PAGES_DIR
  function normalisePath(filename) {
    if (!filename) return DEFAULT_PAGE;
    if (/^\d+-[^/]+\.html$/.test(filename)) return PAGES_DIR + filename;
    return filename;
  }

  // Browser back / forward
  window.addEventListener('popstate', (e) => {
    const pos = e.state?.navPos;
    if (pos !== undefined && pos >= 0 && pos < navStack.length) {
      loadAt(pos);
    } else {
      navigateTo(normalisePath(location.hash.slice(1)));
    }
  });

  // Our nav buttons drive browser history; popstate handles the rest
  prevBtns.forEach(btn => {
    btn.addEventListener('click', () => { if (navPos > 0) history.back(); });
  });
  nextBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (navPos < navStack.length - 1) history.forward();
    });
  });

  // Click interception inside the content area
  contentPre.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');

    if (!href || href === '#') {
      e.preventDefault();
      return;
    }

    if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
      anchor.target = '_blank';
      anchor.rel    = 'noopener noreferrer';
      return;
    }

    if (/^\d+-[^/]+\.html$/.test(href)) {
      e.preventDefault();
      navigateTo(PAGES_DIR + href);
    }
  });

  // Home title
  if (homeName) {
    homeName.addEventListener('click', () => navigateTo(DEFAULT_PAGE));
    homeName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateTo(DEFAULT_PAGE);
      }
    });
  }

  // ----------------------------------------------------------------
  // Initial load
  // ----------------------------------------------------------------
  (async function init() {
    const filename = normalisePath(location.hash.slice(1));

    navStack.push(filename);
    navPos = 0;
    history.replaceState({ navPos: 0, filename }, '', '#' + filename);

    showLoading();
    try {
      const data = await fetchPage(filename);
      renderPage(data);
    } catch (err) {
      contentH1.textContent  = 'Error loading page';
      contentPre.textContent = String(err);
    } finally {
      doneLoading();
      updateButtons();
    }
  })();

  // ================================================================
  // SEARCH MODULE
  // ================================================================

  const searchInput   = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  let lunrIndex  = null;   // built lunr index
  let pagesStore = null;   // id -> {t, b} lookup

  // ----------------------------------------------------------------
  // Excerpt helper
  // Returns a plain-text snippet of ~160 chars around the first hit,
  // with matched words wrapped in <mark> tags.
  // ----------------------------------------------------------------
  function makeExcerpt(body, terms) {
    const WINDOW = 80; // chars before/after the match
    // Build a regex from all unique root terms (escape special chars)
    const escaped = terms
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const re = new RegExp(escaped, 'i');

    let text = body.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const m  = re.exec(text);

    let snippet;
    if (m) {
      const start = Math.max(0, m.index - WINDOW);
      const end   = Math.min(text.length, m.index + m[0].length + WINDOW);
      snippet = (start > 0 ? '…' : '') +
                text.slice(start, end) +
                (end < text.length ? '…' : '');
    } else {
      snippet = text.slice(0, WINDOW * 2) + (text.length > WINDOW * 2 ? '…' : '');
    }

    // Highlight all occurrences in the snippet
    return snippet.replace(new RegExp(escaped, 'gi'), match =>
      '<mark>' + escapeHtml(match) + '</mark>'
    ).replace(/(?<!\<mark\>)[^<]+(?!\<\/mark\>)/g, part =>
      // escapeHtml for non-mark parts
      part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    );
  }

  // Safe HTML escape for plain text pieces
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Build a highlighted excerpt without double-escaping
  function buildExcerpt(body, terms) {
    const WINDOW = 80;
    const escaped = terms
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    if (!escaped) return escapeHtml(body.slice(0, 160)) + '…';

    const re = new RegExp(escaped, 'i');
    let text = body.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const m  = re.exec(text);

    let start = 0, end = Math.min(text.length, WINDOW * 2);
    let prefix = '', suffix = text.length > end ? '…' : '';

    if (m) {
      start  = Math.max(0, m.index - WINDOW);
      end    = Math.min(text.length, m.index + m[0].length + WINDOW);
      prefix = start > 0 ? '…' : '';
      suffix = end < text.length ? '…' : '';
    }

    const snippet = text.slice(start, end);
    // Split on matches and rebuild with <mark>
    const reG = new RegExp('(' + escaped + ')', 'gi');
    const parts = snippet.split(reG);
    let html = prefix;
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        // matched term
        html += '<mark>' + escapeHtml(parts[i]) + '</mark>';
      } else {
        html += escapeHtml(parts[i]);
      }
    }
    html += suffix;
    return html;
  }

  // ----------------------------------------------------------------
  // Render search results dropdown
  // ----------------------------------------------------------------
  function renderResults(results, terms) {
    if (!results.length) {
      searchResults.innerHTML = '<div class="search-empty">No results found</div>';
      searchResults.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
      return;
    }

    const frag = document.createDocumentFragment();
    results.forEach((r, idx) => {
      const page = pagesStore[r.ref];
      if (!page) return;

      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.setAttribute('role', 'option');
      item.setAttribute('tabindex', '-1');
      item.setAttribute('data-filename', PAGES_DIR + r.ref);
      item.setAttribute('aria-selected', 'false');

      const titleEl = document.createElement('div');
      titleEl.className = 'search-result-title';
      titleEl.textContent = page.t;

      const excerptEl = document.createElement('div');
      excerptEl.className = 'search-result-excerpt';
      excerptEl.innerHTML = buildExcerpt(page.b, terms);

      item.appendChild(titleEl);
      item.appendChild(excerptEl);

      item.addEventListener('mousedown', (e) => {
        // mousedown fires before blur, use it to navigate
        e.preventDefault();
        closeResults();
        navigateTo(PAGES_DIR + r.ref);
      });

      frag.appendChild(item);
    });

    searchResults.innerHTML = '';
    searchResults.appendChild(frag);
    searchResults.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
  }

  function closeResults() {
    searchResults.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
  }

  // ----------------------------------------------------------------
  // Query the lunr index
  // ----------------------------------------------------------------
  function doSearch(raw) {
    const q = raw.trim();
    if (!q || !lunrIndex) {
      closeResults();
      return;
    }

    let results;
    try {
      // Try wildcard on the last token for prefix matching
      const tokens = q.split(/\s+/).filter(Boolean);
      const query  = tokens
        .map((tok, i) => {
          const safe = tok.replace(/[+\-^~*:[\]{}()!\\]/g, '\\$&');
          // apply trailing wildcard to the last token if it's reasonably long
          return (i === tokens.length - 1 && safe.length >= 2)
            ? safe + '*'
            : safe;
        })
        .join(' ');
      results = lunrIndex.search(query);
    } catch (_) {
      try {
        results = lunrIndex.search(q);
      } catch (__) {
        results = [];
      }
    }

    const terms = q.split(/\s+/).filter(t => t.length >= 2);
    renderResults(results.slice(0, 10), terms);
  }

  // ----------------------------------------------------------------
  // Keyboard navigation within results
  // ----------------------------------------------------------------
  function getItems() {
    return Array.from(searchResults.querySelectorAll('.search-result-item'));
  }

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeResults();
      searchInput.blur();
      return;
    }
    if (searchResults.hidden) return;

    const items = getItems();
    if (!items.length) return;

    const focused = searchResults.querySelector('.search-result-item:focus') ||
                    searchResults.querySelector('.search-result-item[aria-selected="true"]');
    let idx = items.indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = (idx + 1) % items.length;
      items[idx].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = (idx - 1 + items.length) % items.length;
      items[idx].focus();
    } else if (e.key === 'Enter' && focused) {
      e.preventDefault();
      closeResults();
      navigateTo(focused.getAttribute('data-filename'));
    }
  });

  // Close when clicking outside the search widget
  document.addEventListener('mousedown', (e) => {
    const wrap = document.getElementById('search-wrap');
    if (wrap && !wrap.contains(e.target)) {
      closeResults();
    }
  });

  searchInput.addEventListener('blur', () => {
    // Small delay so mousedown on a result fires first
    setTimeout(closeResults, 150);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim() && lunrIndex) {
      doSearch(searchInput.value);
    }
  });

  // ----------------------------------------------------------------
  // Debounced input handler
  // ----------------------------------------------------------------
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    if (!searchInput.value.trim()) {
      closeResults();
      return;
    }
    searchTimer = setTimeout(() => doSearch(searchInput.value), 220);
  });

  // ----------------------------------------------------------------
  // Build the lunr index from pages.json
  // ----------------------------------------------------------------
  async function buildSearchIndex() {
    try {
      let data;
      if (useFileMode) {
        // On file://, use an iframe to fetch the JSON
        data = await new Promise((resolve, reject) => {
          const frame = document.createElement('iframe');
          frame.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
          frame.setAttribute('aria-hidden', 'true');
          document.body.appendChild(frame);
          frame.addEventListener('load', () => {
            try {
              const text = frame.contentDocument.body.innerText ||
                           frame.contentDocument.body.textContent;
              document.body.removeChild(frame);
              resolve(JSON.parse(text));
            } catch(e) { reject(e); }
          });
          frame.addEventListener('error', reject);
          frame.src = 'pages.json';
        });
      } else {
        const resp = await fetch('pages.json');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        data = await resp.json();
      }

      // Build a fast lookup store
      pagesStore = {};
      data.forEach(p => { pagesStore[p.id] = p; });

      // Build the lunr index
      lunrIndex = lunr(function () {
        this.field('t', { boost: 3 });
        this.field('b');
        this.ref('id');

        // Disable the stemmer for technical content (keeps INT, AX, etc. intact)
        this.pipeline.remove(lunr.stemmer);
        this.searchPipeline.remove(lunr.stemmer);

        data.forEach(p => this.add(p));
      });

      // Index is ready
      searchInput.placeholder = 'Search…';
      searchInput.disabled    = false;
      searchInput.title       = '';

    } catch (err) {
      searchInput.placeholder = 'Search unavailable';
      searchInput.title       = String(err);
      console.warn('Search index build failed:', err);
    }
  }

  // Kick off index build after a short delay so the initial page load
  // gets priority on the network and CPU.
  setTimeout(buildSearchIndex, 300);

})();
