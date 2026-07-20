/*
 * pwa-ios-install-banner.js — Harpoon Platform Core (Tier 1)
 *
 * iOS has no install prompt API at all — no beforeinstallprompt event,
 * no JS way to trigger "Add to Home Screen" (true across every iOS
 * browser, not just Safari — they're all WebKit under Apple's rules).
 * The only thing a site can do is tell the user how, manually. This is
 * that: a small, self-contained, dismissible banner. Injects its own
 * styles — no separate CSS file to vendor or link.
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
      '.hse-ios-install-banner{position:fixed;left:12px;right:12px;bottom:12px;' +
      'bottom:calc(12px + env(safe-area-inset-bottom));z-index:3000;' +
      'background:#1a1a1a;color:#fff;border-radius:10px;padding:12px 14px;' +
      'display:flex;align-items:center;gap:10px;box-shadow:0 6px 24px rgba(0,0,0,0.3);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;' +
      'font-size:13px;line-height:1.4;opacity:0;transform:translateY(12px);' +
      'transition:opacity 0.25s ease,transform 0.25s ease;}' +
      '.hse-ios-install-banner.is-visible{opacity:1;transform:translateY(0);}' +
      '.hse-ios-install-banner__text{flex:1;}' +
      '.hse-ios-install-banner__share-icon{vertical-align:-3px;margin:0 1px;}' +
      '.hse-ios-install-banner__close{background:none;border:none;color:rgba(255,255,255,0.7);' +
      'font-size:15px;cursor:pointer;padding:4px;flex-shrink:0;line-height:1;}' +
      '.hse-ios-install-banner__close:hover{color:#fff;}';
    document.head.appendChild(style);
  }

  function maybeShowIOSInstallBanner(opts) {
    opts = opts || {};
    if (!isIos() || isStandalone()) return;
    if (wasDismissedRecently(opts.snoozeDays || 7)) return;
    if (document.querySelector('.hse-ios-install-banner')) return; // already showing

    injectStyles();

    var banner = document.createElement('div');
    banner.className = 'hse-ios-install-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<span class="hse-ios-install-banner__text">' +
      (opts.message || 'Install this on your phone') +
      ' — tap <svg class="hse-ios-install-banner__share-icon" viewBox="0 0 24 24" width="15" height="15" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-label="Share"><path d="M12 2v13M8 6l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>' +
      ' then "Add to Home Screen"</span>' +
      '<button type="button" class="hse-ios-install-banner__close" aria-label="Dismiss">&#10005;</button>';

    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('is-visible'); });

    banner.querySelector('.hse-ios-install-banner__close').addEventListener('click', function () {
      banner.classList.remove('is-visible');
      remember();
      setTimeout(function () { banner.remove(); }, 300);
    });
  }

  global.HarpoonPWA = global.HarpoonPWA || {};
  global.HarpoonPWA.maybeShowIOSInstallBanner = maybeShowIOSInstallBanner;
})(window);
