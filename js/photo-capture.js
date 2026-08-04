/*
 * js/photo-capture.js
 *
 * Personalised-photo capture/crop UI for graduation-guide pages — see
 * project memory "personalised-photo-share". Deferred-loaded only when an
 * `edit` token is present in the URL (renderer/kinds/graduation-guide.js),
 * so this JS never ships to the vastly more common view-only visit.
 *
 * Deliberately does NOT validate the edit token itself — that's
 * meaningless in public JS. It just shows the upload UI optimistically;
 * the real check happens server-side in harpoon-photo-upload at the
 * moment of the actual POST. A guessed/tampered edit link fails there
 * with a clear error, never silently here.
 *
 * Modal markup/structure modelled on renderer/pwa/ios-install-banner.js's
 * existing dialog (role="dialog", aria-modal, self-injected styles), but
 * NOT its focus handling — that banner only moves initial focus to its
 * close button, it has no actual Tab-cycling focus trap. This is a real
 * multi-step form flow, so it gets a proper one.
 *
 * No crop library is vendored anywhere in this repo (only GSAP/
 * ScrollTrigger exist in js/vendor/) — this hand-rolls a small circular
 * crop with <canvas>, matching the project's established vendor-or-hand-
 * roll-never-CDN rule (offline-first is a hard requirement).
 *
 * Usage: HarpoonPhotoCapture.init({ projectId, studentName, ceremonyId,
 *   editToken, viewToken, shareUrl, onUploaded })
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'hpc-style';
  var VIEWPORT_SIZE = 240; // CSS px — crop preview circle
  var OUTPUT_SIZE = 800; // px — exported square JPEG
  var ZOOM_MIN = 1;
  var ZOOM_MAX = 3;
  var ZOOM_STEP = 0.25;
  var NUDGE_STEP = 0.08; // fraction of max offset, per arrow-key press

  // Overridable for local/dev testing without touching the render
  // pipeline — production pages get the real deployed service.
  var UPLOAD_ENDPOINT = global.HARPOON_PHOTO_UPLOAD_ENDPOINT || 'https://harpoon-photo-upload.onrender.com/upload';
  var DELETE_ENDPOINT = global.HARPOON_PHOTO_DELETE_ENDPOINT || 'https://harpoon-photo-upload.onrender.com/delete';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.gg-hero-photo{position:relative;}' +
      '.hpc-trigger{position:absolute;inset:0;width:100%;height:100%;border:none;' +
      'border-radius:50%;cursor:pointer;padding:0;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:2px;' +
      'background:rgba(10,10,10,0.45);color:#fff;font-family:inherit;' +
      'font-size:10px;font-weight:700;line-height:1.2;text-align:center;}' +
      '.hpc-trigger:hover,.hpc-trigger:focus-visible{background:rgba(10,10,10,0.6);}' +
      '.hpc-trigger svg{width:22px;height:22px;}' +
      // Once a real photo is set, drop the full-circle darkened overlay
      // (it obscures the photo itself, which is the whole point of having
      // uploaded one) in favour of a small corner edit badge — same
      // pattern as most avatar-edit UIs.
      '.hpc-trigger.hpc-has-photo{inset:auto;bottom:0;right:0;width:30px;height:30px;' +
      'background:rgba(10,10,10,0.65);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);}' +
      '.hpc-trigger.hpc-has-photo:hover,.hpc-trigger.hpc-has-photo:focus-visible{background:rgba(10,10,10,0.85);}' +
      '.hpc-trigger.hpc-has-photo svg{width:15px;height:15px;}' +
      '.hpc-spinner{width:30px;height:30px;margin:2px auto 16px;border-radius:50%;' +
      'border:3px solid rgba(255,255,255,0.2);border-top-color:#40E0CF;' +
      'animation:hpc-spin 0.8s linear infinite;}' +
      '@keyframes hpc-spin{to{transform:rotate(360deg);}}' +

      '.hpc-overlay{position:fixed;inset:0;z-index:3100;display:flex;' +
      'align-items:center;justify-content:center;padding:20px;' +
      'background:rgba(10,10,10,0.7);opacity:0;transition:opacity 0.25s ease;}' +
      '.hpc-overlay.is-visible{opacity:1;}' +
      '.hpc-dialog{position:relative;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;' +
      'background:#1a1a1a;color:#fff;border-radius:20px;padding:28px 24px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;' +
      'transform:scale(0.94);transition:transform 0.25s ease;}' +
      '.hpc-overlay.is-visible .hpc-dialog{transform:scale(1);}' +
      '.hpc-title{font-size:18px;font-weight:700;margin-bottom:16px;padding-right:28px;}' +
      '.hpc-close{position:absolute;top:12px;right:12px;background:none;border:none;' +
      'color:rgba(255,255,255,0.65);font-size:22px;cursor:pointer;padding:8px;line-height:1;}' +
      '.hpc-close:hover,.hpc-close:focus-visible{color:#fff;}' +
      '.hpc-btn{display:block;width:100%;padding:13px 16px;margin-bottom:10px;' +
      'border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);' +
      'color:#fff;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;text-align:center;}' +
      '.hpc-btn:hover,.hpc-btn:focus-visible{background:rgba(255,255,255,0.14);}' +
      '.hpc-btn-primary{background:#40E0CF;color:#0a0a0a;border-color:#40E0CF;}' +
      '.hpc-btn-primary:hover,.hpc-btn-primary:focus-visible{background:#33c9ba;}' +
      '.hpc-btn-text{background:none;border:none;color:rgba(255,255,255,0.7);' +
      'font-size:14px;text-decoration:underline;padding:10px;width:auto;margin:0 auto;display:block;}' +
      '.hpc-row{display:flex;gap:10px;}' +
      '.hpc-row .hpc-btn{margin-bottom:0;}' +

      '.hpc-crop-viewport{width:' + VIEWPORT_SIZE + 'px;height:' + VIEWPORT_SIZE + 'px;' +
      'border-radius:50%;overflow:hidden;position:relative;margin:0 auto 16px;' +
      'background:#000;cursor:grab;touch-action:none;' +
      'outline-offset:4px;}' +
      '.hpc-crop-viewport:active{cursor:grabbing;}' +
      '.hpc-crop-viewport img{position:absolute;left:50%;top:50%;max-width:none;user-select:none;' +
      '-webkit-user-drag:none;}' +
      '.hpc-zoom-row{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:18px;}' +
      '.hpc-zoom-btn{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.25);' +
      'background:rgba(255,255,255,0.06);color:#fff;font-size:18px;line-height:1;cursor:pointer;}' +
      '.hpc-zoom-btn:hover,.hpc-zoom-btn:focus-visible{background:rgba(255,255,255,0.16);}' +
      '.hpc-hint{font-size:12px;color:rgba(255,255,255,0.55);text-align:center;margin-bottom:16px;}' +
      '.hpc-consent{font-size:12px;line-height:1.5;color:rgba(255,255,255,0.65);margin-bottom:10px;}' +
      '.hpc-consent a{color:#40E0CF;}' +
      '.hpc-terms{font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:18px;}' +
      '.hpc-terms summary{cursor:pointer;color:rgba(255,255,255,0.75);}' +
      '.hpc-terms summary:hover,.hpc-terms summary:focus-visible{color:#fff;}' +
      '.hpc-terms p{margin-top:8px;line-height:1.5;}' +
      '.hpc-terms a{color:#40E0CF;}' +
      '.hpc-btn-danger{background:rgba(220,60,60,0.16);border-color:rgba(220,60,60,0.5);color:#ff9d9d;}' +
      '.hpc-btn-danger:hover,.hpc-btn-danger:focus-visible{background:rgba(220,60,60,0.28);}' +
      '.hpc-remove-link{color:rgba(255,255,255,0.55);}' +
      '.hpc-error{background:rgba(220,60,60,0.18);border:1px solid rgba(220,60,60,0.4);' +
      'border-radius:8px;padding:10px 12px;font-size:13px;margin-bottom:14px;}' +
      '.hpc-success-photo{width:120px;height:120px;border-radius:50%;overflow:hidden;margin:0 auto 16px;' +
      'border:3px solid #40E0CF;}' +
      '.hpc-success-photo img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.hpc-visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);}';
    document.head.appendChild(style);
  }

  function svgCamera() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>' +
      '<circle cx="12" cy="13" r="4"/></svg>';
  }

  // ── Focus trap ──────────────────────────────────────────────────────────
  // Not copied from ios-install-banner.js — that one doesn't have this.
  // A genuine multi-step form needs real Tab-cycling, not just initial
  // focus placement.
  function trapFocus(container) {
    function focusable() {
      // tabIndex (the JS property, not the string attribute) correctly
      // reflects the effective value — required because `input` etc. are
      // matched unconditionally by the selector below regardless of any
      // tabindex="-1" they carry (the hidden file inputs rely on exactly
      // that to stay out of the cycle); a selector-only `:not([tabindex=
      // "-1"])` clause would only ever apply to the generic [tabindex]
      // fallback case, not to the named-tag matches.
      return Array.prototype.slice.call(
        container.querySelectorAll('button, [href], input, select, textarea, [tabindex]')
      ).filter(function (el) { return !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null; });
    }
    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        container.dispatchEvent(new CustomEvent('hpc:close'));
        return;
      }
      if (e.key !== 'Tab') return;
      var items = focusable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', onKeydown);
    return function untrap() { container.removeEventListener('keydown', onKeydown); };
  }

  // Shared between init() (wiring the trigger's own load/error listeners)
  // and the delete flow in openModal() (which clears photoImg.src
  // directly via removeAttribute — that fires neither a 'load' nor an
  // 'error' event, so the trigger label needs an explicit refresh call,
  // not just event listeners).
  function refreshPhotoTrigger(photoImg) {
    var trigger = photoImg.parentElement && photoImg.parentElement.querySelector('.hpc-trigger');
    if (!trigger) return;
    var hasPhoto = !!photoImg.src && !photoImg.dataset.errored;
    trigger.classList.toggle('hpc-has-photo', hasPhoto);
    trigger.innerHTML = hasPhoto
      ? svgCamera()
      : svgCamera() + '<span>Add your<br>photo</span>';
    trigger.setAttribute('aria-label', hasPhoto ? 'Change your photo' : 'Add your photo');
  }

  function init(opts) {
    opts = opts || {};
    var photoEl = document.getElementById('hero-photo');
    var photoImg = document.getElementById('hero-photo-img');
    if (!photoEl || !photoImg) return;

    injectStyles();
    photoEl.hidden = false;

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'hpc-trigger';
    photoImg.addEventListener('load', function () { photoImg.dataset.errored = ''; refreshPhotoTrigger(photoImg); });
    photoImg.addEventListener('error', function () { photoImg.dataset.errored = '1'; refreshPhotoTrigger(photoImg); });
    photoEl.appendChild(trigger);
    refreshPhotoTrigger(photoImg);

    trigger.addEventListener('click', function () { openModal(opts, photoImg); });
  }

  function openModal(opts, photoImg) {
    if (document.querySelector('.hpc-overlay')) return; // already open

    var previouslyFocused = document.activeElement;
    var overlay = document.createElement('div');
    overlay.className = 'hpc-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'hpc-title');

    var dialog = document.createElement('div');
    dialog.className = 'hpc-dialog';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    var untrap = trapFocus(overlay);
    function close() {
      untrap();
      overlay.classList.remove('is-visible');
      document.body.style.overflow = previousOverflow;
      setTimeout(function () { overlay.remove(); }, 250);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    }
    overlay.addEventListener('hpc:close', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    requestAnimationFrame(function () { overlay.classList.add('is-visible'); });

    renderChooseStep();

    function hasExistingPhoto() {
      return !!photoImg.src && !photoImg.dataset.errored;
    }

    function renderChooseStep() {
      var removeBtnHtml = hasExistingPhoto()
        ? '<button type="button" class="hpc-btn-text hpc-remove-link" id="hpc-remove">Remove my photo</button>'
        : '';
      dialog.innerHTML =
        '<button type="button" class="hpc-close" aria-label="Close">&#10005;</button>' +
        '<p id="hpc-title" class="hpc-title">Add your photo</p>' +
        '<p class="hpc-consent">Your photo will appear on your graduation guide and any link you share from it.</p>' +
        '<details class="hpc-terms"><summary>Terms &amp; removing your photo</summary>' +
        '<p>You can remove your photo at any time using the "Remove my photo" option in this menu. ' +
        'For any other questions, contact <a href="mailto:photo-abuse@harpoon.productions">photo-abuse@harpoon.productions</a>.</p>' +
        '</details>' +
        '<button type="button" class="hpc-btn hpc-btn-primary" id="hpc-camera">Take a photo</button>' +
        '<button type="button" class="hpc-btn" id="hpc-library">Choose from library</button>' +
        removeBtnHtml +
        '<input type="file" accept="image/*" capture="user" class="hpc-visually-hidden" id="hpc-file-camera" tabindex="-1" aria-hidden="true">' +
        '<input type="file" accept="image/*" class="hpc-visually-hidden" id="hpc-file-library" tabindex="-1" aria-hidden="true">';
      wireCloseButton();

      var fileCamera = dialog.querySelector('#hpc-file-camera');
      var fileLibrary = dialog.querySelector('#hpc-file-library');
      dialog.querySelector('#hpc-camera').addEventListener('click', function () { fileCamera.click(); });
      dialog.querySelector('#hpc-library').addEventListener('click', function () { fileLibrary.click(); });
      fileCamera.addEventListener('change', handleFileChosen);
      fileLibrary.addEventListener('change', handleFileChosen);

      var removeBtn = dialog.querySelector('#hpc-remove');
      if (removeBtn) removeBtn.addEventListener('click', renderConfirmRemoveStep);

      dialog.querySelector('#hpc-camera').focus();
    }

    function renderConfirmRemoveStep() {
      dialog.innerHTML =
        '<button type="button" class="hpc-close" aria-label="Close">&#10005;</button>' +
        '<p id="hpc-title" class="hpc-title">Remove your photo?</p>' +
        '<p class="hpc-consent">This removes your photo from your guide and any link you’ve already shared. This can’t be undone.</p>' +
        '<button type="button" class="hpc-btn hpc-btn-danger" id="hpc-confirm-remove">Remove my photo</button>' +
        '<button type="button" class="hpc-btn-text" id="hpc-cancel-remove">Cancel</button>';
      wireCloseButton();
      dialog.querySelector('#hpc-cancel-remove').addEventListener('click', renderChooseStep);
      dialog.querySelector('#hpc-confirm-remove').addEventListener('click', doRemove);
      dialog.querySelector('#hpc-cancel-remove').focus();
    }

    function doRemove() {
      dialog.innerHTML =
        '<p id="hpc-title" class="hpc-title">Removing&hellip;</p>' +
        '<p class="hpc-hint" role="status">Please wait.</p>';

      var body = new URLSearchParams({
        projectId: opts.projectId || '',
        studentName: opts.studentName || '',
        ceremonyId: opts.ceremonyId || '',
        editToken: opts.editToken || '',
      });

      fetch(DELETE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
        .then(function (res) {
          return res.json().then(function (data) { return { status: res.status, data: data }; });
        })
        .then(function (result) {
          if (result.status !== 200 || !result.data || !result.data.ok) {
            var message = (result.data && result.data.error) || 'Could not remove your photo — please try again.';
            renderErrorStep(message, renderChooseStep);
            return;
          }
          photoImg.onerror = null;
          photoImg.removeAttribute('src');
          photoImg.dataset.errored = '1';
          refreshPhotoTrigger(photoImg);
          // The "About this photo" badge (js/graduation-guide-runtime.js)
          // only makes sense while a photo is actually showing — remove
          // it along with the photo rather than leave it pointing at
          // nothing.
          var infoBadge = photoImg.parentElement && photoImg.parentElement.parentElement &&
            photoImg.parentElement.parentElement.querySelector('.gg-photo-info-badge');
          var infoPopover = photoImg.parentElement && photoImg.parentElement.parentElement &&
            photoImg.parentElement.parentElement.querySelector('.gg-photo-info-popover');
          if (infoBadge) infoBadge.remove();
          if (infoPopover) infoPopover.remove();
          if (typeof opts.onRemoved === 'function') opts.onRemoved();
          close();
        })
        .catch(function () {
          renderErrorStep('Could not reach the upload service — check your connection and try again.', renderChooseStep);
        });
    }

    function handleFileChosen(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        renderChooseStep();
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { renderCropStep(img, file, url); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        renderErrorStep('Could not read that photo — please try a different one.', renderChooseStep);
      };
      img.src = url;
    }

    function renderCropStep(img, file, objectUrl) {
      dialog.innerHTML =
        '<button type="button" class="hpc-close" aria-label="Close">&#10005;</button>' +
        '<p id="hpc-title" class="hpc-title">Position your photo</p>' +
        '<div class="hpc-crop-viewport" id="hpc-viewport" tabindex="0" ' +
        'role="application" aria-label="Drag to reposition, or use arrow keys. Use the buttons below to zoom.">' +
        '</div>' +
        '<div class="hpc-zoom-row">' +
        '<button type="button" class="hpc-zoom-btn" id="hpc-zoom-out" aria-label="Zoom out">&#8722;</button>' +
        '<button type="button" class="hpc-zoom-btn" id="hpc-zoom-in" aria-label="Zoom in">&#43;</button>' +
        '</div>' +
        '<p class="hpc-hint">Drag or use arrow keys to reposition &middot; use the buttons to zoom</p>' +
        '<button type="button" class="hpc-btn hpc-btn-primary" id="hpc-confirm">Use this photo</button>' +
        '<button type="button" class="hpc-btn-text" id="hpc-as-is">Use photo as-is instead</button>' +
        '<button type="button" class="hpc-btn-text" id="hpc-retake">Choose a different photo</button>';
      wireCloseButton();

      var viewport = dialog.querySelector('#hpc-viewport');
      viewport.appendChild(img);

      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      var baseScale = VIEWPORT_SIZE / Math.min(iw, ih);
      var zoom = ZOOM_MIN;
      var fracX = 0;
      var fracY = 0;

      function apply() {
        var displayedW = iw * baseScale * zoom;
        var displayedH = ih * baseScale * zoom;
        img.style.width = displayedW + 'px';
        img.style.height = displayedH + 'px';
        var maxOffsetX = Math.max(0, (displayedW - VIEWPORT_SIZE) / 2);
        var maxOffsetY = Math.max(0, (displayedH - VIEWPORT_SIZE) / 2);
        var offsetX = fracX * maxOffsetX;
        var offsetY = fracY * maxOffsetY;
        img.style.transform = 'translate(calc(-50% + ' + offsetX + 'px), calc(-50% + ' + offsetY + 'px))';
        img._hpcState = { iw: iw, ih: ih, baseScale: baseScale, zoom: zoom, offsetX: offsetX, offsetY: offsetY };
      }
      apply();

      dialog.querySelector('#hpc-zoom-in').addEventListener('click', function () {
        zoom = Math.min(ZOOM_MAX, zoom + ZOOM_STEP);
        apply();
      });
      dialog.querySelector('#hpc-zoom-out').addEventListener('click', function () {
        zoom = Math.max(ZOOM_MIN, zoom - ZOOM_STEP);
        apply();
      });

      // Drag (pointer events — unifies mouse + touch).
      var dragging = false;
      var startX, startY, startFracX, startFracY;
      viewport.addEventListener('pointerdown', function (e) {
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startFracX = fracX; startFracY = fracY;
        viewport.setPointerCapture(e.pointerId);
      });
      viewport.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var displayedW = iw * baseScale * zoom;
        var displayedH = ih * baseScale * zoom;
        var maxOffsetX = Math.max(0, (displayedW - VIEWPORT_SIZE) / 2);
        var maxOffsetY = Math.max(0, (displayedH - VIEWPORT_SIZE) / 2);
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        fracX = maxOffsetX ? clamp(startFracX + dx / maxOffsetX, -1, 1) : 0;
        fracY = maxOffsetY ? clamp(startFracY + dy / maxOffsetY, -1, 1) : 0;
        apply();
      });
      viewport.addEventListener('pointerup', function () { dragging = false; });
      viewport.addEventListener('pointercancel', function () { dragging = false; });

      // Keyboard nudging — required accessible equivalent to drag, not a
      // bonus. Arrow keys move the crop; zoom already has its own buttons.
      viewport.addEventListener('keydown', function (e) {
        var moved = true;
        if (e.key === 'ArrowLeft') fracX = clamp(fracX - NUDGE_STEP, -1, 1);
        else if (e.key === 'ArrowRight') fracX = clamp(fracX + NUDGE_STEP, -1, 1);
        else if (e.key === 'ArrowUp') fracY = clamp(fracY - NUDGE_STEP, -1, 1);
        else if (e.key === 'ArrowDown') fracY = clamp(fracY + NUDGE_STEP, -1, 1);
        else moved = false;
        if (moved) { e.preventDefault(); apply(); }
      });

      dialog.querySelector('#hpc-confirm').addEventListener('click', function () {
        exportCrop(img);
      });
      // Required accessible fallback — always available, never gated
      // behind successfully performing a drag/zoom gesture.
      dialog.querySelector('#hpc-as-is').addEventListener('click', function () {
        fracX = 0; fracY = 0; zoom = ZOOM_MIN; apply();
        exportCrop(img);
      });
      dialog.querySelector('#hpc-retake').addEventListener('click', function () {
        URL.revokeObjectURL(objectUrl);
        renderChooseStep();
      });

      viewport.focus();
    }

    function exportCrop(img) {
      var s = img._hpcState;
      var canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      var ctx = canvas.getContext('2d');
      var k = OUTPUT_SIZE / VIEWPORT_SIZE;
      var displayedW = s.iw * s.baseScale * s.zoom;
      var displayedH = s.ih * s.baseScale * s.zoom;
      var dw = displayedW * k;
      var dh = displayedH * k;
      var dx = ((VIEWPORT_SIZE - displayedW) / 2 + s.offsetX) * k;
      var dy = ((VIEWPORT_SIZE - displayedH) / 2 + s.offsetY) * k;
      ctx.drawImage(img, dx, dy, dw, dh);
      canvas.toBlob(function (blob) {
        if (!blob) {
          renderErrorStep('Could not process this photo — please try again.', renderChooseStep);
          return;
        }
        uploadBlob(blob);
      }, 'image/jpeg', 0.9);
    }

    function uploadBlob(blob) {
      renderUploadingStep();
      // The upload service can be slow to answer its very first request of
      // the day (host spins back up from idle) — without this, a genuinely
      // slow-but-working upload looks identical to a stuck one.
      var slowHintTimer = setTimeout(function () {
        var hint = document.getElementById('hpc-uploading-hint');
        if (hint) hint.textContent = 'Still working — this can take a little longer than usual.';
      }, 6000);

      var form = new FormData();
      form.append('projectId', opts.projectId || '');
      form.append('studentName', opts.studentName || '');
      form.append('ceremonyId', opts.ceremonyId || '');
      form.append('editToken', opts.editToken || '');
      form.append('photo', blob, 'photo.jpg');

      fetch(UPLOAD_ENDPOINT, { method: 'POST', body: form })
        .then(function (res) {
          return res.json().then(function (data) { return { status: res.status, data: data }; });
        })
        .then(function (result) {
          clearTimeout(slowHintTimer);
          if (result.status !== 200 || !result.data || !result.data.ok) {
            var message = (result.data && result.data.error) || 'Upload failed — please try again.';
            // Temporary: surfaces exactly what this device actually sent,
            // so a failure can be diagnosed from a screenshot alone —
            // real-world testing hit a case (same "invalid or expired
            // edit link" error, on a confirmed-fresh device/cache) that
            // couldn't be reproduced remotely despite the exact same
            // token validating correctly server-side. Remove once that's
            // root-caused.
            renderErrorStep(message, renderChooseStep, {
              endpoint: UPLOAD_ENDPOINT,
              projectId: opts.projectId,
              studentName: opts.studentName,
              ceremonyId: opts.ceremonyId,
              editToken: opts.editToken,
              status: result.status,
            });
            return;
          }
          // Cache-bust: this session's own <img> may already have this
          // exact URL as its src (re-upload replacing an existing photo),
          // and browsers treat re-assigning an unchanged src as a no-op —
          // no request fires, so the old photo just sits there. A unique
          // query string forces a real fetch of what was just uploaded.
          renderSuccessStep(result.data.url + '?v=' + Date.now());
        })
        .catch(function (err) {
          clearTimeout(slowHintTimer);
          renderErrorStep('Could not reach the upload service — check your connection and try again.', renderChooseStep, {
            endpoint: UPLOAD_ENDPOINT,
            fetchError: err && err.message,
          });
        });
    }

    function renderUploadingStep() {
      dialog.innerHTML =
        '<p id="hpc-title" class="hpc-title">Uploading&hellip;</p>' +
        '<div class="hpc-spinner" aria-hidden="true"></div>' +
        '<p class="hpc-hint" role="status" id="hpc-uploading-hint">Please wait while your photo uploads.</p>';
    }

    function renderErrorStep(message, retryRender, detail) {
      var detailHtml = '';
      if (detail) {
        var lines = Object.keys(detail)
          .filter(function (k) { return detail[k] !== undefined && detail[k] !== null; })
          .map(function (k) { return escapeHtml(k) + ': ' + escapeHtml(String(detail[k])); });
        detailHtml = '<p class="hpc-hint" style="text-align:left;word-break:break-all;">' + lines.join('<br>') + '</p>';
      }
      dialog.innerHTML =
        '<button type="button" class="hpc-close" aria-label="Close">&#10005;</button>' +
        '<p id="hpc-title" class="hpc-title">Something went wrong</p>' +
        '<p class="hpc-error" role="alert">' + escapeHtml(message) + '</p>' +
        detailHtml +
        '<button type="button" class="hpc-btn hpc-btn-primary" id="hpc-try-again">Try again</button>';
      wireCloseButton();
      dialog.querySelector('#hpc-try-again').addEventListener('click', retryRender);
      dialog.querySelector('#hpc-try-again').focus();
    }

    function renderSuccessStep(url) {
      if (photoImg) {
        photoImg.dataset.errored = '';
        photoImg.src = url;
      }
      if (typeof opts.onUploaded === 'function') opts.onUploaded(url);

      dialog.innerHTML =
        '<button type="button" class="hpc-close" aria-label="Close">&#10005;</button>' +
        '<p id="hpc-title" class="hpc-title">You&rsquo;re all set!</p>' +
        '<div class="hpc-success-photo"><img src="' + url + '" alt=""></div>' +
        (opts.shareUrl
          ? '<button type="button" class="hpc-btn hpc-btn-primary" id="hpc-share">Share with family &amp; friends</button>'
          : '') +
        '<button type="button" class="hpc-btn" id="hpc-done">Done</button>';
      wireCloseButton();

      var shareBtn = dialog.querySelector('#hpc-share');
      if (shareBtn) {
        shareBtn.addEventListener('click', function () {
          if (navigator.share) {
            navigator.share({ title: document.title, text: 'See my guide', url: opts.shareUrl })
              .catch(function () { prompt('Copy link:', opts.shareUrl); });
          } else {
            prompt('Copy link:', opts.shareUrl);
          }
        });
        shareBtn.focus();
      } else {
        dialog.querySelector('#hpc-done').focus();
      }
      dialog.querySelector('#hpc-done').addEventListener('click', close);
    }

    function wireCloseButton() {
      var btn = dialog.querySelector('.hpc-close');
      if (btn) btn.addEventListener('click', close);
    }
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.HarpoonPhotoCapture = { init: init };
})(window);
