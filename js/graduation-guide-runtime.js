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
  // No ceremony is pre-selected on a plain visit — real feedback: a
  // default-active ceremony read as broken/confusing, not helpful. Deep
  // links (?ceremony=), personalised share links, and search jump-tos
  // still select one explicitly via selectCeremony() below.
  var activeCer = null;

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

  // Clicking the currently-active tile used to just re-select the same
  // ceremony (a visible no-op) — real feedback: no way to back out to
  // "nothing chosen" once a tile was clicked. This restores that.
  function deselectCeremony() {
    activeCer = null;
    document.querySelectorAll('.gg-chooser-tile').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.gg-ceremony').forEach(function (s) { s.classList.remove('active'); });
    var textEl = document.getElementById('floating-bar-text');
    if (textEl) textEl.textContent = '';
  }

  document.querySelectorAll('.gg-chooser-tile').forEach(function (tile) {
    tile.addEventListener('click', function () {
      if (tile.dataset.id === activeCer) {
        deselectCeremony();
      } else {
        selectCeremony(tile.dataset.id);
      }
    });
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

  // ── Dean's welcome expand/collapse ───────────────────────────────────
  // The chevron button existed in the markup with no click handler at
  // all — clicking it did nothing, real feedback: "not working".
  document.querySelectorAll('.gg-dean-expand').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var body = btn.previousElementSibling;
      if (!body || !body.classList.contains('gg-dean-body')) return;
      var expanding = !body.classList.contains('expanded');
      body.classList.toggle('expanded', expanding);
      btn.classList.toggle('expanded', expanding);
      btn.setAttribute('aria-expanded', String(expanding));
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
        closeNavSearch();
      });
    });
  }

  // Only meaningful for the nav search box (the always-visible "Find a
  // graduating student" page box has no open/closed drawer state) — a
  // harmless no-op when called from that one, since #nav-search-input
  // just won't have .open set in that flow.
  function closeNavSearch() {
    setNavSearchOpen(false);
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

  function wireSearchBox(inputId, panelId, triggerIds) {
    var input = document.getElementById(inputId);
    var panel = document.getElementById(panelId);
    if (!input || !panel) return;
    // The button(s) that (re)populate this same panel — tapping one isn't
    // "clicking away", it's asking for the same results again. Without
    // this exemption, the outside-click handler below fires right after
    // the button's own click handler on the same tap and immediately
    // hides whatever the button just showed. Real-testing feedback: "the
    // results close and there's no way to retrigger them but to type
    // again".
    var triggers = (triggerIds || []).map(function (id) { return document.getElementById(id); }).filter(Boolean);

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
        closeNavSearch();
      } else if (e.key === 'Escape') {
        panel.classList.remove('show');
        closeNavSearch();
      }
    });

    document.addEventListener('click', function (e) {
      if (e.target === input || panel.contains(e.target)) return;
      if (triggers.some(function (t) { return e.target === t || t.contains(e.target); })) return;
      panel.classList.remove('show');
    });
  }

  wireSearchBox('nav-search-input', 'nav-search-panel', ['nav-search-toggle']);
  wireSearchBox('inputField1', 'find-search-panel', []);

  var SEARCH_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';
  var CLOSE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var navSearchToggle = document.getElementById('nav-search-toggle');

  // On mobile, the drawer's the only visual state change — the toggle
  // button itself stays put in the same spot regardless, so it doubles
  // as the close control. Without swapping its icon there was nothing
  // telling anyone that tapping it again dismisses the drawer — feedback
  // from real testing: "no way to dismiss".
  function setNavSearchOpen(open) {
    var inp = document.getElementById('nav-search-input');
    if (!inp) return;
    inp.classList.toggle('open', open);
    if (navSearchToggle) {
      navSearchToggle.innerHTML = open ? CLOSE_ICON : SEARCH_ICON;
      navSearchToggle.setAttribute('aria-label', open ? 'Close search' : 'Search');
    }
    if (open) {
      inp.focus();
    } else {
      document.getElementById('nav-search-panel')?.classList.remove('show');
    }
  }

  navSearchToggle?.addEventListener('click', function () {
    setNavSearchOpen(!document.getElementById('nav-search-input')?.classList.contains('open'));
  });

  // Tapping anywhere else on the page — the other natural "never mind"
  // gesture, alongside Escape (wireSearchBox) and re-tapping the toggle
  // — also closes the drawer, not just its results panel.
  document.addEventListener('click', function (e) {
    var inp = document.getElementById('nav-search-input');
    if (!inp || !inp.classList.contains('open')) return;
    if (e.target === inp || e.target === navSearchToggle || navSearchToggle?.contains(e.target)) return;
    var panel = document.getElementById('nav-search-panel');
    if (panel && panel.contains(e.target)) return;
    setNavSearchOpen(false);
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
  // Every uploaded photo lives on this fixed domain regardless of which
  // host is currently serving the page (local preview, staging path
  // prefix, production) — it's the one real S3/CloudFront-backed origin,
  // matching DELIVERY_DOMAIN in the deploy pipeline and harpoon-photo-
  // upload's own config. Deliberately not derived from location.* — a
  // relative path would resolve under e.g. /staging/<id>/, but uploads
  // always write to the bare <id>/ key since there's no "staging photo"
  // concept for a real uploaded student photo.
  var PHOTO_UPLOAD_DOMAIN = 'stories.har.pn';

  // ── "About this photo" info badge ────────────────────────────────────
  // Shown next to ANY personalised photo that actually displays — both
  // the student's own edit-token view and every view-only visitor
  // (family/friends never load js/photo-capture.js at all, so this can't
  // live there; it has to be here, in the always-loaded runtime). A
  // lightweight, always-available reporting channel given the upload
  // flow is deliberately self-service with no active moderation queue —
  // see project memory "personalised-photo-share" for the open policy
  // question that gap is standing in for until Imperial weighs in.
  var PHOTO_INFO_STYLE_ID = 'gg-photo-info-style';
  function injectPhotoInfoStyles() {
    if (document.getElementById(PHOTO_INFO_STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = PHOTO_INFO_STYLE_ID;
    style.textContent =
      '.gg-photo-info-wrap{position:relative;display:inline-block;}' +
      '.gg-photo-info-badge{position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;' +
      'border-radius:50%;border:2px solid #fff;background:#2563eb;color:#fff;' +
      'font-size:13px;font-weight:700;line-height:1;cursor:pointer;padding:0;' +
      'display:flex;align-items:center;justify-content:center;z-index:2;' +
      'font-family:inherit;box-shadow:0 2px 6px rgba(0,0,0,0.35);}' +
      '.gg-photo-info-badge:hover,.gg-photo-info-badge:focus-visible{background:#1d4ed8;}' +
      '.gg-photo-info-popover{position:absolute;bottom:calc(100% + 8px);right:-8px;width:220px;' +
      'background:#1a1a1a;color:#fff;border-radius:10px;padding:12px 14px;font-size:12px;' +
      'line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:3;display:none;}' +
      '.gg-photo-info-popover.is-open{display:block;}' +
      '.gg-photo-info-popover a{color:#40E0CF;}';
    document.head.appendChild(style);
  }

  // Deliberately its own small circular badge on top of #hero-photo, not
  // inside it — that element has overflow:hidden (its own circular photo
  // crop), which would clip anything placed inside that pokes outside the
  // circle. Wrapping it once, here, keeps that untouched.
  function showPhotoInfoBadge(photoEl) {
    if (!photoEl) return;
    // The badge lives as a SIBLING of photoEl inside the wrap (not a
    // descendant of photoEl itself — it can't be, photoEl has
    // overflow:hidden), so the dedup check has to look there too, not
    // inside photoEl. Re-uploads re-fire this via photoImg.onload, so
    // without this check correctly finding an existing badge, each
    // re-upload would stack another one.
    var existingWrap = photoEl.parentElement;
    var alreadyWrapped = existingWrap && existingWrap.classList && existingWrap.classList.contains('gg-photo-info-wrap');
    if (alreadyWrapped && existingWrap.querySelector('.gg-photo-info-badge')) return;

    injectPhotoInfoStyles();

    var wrap = alreadyWrapped ? existingWrap : (function () {
      var w = document.createElement('span');
      w.className = 'gg-photo-info-wrap';
      photoEl.parentNode.insertBefore(w, photoEl);
      w.appendChild(photoEl);
      return w;
    })();

    var badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'gg-photo-info-badge';
    badge.textContent = '?';
    badge.setAttribute('aria-label', 'About this photo');
    badge.setAttribute('aria-expanded', 'false');

    var popover = document.createElement('div');
    popover.className = 'gg-photo-info-popover';
    popover.setAttribute('role', 'note');
    popover.innerHTML = 'This photo was uploaded by a user of this site. If you believe there has been malpractice, ' +
      'please email <a href="mailto:photo-abuse@harpoon.productions">photo-abuse@harpoon.productions</a>.';

    function close() {
      popover.classList.remove('is-open');
      badge.setAttribute('aria-expanded', 'false');
    }
    function toggle(e) {
      e.stopPropagation();
      var opening = !popover.classList.contains('is-open');
      popover.classList.toggle('is-open', opening);
      badge.setAttribute('aria-expanded', String(opening));
    }
    badge.addEventListener('click', toggle);
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    wrap.appendChild(badge);
    wrap.appendChild(popover);
  }

  (function handleParams() {
    var p = new URLSearchParams(location.search);
    var name = p.get('student_name');
    var cer = (p.get('ceremony') || '').toUpperCase();
    var viewToken = p.get('token');
    var editToken = p.get('edit');
    var editTokenFromUrl = !!editToken;

    // Persist edit access to this device rather than only the URL, so a
    // reload / bookmark / return visit tomorrow doesn't require digging
    // the original email back out. localStorage never travels with a
    // share, copy, or bookmark the way the URL does, so this is strictly
    // more private than leaving the token sitting in the address bar —
    // only something reading this device's own storage would see it.
    var editStorageKey = 'hpc:edit:' + encodeURIComponent(data.projectId || '') + ':' +
      encodeURIComponent(name || '') + ':' + encodeURIComponent(cer || '');
    if (editTokenFromUrl) {
      try { localStorage.setItem(editStorageKey, editToken); } catch (e) { /* private mode etc — edit just won't persist */ }
    } else {
      try {
        var savedEditToken = localStorage.getItem(editStorageKey);
        if (savedEditToken) editToken = savedEditToken;
      } catch (e) { /* localStorage unavailable — no persisted edit access */ }
    }

    // Strip `edit` from the visible address bar the moment it's captured
    // (only relevant if it actually arrived via the URL — a token
    // restored from localStorage was never in the address bar to begin
    // with). It's already saved above, so nothing downstream needs to
    // re-read the URL — but the URL itself is exactly what a phone's
    // native share sheet / copy-link / bookmark hands out, and most
    // people reach for that instead of the in-app "Share with family &
    // friends" button. Re-clicking the original emailed link still works
    // every time (that link is untouched); this only cleans the live tab
    // so a reflexive native share can't leak edit access.
    if (editTokenFromUrl && window.history && window.history.replaceState) {
      p.delete('edit');
      var cleanSearch = p.toString();
      history.replaceState(null, '', location.pathname + (cleanSearch ? '?' + cleanSearch : '') + location.hash);
    }

    if (cer) selectCeremony(cer, { silent: true, noScroll: true });

    var findLink = document.getElementById('hero-find-link');
    var findName = document.getElementById('hero-find-name');

    if (name) {
      track('Shared Link Opened', { type: 'student' });

      var congrats = document.getElementById('hero-congrats');
      if (congrats) congrats.textContent = 'Congratulations, ' + name + '!';

      var photoEl = document.getElementById('hero-photo');
      var photoImg = document.getElementById('hero-photo-img');
      // Legacy/committed-at-build-time lookup — see project memory
      // "personalised-photo-share". Kept as the fallback for photos that
      // predate the upload endpoint (keyed the same way searchIndex
      // treats duplicate names: name + ceremony, not name alone).
      var legacyPhotoUrl = (data.studentPhotos || {})[name + '|' + cer];
      var photoShown = false;

      if (photoEl && photoImg) {
        if (viewToken && data.projectId) {
          // Deterministic, no live "does a photo exist" check — try
          // loading it and fall back on 404. The upload response itself
          // (see js/photo-capture.js) sets src directly after a successful
          // upload instead of re-probing this, so the uploader's own
          // immediate view never depends on this fallback chain at all.
          var uploadedUrl = 'https://' + PHOTO_UPLOAD_DOMAIN + '/' + data.projectId + '/photos/uploaded/' + viewToken + '.jpg';
          photoImg.onerror = function () {
            photoImg.onerror = null;
            if (legacyPhotoUrl) {
              photoImg.src = legacyPhotoUrl; // still triggers onload below
            } else if (editToken) {
              // No photo yet, but this visitor can add one — keep the
              // circle visible so js/photo-capture.js's upload trigger
              // (overlaid on this same element) still shows. Clear src so
              // a broken-image glyph doesn't show through the overlay.
              photoImg.removeAttribute('src');
              if (findName) findName.textContent = name;
            } else {
              photoEl.hidden = true;
              if (findName) findName.textContent = name;
            }
          };
          // Only claim "them" once a photo has actually, successfully
          // loaded — not optimistically the moment the request starts
          // (the deterministic URL 404s for the very common case: a
          // student who hasn't uploaded yet).
          photoImg.onload = function () {
            if (findName) findName.textContent = 'them';
            showPhotoInfoBadge(photoEl);
          };
          photoImg.src = uploadedUrl;
          photoImg.alt = name + '’s photo';
          photoEl.hidden = false;
          photoShown = true;
        } else if (legacyPhotoUrl) {
          showPhotoInfoBadge(photoEl);
          photoImg.src = legacyPhotoUrl;
          photoImg.alt = name + '’s photo';
          photoEl.hidden = false;
          photoShown = true;
        }
      }

      if (findLink && findName) {
        // With a photo already showing "who", the link can say "them"
        // instead of repeating a (possibly long) full name a second time.
        // For the token path this starts as `name` and is upgraded to
        // "them" on the photo's onload above, once it's actually visible
        // — not assumed just because a lookup was attempted.
        findName.textContent = (photoShown && !viewToken) ? 'them' : name;
        findLink.addEventListener('click', function (e) {
          e.preventDefault();
          jumpToStudent(name, cer);
        });
      }

      // Upload UI only ever shows because `edit` is present in the URL —
      // never validated client-side (meaningless in public JS); the real
      // check happens server-side, at the moment of the actual upload
      // POST, in harpoon-photo-upload. A guessed/tampered edit link just
      // fails there with a clear error, never silently here.
      //
      // js/photo-capture.js is deferred-loaded, not part of this file's
      // own <script> tag, so the vastly more common view-only visit never
      // pays for it — copied into every project's output the same
      // wholesale way this file itself is (renderer/index.js's copyDirRecursive
      // over the whole js/ directory), so a plain relative path resolves
      // correctly under any basePath without this file needing to know it.
      if (editToken) {
        var initCapture = function () {
          window.HarpoonPhotoCapture.init({
            projectId: data.projectId,
            studentName: name,
            ceremonyId: cer,
            editToken: editToken,
            viewToken: viewToken,
            shareUrl: viewToken ? location.href.split('?')[0] + '?student_name=' + encodeURIComponent(name) + '&ceremony=' + encodeURIComponent(cer) + '&token=' + encodeURIComponent(viewToken) : null,
            onUploaded: function (url) {
              if (photoEl && photoImg) {
                photoImg.onerror = null;
                photoImg.src = url;
                photoImg.alt = name + '’s photo';
                photoEl.hidden = false;
              }
              if (findName) findName.textContent = 'them';
            },
            onRemoved: function () {
              if (findName) findName.textContent = name;
            },
          });
        };
        if (window.HarpoonPhotoCapture) {
          initCapture();
        } else {
          var captureScript = document.createElement('script');
          captureScript.src = 'js/photo-capture.js';
          captureScript.onload = initCapture;
          document.head.appendChild(captureScript);
        }
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

    // iOS install nudge — every visit EXCEPT a student's own first landing
    // on their edit link, where it competes with the actual thing they're
    // there to do (add their photo) before they've done it — feedback
    // from real testing: it "feels too early" at that exact moment. Still
    // shows for view-only visits (family/friends) and, implicitly, on any
    // later visit back to the same edit link once the photo's already
    // added. No-ops entirely if HarpoonPWA isn't present (config.pwa.enabled
    // false) or if the visitor isn't on iOS / already has it installed.
    if (window.HarpoonPWA && !editToken) {
      var institution = data.institution || {};
      window.HarpoonPWA.maybeShowIOSInstallBanner({
        message: name
          ? 'Keep ' + name + '’s ceremony details handy — install this guide'
          : 'Install this guide for quick, offline access on the day',
        // Someone is being asked to install something before they know
        // it's from a legitimate source — show who it's actually from.
        logo: institution.logo || null,
        logoAlt: institution.name || '',
        title: data.guide.title || '',
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

  // ── Hero video pause control ─────────────────────────────────────────
  // WCAG 2.2.2: auto-playing video needs a pause mechanism — the button
  // has always been in the markup (both hero variants below) but nothing
  // ever wired it up. Applies regardless of config.scrollHero — the
  // default static hero has exactly the same autoplaying-video-needs-a-
  // pause-control obligation as the scroll-hero variant does.
  function setupHeroVideoPause() {
    var video = document.getElementById('hero-video');
    var btn = document.getElementById('hero-pause-btn');
    if (!video || !btn) return;

    function setPausedState(paused) {
      btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      btn.setAttribute('aria-label', paused ? 'Play background video' : 'Pause background video');
      btn.innerHTML = paused ? '&#9654; Play' : '&#9646;&#9646; Pause';
    }

    btn.addEventListener('click', function () {
      if (video.paused) { video.play(); setPausedState(false); }
      else { video.pause(); setPausedState(true); }
    });

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      setPausedState(true);
    }
  }
  setupHeroVideoPause();

  // ── Scroll hero (config.scrollHero.enabled) ──────────────────────────
  // No-ops entirely — including never touching GRADUATION_DATA or
  // anything else — when the opt-in markup isn't present (the default,
  // every project except ones that have explicitly turned this on) or
  // when GSAP/ScrollTrigger didn't load (buildPwaHeadTags-equivalent
  // guard: renderer/kinds/graduation-guide.js only emits those <script>
  // tags when config.scrollHero.enabled, so their absence here means
  // this project genuinely didn't opt in — not a load failure to retry).
  // See project memory "hse-graduation-guide-scroll-hero".
  (function setupScrollHero() {
    var root = document.getElementById('scroll-hero');
    if (!root || !window.gsap) return;

    var entrance = document.getElementById('scroll-hero-entrance');
    var panel = document.getElementById('scroll-wipe-panel');
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      // Snap straight to the end state — fully revealed, panel fully
      // wiped — rather than animating, same treatment js/runtime.js
      // gives .hse-reveal/.hse-cover__* elements.
      if (entrance) { entrance.style.opacity = '1'; entrance.style.transform = 'none'; }
      if (panel) panel.style.setProperty('--wipe-progress', '1');
      return;
    }

    if (entrance) {
      gsap.to(entrance, { opacity: 1, x: 0, duration: 0.9, ease: 'power2.out', delay: 0.3 });
    }

    // Deliberately NOT a GSAP ScrollTrigger for this part — tried that
    // first, and it measured its own start/end scroll positions wrong
    // (producing nonsensical, sometimes negative pixel ranges), because
    // .gg-scroll-hero-content's margin-top:-100vh (needed to make the
    // sticky-video-behind-scrolling-text illusion work at all — see the
    // CSS) throws off ScrollTrigger's assumption that an element's
    // rendered position matches its document-flow offset. Plain
    // getBoundingClientRect() on every scroll tick doesn't care about
    // that gap — it just reports where the element actually is right
    // now — so this reads correctly regardless. wipeStart/wipeEnd are
    // computed from the real rendered hero-block height, not a guessed
    // constant, so this still lands right whatever the welcome copy's
    // actual length is.
    if (!panel) return;
    var heroHeight = entrance ? entrance.offsetHeight : window.innerHeight;
    var totalHeight = root.offsetHeight;
    var heroFraction = totalHeight > 0 ? heroHeight / totalHeight : 0;
    var wipeStart = Math.min(0.95, heroFraction);
    var wipeEnd = Math.min(1, wipeStart + 0.18);

    var ticking = false;
    function updateWipe() {
      ticking = false;
      var rect = root.getBoundingClientRect();
      var scrollableDistance = Math.max(1, root.offsetHeight - window.innerHeight);
      var raw = Math.min(1, Math.max(0, -rect.top / scrollableDistance));
      var p = raw <= wipeStart
        ? 0
        : raw >= wipeEnd
          ? 1
          : (raw - wipeStart) / (wipeEnd - wipeStart);
      panel.style.setProperty('--wipe-progress', p);
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateWipe);
    }, { passive: true });
    updateWipe();
  })();

  // ── Init ─────────────────────────────────────────────────────────────
  // Only re-syncs the DOM if a deep link / share link / search jump-to
  // already set activeCer above — a plain visit leaves it null and the
  // chooser grid simply shows nothing pre-selected.
  if (activeCer) selectCeremony(activeCer, { silent: true, noScroll: true });
})();
