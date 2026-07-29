/*
 * pwa-ios-install-banner.js — Harpoon Platform Core (Tier 1)
 *
 * iOS has no install prompt API at all — no beforeinstallprompt event,
 * no JS way to trigger "Add to Home Screen" (true across every iOS
 * browser, not just Safari — they're all WebKit under Apple's rules).
 * The only thing a site can do is tell the user how, manually. This is
 * that: a full-screen, blurred-backdrop takeover — deliberately hard to
 * miss or scroll past, not a small toast. Injects its own styles — no
 * separate CSS file to vendor or link.
 *
 * There's also no completion event — iOS never tells a page that the
 * user actually finished "Add to Home Screen" (they leave Safari for the
 * share sheet and may or may not come back to this same tab). So "until
 * installed" isn't something this can detect live: the overlay stays up
 * until the visitor dismisses it. What genuinely does resolve on its own
 * is any *future* visit — once actually installed, isStandalone() below
 * is true and this never shows again, launched from the home screen icon
 * or reopened in Safari.
 *
 * Generic — not graduation-guide or any-product-specific. A consuming
 * page decides WHEN to call maybeShowIOSInstallBanner() (immediately,
 * after some engagement signal, tied to a personalised moment, etc.);
 * this module only handles whether it's appropriate to show at all
 * (iOS, not already installed, not recently dismissed) and the UI itself.
 *
 * Usage: HarpoonPWA.maybeShowIOSInstallBanner({ message, snoozeDays })
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'hse-ios-install-banner-style';
  var STORAGE_KEY = 'hse-ios-install-dismissed';

  function isIos() {
    // iPadOS 13+ reports as "MacIntel" in the UA — touch points is the
    // only reliable way left to tell it apart from a real Mac.
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  function wasDismissedRecently(days) {
    try {
      var dismissedAt = localStorage.getItem(STORAGE_KEY);
      if (!dismissedAt) return false;
      var elapsedDays = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      return elapsedDays < days;
    } catch (e) {
      return false; // localStorage unavailable (e.g. private mode) — fail open
    }
  }

  function remember() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      // Full-screen backdrop — blurs and blocks interaction with
      // everything behind it until the card is dismissed.
      '.hse-ios-install-overlay{position:fixed;inset:0;z-index:3000;' +
      'display:flex;align-items:center;justify-content:center;' +
      'padding:24px;padding:calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));' +
      'background:rgba(10,10,10,0.65);' +
      '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);' +
      'opacity:0;transition:opacity 0.3s ease;}' +
      '.hse-ios-install-overlay.is-visible{opacity:1;}' +
      // Centred card — the actual message.
      '.hse-ios-install-banner{position:relative;width:100%;max-width:480px;' +
      'background:#1a1a1a;color:#fff;border-radius:22px;padding:44px 30px;' +
      'text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.5);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;' +
      'transform:scale(0.92);transition:transform 0.3s ease;}' +
      '.hse-ios-install-overlay.is-visible .hse-ios-install-banner{transform:scale(1);}' +
      '.hse-ios-install-banner__text{font-size:36px;line-height:1.25;font-weight:700;}' +
      '.hse-ios-install-banner__share-icon{vertical-align:-6px;margin:0 4px;}' +
      '.hse-ios-install-banner__close{position:absolute;top:10px;right:10px;' +
      'background:none;border:none;color:rgba(255,255,255,0.65);' +
      'font-size:24px;cursor:pointer;padding:10px;line-height:1;}' +
      '.hse-ios-install-banner__close:hover{color:#fff;}';
    document.head.appendChild(style);
  }

  function maybeShowIOSInstallBanner(opts) {
    opts = opts || {};
    if (!isIos() || isStandalone()) return;
    if (wasDismissedRecently(opts.snoozeDays || 7)) return;
    if (document.querySelector('.hse-ios-install-overlay')) return; // already showing

    injectStyles();

    var overlay = document.createElement('div');
    overlay.className = 'hse-ios-install-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="hse-ios-install-banner">' +
      '<button type="button" class="hse-ios-install-banner__close" aria-label="Dismiss">&#10005;</button>' +
      '<p class="hse-ios-install-banner__text">' +
      (opts.message || 'Install this on your phone') +
      ' — tap <svg class="hse-ios-install-banner__share-icon" viewBox="0 0 24 24" width="30" height="30" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-label="Share"><path d="M12 2v13M8 6l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>' +
      ' then "Add to Home Screen"</p>' +
      '</div>';

    document.body.appendChild(overlay);

    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(function () { overlay.classList.add('is-visible'); });

    var closeBtn = overlay.querySelector('.hse-ios-install-banner__close');
    closeBtn.focus();
    closeBtn.addEventListener('click', function () {
      overlay.classList.remove('is-visible');
      remember();
      document.body.style.overflow = previousOverflow;
      setTimeout(function () { overlay.remove(); }, 300);
    });
  }

  global.HarpoonPWA = global.HarpoonPWA || {};
  global.HarpoonPWA.maybeShowIOSInstallBanner = maybeShowIOSInstallBanner;
})(window);
