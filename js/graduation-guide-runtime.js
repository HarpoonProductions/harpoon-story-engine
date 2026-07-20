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

  var data = window.GRADUATION_DATA;
  if (!data) { console.error('GRADUATION_DATA not found'); return; }

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

  // ── Floating bar ─────────────────────────────────────────────────────
  (function initFloatingBar() {
    var bar = document.getElementById('floating-bar');
    var hero = document.getElementById('hero');
    if (!bar || !hero) return;
    window.addEventListener('scroll', function () {
      bar.classList.toggle('visible', hero.getBoundingClientRect().bottom < 50);
    }, { passive: true });
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

  // ── Search (ported from graduation-guides/assets/graduation-search.js) ─
  var currentMatches = [];
  var matchIdx = 0;

  function clearHighlights() {
    document.querySelectorAll('.gg-found-text-piece').forEach(function (el) {
      el.outerHTML = el.textContent;
    });
  }

  function doSearch(query) {
    if (!query || query.length < 2) return;
    clearHighlights();
    var matches = [];
    var q = query.toLowerCase();

    document.querySelectorAll('[data-student]').forEach(function (row) {
      var name = row.dataset.student || '';
      if (name.toLowerCase().indexOf(q) === -1) return;

      var list = row.closest('.gg-student-list');
      if (list) list.classList.add('open');

      var span = row.querySelector('.gg-student-name-text');
      if (span) {
        var esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var re = new RegExp('(' + esc + ')', 'gi');
        span.innerHTML = span.textContent.replace(re, '<span class="gg-found-text-piece">$1</span>');
      }

      var cid = row.dataset.ceremony;
      if (cid && cid !== activeCer) selectCeremony(cid, { silent: true, noScroll: true });
      matches.push(row);
    });

    currentMatches = matches;
    matchIdx = 0;
    track('Student Searched', { query: query.slice(0, 50) });
    if (matches.length) scrollToMatch(0);
  }

  function scrollToMatch(idx) {
    var el = currentMatches[idx];
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - 200;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    var textEl = document.getElementById('rpill-text');
    if (textEl) textEl.textContent = 'Result ' + (idx + 1) + ' of ' + currentMatches.length;
    var pill = document.getElementById('result-pill');
    if (pill) pill.classList.toggle('show', currentMatches.length > 1);
  }

  document.getElementById('nav-search-toggle')?.addEventListener('click', function () {
    var inp = document.getElementById('nav-search-input');
    inp.classList.toggle('open');
    if (inp.classList.contains('open')) inp.focus();
  });
  document.getElementById('nav-search-input')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSearch(this.value.trim());
  });
  document.getElementById('nav-search-submit')?.addEventListener('click', function () {
    doSearch(document.getElementById('nav-search-input').value.trim());
  });
  document.getElementById('find-btn')?.addEventListener('click', function () {
    doSearch(document.getElementById('inputField1').value.trim());
  });
  document.getElementById('inputField1')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSearch(this.value.trim());
  });
  document.getElementById('rpill-next')?.addEventListener('click', function () {
    if (currentMatches.length < 2) return;
    matchIdx = (matchIdx + 1) % currentMatches.length;
    scrollToMatch(matchIdx);
  });
  document.getElementById('rpill-close')?.addEventListener('click', function () {
    document.getElementById('result-pill')?.classList.remove('show');
    clearHighlights();
    currentMatches = [];
  });
  document.getElementById('return-top')?.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── URL params (share-link deep-linking) ────────────────────────────
  (function handleParams() {
    var p = new URLSearchParams(location.search);
    var name = p.get('student_name');
    var cer = p.get('ceremony');
    if (cer) selectCeremony(cer.toUpperCase());
    if (name) {
      track('Shared Link Opened', { type: 'student' });
      setTimeout(function () {
        var input = document.getElementById('inputField1');
        if (input) input.value = name;
        doSearch(name);
      }, 500);
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
