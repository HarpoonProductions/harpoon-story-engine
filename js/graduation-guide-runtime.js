/*
 * js/graduation-guide-runtime.js
 *
 * Client-side behaviour for content.kind === "graduation-guide" pages.
 * Operates on the already-rendered static markup from
 * renderer/kinds/graduation-guide.js via querySelectorAll — the same
 * division of labour HSE's toggle-panels/accordion blocks use with
 * js/runtime.js (server renders structure, this file wires interaction).
 *
 * Search matching is a direct port of the graduation.guide product repo's
 * assets/graduation-search.js (already verified against real Imperial
 * data) — plain substring match against [data-student], not Fuse.js.
 *
 * Deliberately kept separate from js/runtime.js: that file serves the
 * narrative-story render path and is covered by test.js's CI gate; this
 * one is not, so changes here can't regress every other live story.
 */
(function () {
  'use strict';

  // ── Nav dropdowns (desktop) — generic over every .gg-nav-dropdown, so
  // Ceremony Guides / Explore more / On this page share one click-handling
  // pass instead of each wiring up its own open/close/outside-click logic.
  // Deliberately ABOVE the GRADUATION_DATA check below: this part of the
  // file (plus the mobile hamburger menu just after it) is the generic
  // .gg-nav interaction layer, reused as-is by narrative story pages that
  // belong to a meta.group_id cluster (see renderer/shell/group-nav.js) —
  // those pages have no GRADUATION_DATA at all, but still need a working
  // dropdown and hamburger menu.
  var navDropdowns = document.querySelectorAll('.gg-nav-dropdown');

  function closeDropdown(except) {
    navDropdowns.forEach(function (d) {
      if (d === except) return;
      d.classList.remove('open');
      var toggle = d.querySelector('.gg-nav-dropdown-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  navDropdowns.forEach(function (dropdown) {
    var toggle = dropdown.querySelector('.gg-nav-dropdown-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var opening = !dropdown.classList.contains('open');
      closeDropdown(opening ? dropdown : null);
      dropdown.classList.toggle('open', opening);
      toggle.setAttribute('aria-expanded', String(opening));
    });
  });

  document.addEventListener('click', function (e) {
    navDropdowns.forEach(function (d) {
      if (!d.contains(e.target)) {
        d.classList.remove('open');
        var toggle = d.querySelector('.gg-nav-dropdown-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // ── Mobile hamburger menu ───────────────────────────────────────────
  var hamburger = document.getElementById('gg-nav-hamburger');
  var mobileMenu = document.getElementById('gg-nav-mobile-menu');
  var mobileClose = document.getElementById('gg-nav-mobile-close');

  function closeMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      mobileMenu.classList.add('open');
      mobileMenu.setAttribute('aria-hidden', 'false');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    });
    if (mobileClose) mobileClose.addEventListener('click', closeMobileMenu);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDropdown(); closeMobileMenu(); }
  });

  // Any mobile-menu link closes the menu on click (ceremony links below
  // get their own additional handling; this covers every other link kind
  // — group/explore/on-this-page links, none of which need special JS).
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a:not([data-ceremony-link])').forEach(function (a) {
      a.addEventListener('click', closeMobileMenu);
    });
  }

  // ── Everything below here needs the graduation-guide kind's own
  // embedded data (ceremonies, search index) — narrative group-nav pages
  // stop here, having already got a working nav out of the code above.
  var data = window.GRADUATION_DATA;
  if (!data) return;

  var ceremonies = data.ceremonies || [];
  var activeCer = (ceremonies.find(function (c) { return c.active; }) || ceremonies[0] || {}).ceremonyId;

  // ── Plausible wrapper — no-ops if Plausible isn't loaded (preview) ──
  function track(event, props) {
    if (typeof window.plausible === 'function') {
      window.plausible(event, props ? { props: props } : undefined);
    }
  }

  // ── Ceremony selection ──────────────────────────────────────────────
  function selectCeremony(id, opts) {
    opts = opts || {};
    activeCer = id;
    document.querySelectorAll('.gg-chooser-tile').forEach(function (t) {
      t.classList.toggle('active', t.dataset.id === id);
    });
    document.querySelectorAll('.gg-ceremony').forEach(function (s) {
      s.classList.toggle('active', s.dataset.id === id);
    });
    var c = ceremonies.find(function (c) { return c.ceremonyId === id; });
    if (c) {
      var textEl = document.getElementById('floating-bar-text');
      if (textEl) textEl.textContent = c.ceremonyLabel;
      if (!opts.silent) track('Ceremony Viewed', { ceremonyId: c.ceremonyId, ceremonyLabel: c.ceremonyLabel });
    }
    var sec = document.getElementById('cer-' + id);
    if (sec && !opts.noScroll) {
      var top = sec.getBoundingClientRect().top + window.pageYOffset - 86;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }

  document.querySelectorAll('.gg-chooser-tile').forEach(function (tile) {
    tile.addEventListener('click', function () { selectCeremony(tile.dataset.id); });
  });

  // ── Ceremony links — shared by the desktop dropdown and the mobile
  // menu (both render the same [data-ceremony-link] markup). On this
  // page, the target ceremony is already in the DOM — jump to it
  // directly via selectCeremony() instead of a native #anchor scroll
  // (inactive ceremonies are display:none, so a bare anchor wouldn't
  // actually show one). Elsewhere (a future satellite page), there's no
  // #cer-X element to find, so let the href navigate to
  // index.html?ceremony=X normally — handleParams() below picks it up.
  document.querySelectorAll('[data-ceremony-link]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.dataset.ceremonyLink;
      if (document.getElementById('cer-' + id)) {
        e.preventDefault();
        selectCeremony(id);
        closeDropdown();
        closeMobileMenu();
      }
    });
  });

  // ── Floating bar ─────────────────────────────────────────────────────
  // Visible only while scrolled within the active ceremony's own section —
  // not "once past the hero, forever" (the old check just looked at the
  // hero, so the bar stayed on through unrelated content further down the
  // page, e.g. the welcome message and photography sections).
  (function initFloatingBar() {
    var bar = document.getElementById('floating-bar');
    if (!bar) return;
    var TRIGGER_LINE = 50; // nav height — matches the hero threshold this replaces

    function updateFloatingBar() {
      var activeSection = document.querySelector('.gg-ceremony.active');
      if (!activeSection) { bar.classList.remove('visible'); return; }
      var rect = activeSection.getBoundingClientRect();
      bar.classList.toggle('visible', rect.top < TRIGGER_LINE && rect.bottom > TRIGGER_LINE);
    }

    window.addEventListener('scroll', updateFloatingBar, { passive: true });
    updateFloatingBar();
  })();

  // ── Procession tabs (scoped per ceremony section) ───────────────────
  document.querySelectorAll('.gg-proc-tabs').forEach(function (tabsEl) {
    var sec = tabsEl.closest('.gg-ceremony');
    if (!sec) return;
    tabsEl.querySelectorAll('.gg-proc-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pi = btn.dataset.pi;
        tabsEl.querySelectorAll('.gg-proc-tab').forEach(function (b) { b.classList.remove('active'); });
        sec.querySelectorAll('.gg-proc-content').forEach(function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
        var pc = sec.querySelector('.gg-proc-content[data-pc="' + pi + '"]');
        if (pc) pc.classList.add('active');
      });
    });
  });

  // ── Course-group toggles ─────────────────────────────────────────────
  document.querySelectorAll('.gg-course-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var list = document.getElementById(btn.dataset.target);
      if (!list) return;
      var opening = !list.classList.contains('open');
      list.classList.toggle('open');
      var title = btn.closest('.gg-course-group')?.querySelector('.gg-course-group-title');
      track('Course Group Toggled', { action: opening ? 'opened' : 'closed', courseName: title ? title.textContent : '' });
    });
  });

  // ── Prizes toggle ─────────────────────────────────────────────────────
  document.querySelectorAll('.gg-prizes-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.nextElementSibling && btn.nextElementSibling.classList.toggle('open');
    });
  });

  // ── Share buttons ─────────────────────────────────────────────────────
  document.querySelectorAll('.gg-share-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var row = btn.closest('[data-student]');
      if (!row) return;
      var name = row.dataset.student;
      var cid = row.dataset.ceremony;
      var url = location.href.split('?')[0] + '?student_name=' + encodeURIComponent(name) + '&ceremony=' + encodeURIComponent(cid);
      track('Share Initiated', { type: 'student', ceremonyId: cid });
      if (navigator.share) {
        navigator.share({ title: document.title, text: 'See ' + name, url: url }).catch(function () { prompt('Copy link:', url); });
      } else {
        prompt('Copy link:', url);
      }
    });
  });

  // ── Search ────────────────────────────────────────────────────────────
  // Matches against window.GRADUATION_DATA.searchIndex — already fully
  // embedded in the page for offline use — not the DOM. Shows a results
  // panel (name + course + ceremony + time) so a parent can tell two
  // students who share a name apart before jumping, instead of cycling
  // through DOM highlights one at a time (the old, and currently broken,
  // mechanic — this replaces it rather than patching it).
  //
  // Exact substring matching runs first, always. Fuzzy (Levenshtein)
  // matching only ever runs when substring matching finds nothing — so a
  // search for "Chen" only ever returns Chens, never fuzzes into "Chan":
  // real distinct surnames stay distinct, fuzzy only catches likely typos
  // on names that don't otherwise exist. Hand-rolled rather than pulling
  // in Fuse.js from a CDN, which would silently break offline use.

  var searchIndex = data.searchIndex || [];
  // Only ever runs when exact substring matching finds nothing (see
  // above), so this can be reasonably generous without risking conflating
  // real distinct names — 0.4 catches common one-transposition typos
  // (e.g. "Kesahv" -> "Keshav") that a stricter 0.3 misses on short names.
  var FUZZY_THRESHOLD = 0.4;
  var MAX_EXACT_RESULTS = 8;
  var MAX_FUZZY_RESULTS = 5;
  var DEBOUNCE_MS = 200;

  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var dp = new Array(n + 1);
    for (var j = 0; j <= n; j++) dp[j] = j;
    for (var i = 1; i <= m; i++) {
      var prev = dp[0];
      dp[0] = i;
      for (var k = 1; k <= n; k++) {
        var tmp = dp[k];
        dp[k] = a[i - 1] === b[k - 1] ? prev : 1 + Math.min(prev, dp[k], dp[k - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  }

  // Ranks matches so "starts with the query" beats "a word inside the
  // name starts with it" beats "matches somewhere mid-word".
  function matchRank(name, q) {
    var lower = name.toLowerCase();
    if (lower.indexOf(q) === 0) return 0;
    if (lower.indexOf(' ' + q) !== -1) return 1;
    return 2;
  }

  function searchNames(rawQuery) {
    var query = (rawQuery || '').trim();
    if (query.length < 2) return { exact: [], fuzzy: [], query: query };

    var q = query.toLowerCase();
    var exact = searchIndex
      .filter(function (entry) { return entry.name.toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) { return matchRank(a.name, q) - matchRank(b.name, q) || a.name.localeCompare(b.name); })
      .slice(0, MAX_EXACT_RESULTS);

    if (exact.length) return { exact: exact, fuzzy: [], query: query };

    var scored = [];
    searchIndex.forEach(function (entry) {
      var best = Infinity;
      entry.name.toLowerCase().split(/\s+/).forEach(function (word) {
        var d = levenshtein(q, word) / Math.max(q.length, word.length);
        if (d < best) best = d;
      });
      if (best <= FUZZY_THRESHOLD) scored.push({ entry: entry, dist: best });
    });
    scored.sort(function (a, b) { return a.dist - b.dist; });

    return { exact: [], fuzzy: scored.slice(0, MAX_FUZZY_RESULTS).map(function (s) { return s.entry; }), query: query };
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function searchPanelItemHtml(entry) {
    return '<button type="button" class="gg-search-panel-item" role="option" ' +
      'data-result-name="' + escapeHtml(entry.name) + '" data-result-ceremony="' + escapeHtml(entry.ceremonyId) + '">' +
      '<span class="gg-search-panel-item-name">' + escapeHtml(entry.name) + '</span>' +
      '<span class="gg-search-panel-item-meta">' + escapeHtml(entry.course) + ' &middot; ' + escapeHtml(entry.ceremonyLabel) + ' &middot; ' + escapeHtml(entry.ceremonyTime) + '</span>' +
      '</button>';
  }

  function renderSearchPanel(panel, results) {
    if (!panel) return;
    if (results.query.length < 2) {
      panel.classList.remove('show');
      panel.innerHTML = '';
      return;
    }

    var html;
    if (results.exact.length) {
      html = results.exact.map(searchPanelItemHtml).join('');
    } else if (results.fuzzy.length) {
      html = '<div class="gg-search-panel-heading">Did you mean&hellip;</div>' + results.fuzzy.map(searchPanelItemHtml).join('');
    } else {
      html = '<div class="gg-search-panel-note">No matches for &ldquo;' + escapeHtml(results.query) + '&rdquo;</div>';
    }
    panel.innerHTML = html;
    panel.classList.add('show');

    panel.querySelectorAll('[data-result-name]').forEach(function (item) {
      item.addEventListener('click', function () {
        jumpToStudent(item.dataset.resultName, item.dataset.resultCeremony);
        panel.classList.remove('show');
      });
    });
  }

  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  }

  // Jumps straight to one specific student — used both when a search
  // result is picked and for the ?student_name=&ceremony= share deep-link,
  // which already knows exactly who to show (no disambiguation needed).
  function jumpToStudent(name, ceremonyId) {
    if (ceremonyId && ceremonyId !== activeCer) selectCeremony(ceremonyId, { silent: true, noScroll: true });
    var row = document.querySelector('[data-student="' + cssEscape(name) + '"][data-ceremony="' + cssEscape(ceremonyId) + '"]');
    if (!row) return;
    var list = row.closest('.gg-student-list');
    if (list) list.classList.add('open');
    var top = row.getBoundingClientRect().top + window.pageYOffset - 200;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    row.classList.add('gg-jumped-to');
    setTimeout(function () { row.classList.remove('gg-jumped-to'); }, 2000);
  }

  function wireSearchBox(inputId, panelId) {
    var input = document.getElementById(inputId);
    var panel = document.getElementById(panelId);
    if (!input || !panel) return;

    var timer = null;
    var lastTracked = '';

    input.addEventListener('input', function () {
      clearTimeout(timer);
      var value = input.value;
      timer = setTimeout(function () {
        var results = searchNames(value);
        renderSearchPanel(panel, results);
        if (results.query && results.query !== lastTracked && (results.exact.length || results.fuzzy.length)) {
          track('Student Searched', { query: results.query.slice(0, 50) });
          lastTracked = results.query;
        }
      }, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        clearTimeout(timer);
        var results = searchNames(input.value);
        var top = results.exact[0] || results.fuzzy[0];
        if (top) jumpToStudent(top.name, top.ceremonyId);
        panel.classList.remove('show');
      } else if (e.key === 'Escape') {
        panel.classList.remove('show');
      }
    });

    document.addEventListener('click', function (e) {
      if (e.target !== input && !panel.contains(e.target)) panel.classList.remove('show');
    });
  }

  wireSearchBox('nav-search-input', 'nav-search-panel');
  wireSearchBox('inputField1', 'find-search-panel');

  document.getElementById('nav-search-toggle')?.addEventListener('click', function () {
    var inp = document.getElementById('nav-search-input');
    inp.classList.toggle('open');
    if (inp.classList.contains('open')) {
      inp.focus();
    } else {
      document.getElementById('nav-search-panel')?.classList.remove('show');
    }
  });
  document.getElementById('nav-search-submit')?.addEventListener('click', function () {
    var input = document.getElementById('nav-search-input');
    renderSearchPanel(document.getElementById('nav-search-panel'), searchNames(input.value));
  });
  document.getElementById('find-btn')?.addEventListener('click', function () {
    var input = document.getElementById('inputField1');
    renderSearchPanel(document.getElementById('find-search-panel'), searchNames(input.value));
  });
  document.getElementById('return-top')?.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── URL params (share-link deep-linking + hero personalisation) ─────
  // A personal link (?student_name=&ceremony=) lands on a personalised
  // hero — "Congratulations, X!" plus "Find X in the honours list" —
  // rather than auto-scrolling straight past it to the roster, so the
  // personal moment is actually seen, not skipped through. Without a
  // name, the same link is still useful: it reads generically and takes
  // you to the inline search box instead of a specific student.
  (function handleParams() {
    var p = new URLSearchParams(location.search);
    var name = p.get('student_name');
    var cer = (p.get('ceremony') || '').toUpperCase();

    if (cer) selectCeremony(cer, { silent: true, noScroll: true });

    var findLink = document.getElementById('hero-find-link');
    var findName = document.getElementById('hero-find-name');

    if (name) {
      track('Shared Link Opened', { type: 'student' });

      var congrats = document.getElementById('hero-congrats');
      if (congrats) congrats.textContent = 'Congratulations, ' + name + '!';

      if (findLink && findName) {
        findName.textContent = name;
        findLink.addEventListener('click', function (e) {
          e.preventDefault();
          jumpToStudent(name, cer);
        });
      }
    } else if (findLink) {
      findLink.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById('inputField1');
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus();
      });
    }

    // iOS install nudge — every visit, not just a personalised share
    // link landing; the message just personalises further when it can.
    // No-ops entirely if HarpoonPWA isn't present (config.pwa.enabled
    // false) or if the visitor isn't on iOS / already has it installed.
    if (window.HarpoonPWA) {
      window.HarpoonPWA.maybeShowIOSInstallBanner({
        message: name
          ? 'Keep ' + name + '’s ceremony details handy — install this guide'
          : 'Install this guide for quick, offline access on the day',
      });
    }
  })();

  // ── Heartbeat ────────────────────────────────────────────────────────
  (function initHeartbeat() {
    var elapsed = 0;
    setInterval(function () {
      elapsed += 30;
      track('Heartbeat', { minutes: String(elapsed / 60) });
    }, 30000);
  })();

  // ── Init ─────────────────────────────────────────────────────────────
  selectCeremony(activeCer, { silent: true, noScroll: true });
})();
