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
 * after some engagement signal, tied to a personalised moment, etc.) and
 * MAY pass its own logo/title for brand trust (someone is being asked to
 * install something before they know it's legitimate); this module only
 * handles whether it's appropriate to show at all (iOS, not already
 * installed, not recently dismissed) and the UI itself. logo/title/steps
 * are all optional — a consumer that passes none still gets a working,
 * generic banner.
 *
 * The three-step instructions default to current iOS Safari (verified
 * against a real device, 2026-07-30 — Apple has changed this wording/UI
 * before and will again, so if a future iOS version moves the "Add to
 * Home Screen" entry point, update the default `steps` array here, not
 * per-consumer).
 *
 * Usage: HarpoonPWA.maybeShowIOSInstallBanner({ message, logo, logoAlt, title, steps, snoozeDays, autoDismissMs })
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'hse-ios-install-banner-style';
  var STORAGE_KEY = 'hse-ios-install-dismissed';

  var DEFAULT_STEPS = [
    'Tap <strong>&bull;&bull;&bull;</strong> in the toolbar',
    'Tap <strong>Share</strong> <svg class="hse-ios-install-banner__share-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v13M8 6l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
    'Choose <strong>&ldquo;Add to Home Screen&rdquo;</strong>',
  ];

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
      '.hse-ios-install-banner{position:relative;width:100%;max-width:420px;' +
      'background:#1a1a1a;color:#fff;border-radius:22px;padding:36px 28px;' +
      'text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.5);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;' +
      'transform:scale(0.92);transition:transform 0.3s ease;}' +
      '.hse-ios-install-overlay.is-visible .hse-ios-install-banner{transform:scale(1);}' +
      // Brand trust — shown before anything else asks for an install
      // action, so it reads as coming from a real institution/product,
      // not an unknown page. Both optional; a consumer that skips them
      // just gets the message straight away.
      '.hse-ios-install-banner__logo{display:block;max-width:120px;max-height:40px;' +
      'width:auto;height:auto;margin:0 auto 12px;}' +
      '.hse-ios-install-banner__title{font-size:13px;font-weight:700;letter-spacing:0.06em;' +
      'text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:18px;}' +
      '.hse-ios-install-banner__message{font-size:21px;line-height:1.3;font-weight:700;margin-bottom:22px;}' +
      '.hse-ios-install-banner__steps{text-align:left;display:inline-block;' +
      'font-size:15px;line-height:1.5;margin:0;padding:0;list-style:none;counter-reset:hse-step;}' +
      '.hse-ios-install-banner__steps li{position:relative;padding-left:28px;margin-bottom:10px;' +
      'counter-increment:hse-step;}' +
      '.hse-ios-install-banner__steps li:last-child{margin-bottom:0;}' +
      '.hse-ios-install-banner__steps li::before{content:counter(hse-step);position:absolute;left:0;top:1px;' +
      'width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.16);' +
      'font-size:11px;font-weight:700;line-height:18px;text-align:center;}' +
      '.hse-ios-install-banner__share-icon{vertical-align:-3px;margin:0 1px;}' +
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

    var logoHtml = opts.logo
      ? '<img class="hse-ios-install-banner__logo" src="' + opts.logo + '" alt="' + (opts.logoAlt || opts.title || '') + '">'
      : '';
    var titleHtml = opts.title
      ? '<p class="hse-ios-install-banner__title">' + opts.title + '</p>'
      : '';
    var steps = opts.steps || DEFAULT_STEPS;
    var stepsHtml = '<ol class="hse-ios-install-banner__steps">' +
      steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') +
      '</ol>';

    var overlay = document.createElement('div');
    overlay.className = 'hse-ios-install-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="hse-ios-install-banner">' +
      '<button type="button" class="hse-ios-install-banner__close" aria-label="Dismiss">&#10005;</button>' +
      logoHtml + titleHtml +
      '<p class="hse-ios-install-banner__message">' + (opts.message || 'Install this on your phone') + '</p>' +
      stepsHtml +
      '</div>';

    document.body.appendChild(overlay);

    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(function () { overlay.classList.add('is-visible'); });

    var autoDismissTimer = null;
    function hide() {
      clearTimeout(autoDismissTimer);
      overlay.classList.remove('is-visible');
      remember();
      document.body.style.overflow = previousOverflow;
      setTimeout(function () { overlay.remove(); }, 300);
    }

    var closeBtn = overlay.querySelector('.hse-ios-install-banner__close');
    closeBtn.focus();
    closeBtn.addEventListener('click', hide);

    // Auto-dismiss rather than block indefinitely — someone who doesn't
    // know what to do with it has read it (or not) well within this, and
    // shouldn't be stuck behind a blurred page for longer than that.
    // 20s (up from an earlier 12s) — real device testing showed 12s
    // wasn't enough time to read three steps, realise what's being
    // asked, and act, not just skim the first line.
    // 0 (or any falsy value) disables this and requires an explicit tap.
    var autoDismissMs = opts.autoDismissMs === 0 ? 0 : (opts.autoDismissMs || 20000);
    if (autoDismissMs) autoDismissTimer = setTimeout(hide, autoDismissMs);
  }

  global.HarpoonPWA = global.HarpoonPWA || {};
  global.HarpoonPWA.maybeShowIOSInstallBanner = maybeShowIOSInstallBanner;
})(window);
