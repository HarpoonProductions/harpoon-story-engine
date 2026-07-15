'use strict';

/**
 * Harpoon Story Engine — Review Layer
 *
 * Activates on the review.* subdomain (or ?review=1 for local testing).
 * Lets reviewers click anywhere on a published story to place a sticky
 * note. Notes are saved to Supabase and restored on subsequent visits.
 *
 * Each reviewer gets a name (prompted once, stored in localStorage) and
 * a colour derived from that name.
 */

(function () {

  // ── Activation guard ─────────────────────────────────────────────
  var onReviewSubdomain = window.location.hostname.startsWith('review.');
  var hasReviewParam    = /[?&]review=1/.test(window.location.search);
  if (!onReviewSubdomain && !hasReviewParam) return;

  // ── Project ID from URL path ──────────────────────────────────────
  var projectId = window.location.pathname.replace(/^\//, '').split('/')[0];
  if (!projectId) return;

  // ── Supabase config from meta tags ────────────────────────────────
  function getMeta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute('content') : null;
  }

  var supabaseUrl = getMeta('hse-supabase-url');
  var supabaseKey = getMeta('hse-supabase-anon-key');
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[review] Missing Supabase meta tags — review layer disabled');
    return;
  }

  // ── Reviewer identity ─────────────────────────────────────────────
  var STORAGE_KEY = 'hse-reviewer';
  var COLOURS = ['#D4A017', '#3A7DC9', '#C94A3A', '#3A9E6B', '#9B59B6', '#C0392B'];
  // Warm amber, blue, red, green, purple, crimson — distinct on dark and light

  var reviewer = null;
  try { reviewer = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) {}

  function hashName(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) {
      h = Math.imul(31, h) + name.charCodeAt(i) | 0;
    }
    return Math.abs(h);
  }

  function colourFor(name) {
    return COLOURS[hashName(name) % COLOURS.length];
  }

  // ── Supabase REST helpers ─────────────────────────────────────────
  function apiFetch(method, path, body) {
    var headers = {
      'apikey': supabaseKey,
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json'
    };
    if (method === 'POST') headers['Prefer'] = 'return=representation';

    return fetch(supabaseUrl + '/rest/v1/' + path, {
      method:  method,
      headers: headers,
      body:    body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
      return r.status === 204 ? null : r.json();
    });
  }

  function loadAnnotations() {
    return apiFetch('GET',
      'story_annotations?project_id=eq.' + encodeURIComponent(projectId) +
      '&order=created_at.asc');
  }

  function saveAnnotation(row) {
    return apiFetch('POST', 'story_annotations', row);
  }

  function resolveAnnotation(id) {
    return apiFetch('PATCH', 'story_annotations?id=eq.' + id, { resolved: true });
  }

  function deleteAnnotation(id) {
    return apiFetch('DELETE', 'story_annotations?id=eq.' + id);
  }

  // ── DOM scaffold ──────────────────────────────────────────────────
  document.body.classList.add('hse-review-active');

  var layer = document.createElement('div');
  layer.id = 'hse-review-layer';
  document.body.appendChild(layer);

  var toolbar = document.createElement('div');
  toolbar.id = 'hse-review-toolbar';
  document.body.appendChild(toolbar);

  // ── Toolbar ───────────────────────────────────────────────────────
  function renderToolbar() {
    toolbar.innerHTML =
      '<div class="hse-review-toolbar__inner">' +
        '<div class="hse-review-toolbar__identity">' +
          '<span class="hse-review-toolbar__dot" style="background:' + reviewer.colour + '"></span>' +
          '<span class="hse-review-toolbar__name">' + esc(reviewer.name) + '</span>' +
        '</div>' +
        '<span class="hse-review-toolbar__hint">Click anywhere to add a note</span>' +
        '<label class="hse-review-toolbar__toggle">' +
          '<input type="checkbox" id="hse-review-show-resolved">' +
          ' Show resolved' +
        '</label>' +
      '</div>';

    document.getElementById('hse-review-show-resolved')
      .addEventListener('change', function (e) {
        layer.classList.toggle('hse-review-layer--show-resolved', e.target.checked);
      });
  }

  // ── Name prompt ───────────────────────────────────────────────────
  function promptForName() {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'hse-review-prompt';
      overlay.innerHTML =
        '<div class="hse-review-prompt__box">' +
          '<p class="hse-review-prompt__heading">Who\'s reviewing?</p>' +
          '<p class="hse-review-prompt__sub">Your name will appear on each note you leave.</p>' +
          '<input class="hse-review-prompt__input" type="text" placeholder="Your name" autocomplete="off">' +
          '<button class="hse-review-prompt__btn">Start reviewing</button>' +
        '</div>';
      document.body.appendChild(overlay);

      var input = overlay.querySelector('.hse-review-prompt__input');
      var btn   = overlay.querySelector('.hse-review-prompt__btn');

      function submit() {
        var name = input.value.trim();
        if (!name) { input.focus(); return; }
        document.body.removeChild(overlay);
        resolve(name);
      }

      btn.addEventListener('click', submit);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submit();
      });

      setTimeout(function () { input.focus(); }, 80);
    });
  }

  // ── Nearest section anchor ────────────────────────────────────────
  function nearestSection(pageY) {
    var best = null, bestDist = Infinity;
    document.querySelectorAll('.hse-section[id]').forEach(function (s) {
      var top  = s.getBoundingClientRect().top + window.scrollY;
      var dist = Math.abs(top - pageY);
      if (dist < bestDist) { bestDist = dist; best = s.id; }
    });
    return best;
  }

  // ── Sticky element ────────────────────────────────────────────────
  function placeStickyEl(ann, isNew) {
    var el = document.createElement('div');
    el.className = 'hse-sticky' + (ann.resolved ? ' hse-sticky--resolved' : '');
    if (ann.id) el.dataset.annId = ann.id;
    el.style.cssText =
      'left:' + ann.x_percent + '%;' +
      'top:'  + ann.y_percent + '%;' +
      '--sticky-colour:' + ann.colour + ';';

    function renderContent(savedAnn) {
      var a = savedAnn || ann;
      var resolveBtn = !a.resolved
        ? '<button class="hse-sticky__resolve" title="Mark as resolved">✓ Resolve</button>'
        : '<span class="hse-sticky__badge">Resolved</span>';

      el.innerHTML =
        '<div class="hse-sticky__header">' +
          '<span class="hse-sticky__author">' + esc(a.reviewer_name) + '</span>' +
          '<div class="hse-sticky__actions">' +
            resolveBtn +
            '<button class="hse-sticky__delete" title="Delete note">✕</button>' +
          '</div>' +
        '</div>' +
        '<p class="hse-sticky__note">' + esc(a.note).replace(/\n/g, '<br>') + '</p>';

      bindButtons(el, a);
    }

    if (isNew) {
      el.innerHTML =
        '<div class="hse-sticky__header">' +
          '<span class="hse-sticky__author">' + esc(ann.reviewer_name) + '</span>' +
          '<button class="hse-sticky__delete hse-sticky__cancel-btn" title="Cancel">✕</button>' +
        '</div>' +
        '<textarea class="hse-sticky__textarea" placeholder="Type your note…" rows="3"></textarea>' +
        '<div class="hse-sticky__footer">' +
          '<button class="hse-sticky__save">Save note</button>' +
        '</div>';

      layer.appendChild(el);

      var textarea = el.querySelector('.hse-sticky__textarea');
      setTimeout(function () { textarea.focus(); }, 50);

      el.querySelector('.hse-sticky__save').addEventListener('click', function () {
        var note = textarea.value.trim();
        if (!note) return;

        var row = {
          project_id:    projectId,
          reviewer_name: ann.reviewer_name,
          colour:        ann.colour,
          anchor_id:     ann.anchor_id,
          x_percent:     ann.x_percent,
          y_percent:     ann.y_percent,
          note:          note,
          resolved:      false
        };

        saveAnnotation(row).then(function (rows) {
          var saved = rows[0];
          el.dataset.annId = saved.id;
          renderContent(saved);
        }).catch(function (e) {
          console.error('[review] Save failed:', e);
        });
      });

      el.querySelector('.hse-sticky__cancel-btn').addEventListener('click', function () {
        layer.removeChild(el);
      });

    } else {
      layer.appendChild(el);
      renderContent(ann);
    }

    makeDraggable(el);
    return el;
  }

  function bindButtons(el, ann) {
    var resolveBtn = el.querySelector('.hse-sticky__resolve');
    if (resolveBtn) {
      resolveBtn.addEventListener('click', function () {
        resolveAnnotation(ann.id).then(function () {
          el.classList.add('hse-sticky--resolved');
          resolveBtn.outerHTML = '<span class="hse-sticky__badge">Resolved</span>';
        });
      });
    }

    var deleteBtn = el.querySelector('.hse-sticky__delete:not(.hse-sticky__cancel-btn)');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (!confirm('Delete this note permanently?')) return;
        deleteAnnotation(ann.id).then(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        });
      });
    }
  }

  // ── Draggable stickies ────────────────────────────────────────────
  function makeDraggable(el) {
    var header = el.querySelector('.hse-sticky__header');
    if (!header) return;

    var dragging = false, ox = 0, oy = 0;

    header.style.cursor = 'grab';

    header.addEventListener('mousedown', function (e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SPAN') return;
      dragging = true;
      ox = e.clientX - el.getBoundingClientRect().left;
      oy = e.clientY - el.getBoundingClientRect().top;
      el.style.zIndex = '10001';
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var layerRect = layer.getBoundingClientRect();
      var x = ((e.clientX - ox - layerRect.left) / layer.offsetWidth)  * 100;
      var y = ((e.clientY - oy - layerRect.top  + window.scrollY) / layer.scrollHeight) * 100;
      el.style.left = Math.max(0, Math.min(90, x)) + '%';
      el.style.top  = Math.max(0, y) + '%';
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      el.style.zIndex = '';
      header.style.cursor = 'grab';
    });
  }

  // ── Click to place ────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    // Ignore clicks on review UI elements
    if (e.target.closest('#hse-review-toolbar') ||
        e.target.closest('#hse-review-layer')   ||
        e.target.closest('.hse-review-prompt')  ||
        e.target.closest('#hse-nav')            ||
        e.target.closest('#hse-audio-player')) return;

    var pageY   = e.pageY;
    var pageX   = e.pageX;
    var totalH  = Math.max(document.body.scrollHeight, 1);
    var totalW  = Math.max(document.body.clientWidth,  1);

    placeStickyEl({
      reviewer_name: reviewer.name,
      colour:        reviewer.colour,
      anchor_id:     nearestSection(pageY),
      x_percent:     (pageX   / totalW) * 100,
      y_percent:     (pageY   / totalH) * 100
    }, true);
  }, false);

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    Promise.resolve().then(function () {
      if (!reviewer) {
        return promptForName().then(function (name) {
          reviewer = { name: name, colour: colourFor(name) };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(reviewer));
        });
      }
    }).then(function () {
      renderToolbar();
      return loadAnnotations();
    }).then(function (rows) {
      rows.forEach(function (ann) { placeStickyEl(ann, false); });
    }).catch(function (e) {
      console.error('[review] Init failed:', e);
    });
  }

  // Keep layer height in sync with document so % positions are accurate
  function syncLayerHeight() {
    layer.style.height = document.body.scrollHeight + 'px';
  }
  window.addEventListener('resize', syncLayerHeight);
  // Re-sync after images/fonts load
  window.addEventListener('load', syncLayerHeight);

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { syncLayerHeight(); init(); });
  } else {
    syncLayerHeight();
    init();
  }

  // ── Utility ───────────────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
