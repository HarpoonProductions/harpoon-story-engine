'use strict';

const { escHtml, resolveTokenStyle, renderPlausibleScript, parseVideoUrl } = require('../shell/head');
const { buildPwaHeadTags } = require('../pwa');
const { buildDropdown, buildDropdownItems, buildTopNavLinks, buildCeremonyDropdown, buildCeremonyLinks } = require('../shell/group-nav');

/**
 * Renders a content.kind === "graduation-guide" document to a full HTML
 * page. Pure function — same contract as a layout renderer (content, opts)
 * -> HTML string — but builds its own <head>/<body> shell rather than going
 * through renderHead/renderNav, which are narrative-section-shaped.
 *
 * Ceremony/chooser/names markup is built here, at render time, as static
 * HTML with data-* hooks; all interactivity (chooser switching, search,
 * share, deep-linking) is wired client-side by js/graduation-guide-runtime.js
 * against this static markup, the same division of labour HSE's own
 * toggle-panels/accordion blocks use with js/runtime.js.
 *
 * @param {object} content - validated graduation-guide content object
 * @param {object} [opts]
 * @param {string} [opts.basePath] - root-relative base path for S3/CloudFront
 * @param {Array}  [opts.groupMembers] - resolved via renderer/groups.js from meta.group_id,
 *   siblings only (this project already excluded). Drives the "Explore more" dropdown
 *   and the standalone top-nav link(s) — see buildExploreLinks().
 * @returns {string} full HTML document
 */
function renderGraduationGuide(content, opts) {
  opts = opts || {};
  const { meta, config, institution, guide, ceremonies, searchIndex, studentPhotos } = content;
  const groupMembers = opts.groupMembers || [];
  const base = opts.basePath
    ? '/' + opts.basePath.replace(/^\//, '').replace(/\/$/, '')
    : '';
  const asset = (file) => (base ? `${base}/${file}` : file);

  // Resolved through asset() here, at render time, so the client-side
  // lookup in js/graduation-guide-runtime.js never needs to know about
  // basePath itself — same treatment institution.icons already gets.
  const resolvedStudentPhotos = {};
  Object.keys(studentPhotos || {}).forEach((key) => {
    resolvedStudentPhotos[key] = asset(studentPhotos[key]);
  });

  const head = buildHead(meta, config, institution, base, asset);
  const body = buildBody(institution, guide, ceremonies, asset, groupMembers, config);
  // institution.logo is otherwise passed through unresolved (server-side
  // rendering already resolves it directly via buildWordmark) — resolved
  // here too so the client-side iOS install banner (which needs an
  // absolute-enough URL, not a bare relative path) can use it without
  // needing to know about basePath itself. Same treatment as studentPhotos.
  const resolvedInstitution = { ...institution, logo: institution.logo ? resolveMediaUrl(institution.logo, asset) : institution.logo };
  const dataScript = buildDataScript({ projectId: meta.project_id, institution: resolvedInstitution, guide, ceremonies, searchIndex, studentPhotos: resolvedStudentPhotos });

  return `<!DOCTYPE html>
<html lang="en">
${head}
<body>
${buildDemoGateScript(config?.demoPassword)}
${body}
${dataScript}
<script defer src="${asset('js/graduation-guide-runtime.js')}"></script>
</body>
</html>`;
}

// ── Demo-link password gate (client-side only, opt-in via config.demoPassword) ──
// NOT real security — the page is fully downloaded to the browser either
// way, this only stops casual browsing to a pre-launch demo URL. The style
// tag hides <html> synchronously, before body ever paints; the script (top
// of body, see renderGraduationGuide) either removes it immediately (already
// unlocked, this browser) or shows a password prompt that removes it on a
// correct entry. Absent config.demoPassword = both functions return '' and
// every other project renders exactly as before.

function buildDemoGateStyle(demoPassword) {
  if (!demoPassword) return '';
  return '<style id="gg-gate-style">html{visibility:hidden}</style>';
}

function buildDemoGateScript(demoPassword) {
  if (!demoPassword) return '';
  return `<script>
(function () {
  var PASSWORD = ${JSON.stringify(demoPassword)};
  var KEY = 'gg-demo-pw-ok';
  var gateStyle = document.getElementById('gg-gate-style');
  function reveal() { if (gateStyle) gateStyle.remove(); }
  try {
    if (localStorage.getItem(KEY) === '1') { reveal(); return; }
  } catch (e) { reveal(); return; }

  var overlay = document.createElement('div');
  overlay.id = 'gg-gate-overlay';
  overlay.innerHTML =
    '<style>' +
    '#gg-gate-overlay{visibility:visible;position:fixed;inset:0;z-index:99999;' +
    'display:flex;align-items:center;justify-content:center;' +
    'background:#161a1d;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;}' +
    '#gg-gate-card{width:100%;max-width:320px;padding:0 24px;text-align:center;}' +
    '#gg-gate-card p{color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:16px;}' +
    '#gg-gate-input{width:100%;padding:12px 14px;font-size:16px;border-radius:8px;' +
    'border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.08);color:#fff;' +
    'text-align:center;outline:none;margin-bottom:12px;box-sizing:border-box;}' +
    '#gg-gate-input::placeholder{color:rgba(255,255,255,0.4);}' +
    '#gg-gate-btn{width:100%;padding:12px;font-size:15px;font-weight:700;border-radius:8px;' +
    'border:none;background:#fff;color:#161a1d;cursor:pointer;}' +
    '#gg-gate-error{color:#ff9d9d;font-size:13px;margin-top:10px;visibility:hidden;}' +
    '</style>' +
    '<div id="gg-gate-card">' +
    '<p>This preview is password-protected.</p>' +
    '<input type="password" id="gg-gate-input" placeholder="Password" autocomplete="off" inputmode="numeric">' +
    '<button type="button" id="gg-gate-btn">Continue</button>' +
    '<p id="gg-gate-error">Incorrect password — try again.</p>' +
    '</div>';
  document.body.appendChild(overlay);

  var input = overlay.querySelector('#gg-gate-input');
  var error = overlay.querySelector('#gg-gate-error');
  function tryUnlock() {
    if (input.value === PASSWORD) {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      overlay.remove();
      reveal();
    } else {
      error.style.visibility = 'visible';
      input.value = '';
      input.focus();
    }
  }
  overlay.querySelector('#gg-gate-btn').addEventListener('click', tryUnlock);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryUnlock(); });
  input.focus();
})();
</script>`;
}

// ── <head> ──────────────────────────────────────────────────────────────

function buildHead(meta, config, institution, base, asset) {
  const title = `${escHtml(meta.title)} | ${escHtml(institution.name)}`;
  const plausibleScript = renderPlausibleScript(config);
  const tokenSetHtml = resolveTokenStyle(meta.token_set);
  const pwaTags = buildPwaHeadTags({ enabled: !!config?.pwa?.enabled, asset });
  // Vendored locally (js/vendor/), same same-origin/offline-safe mechanism
  // the narrative kind already uses — not a CDN dependency. Only emitted
  // when a project actually opts into scrollHero, so every other project
  // pays zero extra payload for a capability it doesn't use.
  const scrollHeroScripts = config?.scrollHero?.enabled
    ? `<script defer src="${asset('js/vendor/gsap.min.js')}"></script>
  <script defer src="${asset('js/vendor/ScrollTrigger.min.js')}"></script>`
    : '';

  return `<head>
  ${buildDemoGateStyle(config?.demoPassword)}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
  <meta name="theme-color" content="${escHtml(institution.primaryColor)}">
  <title>${title}</title>
  ${plausibleScript}
  ${pwaTags}
  ${scrollHeroScripts}

  <!-- Platform Core token set (fonts/logo lookup only — colours below are this guide's own) -->
  ${tokenSetHtml}

  <link rel="stylesheet" href="${asset('css/kinds/graduation-guide.css')}">
  ${buildBrandStyle(institution, asset)}
</head>`;
}

function buildBrandStyle(institution, asset) {
  const fontFaces = (institution.fontFiles || [])
    .map((f) => `@font-face{font-family:'${escHtml(institution.fontHeading)}';font-weight:${f.weight};font-style:${f.style || 'normal'};font-display:swap;src:url('${escHtml(asset(f.file))}') format('woff2');}`)
    .join('\n    ');

  return `<style>
    ${fontFaces}
    :root{
      --gg-primary: ${escHtml(institution.primaryColor)};
      --gg-accent: ${escHtml(institution.accentColor)};
      --gg-bg: ${escHtml(institution.lightBackground || '#f0f0f0')};
      --gg-text: ${escHtml(institution.textColor || '#161a1d')};
      --gg-font-heading: '${escHtml(institution.fontHeading)}','Helvetica Neue',Arial,sans-serif;
      --gg-font-body: '${escHtml(institution.fontBody)}','Helvetica Neue',Arial,sans-serif;
      --gg-body-font-size: ${escHtml(institution.bodyFontSize || '15px')};
    }
  </style>`;
}

// ── "Explore more" nav dropdown ────────────────────────────────────────
// Links to the satellite story-kind pages that make up the rest of the
// guide "cluster" (see BRIEF.md / project memory, 2026-07-20: a graduation
// guide is this hub page plus zero or more ordinary HSE story pages).
// Membership and labels come from meta.group_id, resolved by
// renderer/groups.js and passed in as groupMembers — not hardcoded here.
// Each satellite is its own HSE project, deployed as a sibling S3 path
// (stories.har.pn/<slug>/), so links are relative — no basePath threading
// needed here, same as the ceremony ?query links above.
//
// group_role: 'top-nav' on a member (e.g. the Memories page) means it
// gets its own top-level nav link instead of a dropdown item — this
// kind's own convention, not something the group mechanism itself knows
// or cares about.

function exploreDropdownMembers(groupMembers) {
  return groupMembers.filter((m) => m.role !== 'top-nav' && m.role !== 'hub');
}

function buildExploreDropdown(groupMembers) {
  const items = exploreDropdownMembers(groupMembers).map((m) => ({ href: `../${m.project_id}/`, label: m.label }));
  return buildDropdown({ id: 'explore-more', label: 'Explore more', items });
}

function buildExploreLinks(members) {
  return buildDropdownItems(members.map((m) => ({ href: `../${m.project_id}/`, label: m.label })));
}

// ── Mobile menu (full-screen overlay, mirrors the narrative renderer's
// hse-nav__mobile-menu pattern in renderer/shell/nav.js — same division
// of a hamburger-triggered overlay, just gg-* namespaced) ─────────────

function buildMobileMenu(guide, ceremonies, groupMembers) {
  const dropdownMembers = exploreDropdownMembers(groupMembers);
  return `<div class="gg-nav-mobile-menu" id="gg-nav-mobile-menu" aria-hidden="true">
  <button class="gg-nav-mobile-close" id="gg-nav-mobile-close" aria-label="Close menu">&#10005;</button>
  <div class="gg-nav-mobile-menu__inner">
    <div class="gg-nav-mobile-group-label">Ceremony Guides</div>
    ${buildCeremonyLinks(guide.days, ceremonies, '')}
    ${dropdownMembers.length ? `<div class="gg-nav-mobile-group-label">Explore more</div>
    ${buildExploreLinks(dropdownMembers)}` : ''}
    ${buildTopNavLinks(groupMembers, 'gg-nav-dropdown-item')}
  </div>
</div>`;
}

// ── <body> ──────────────────────────────────────────────────────────────

function buildWordmark(institution, asset) {
  const label = institution.shortName || institution.name;
  const inner = institution.logo
    ? `<img class="gg-nav-logo" src="${escHtml(asset(institution.logo))}" alt="${escHtml(label)}">`
    : escHtml(label);
  return `<a class="gg-nav-wordmark" href="./">${inner}</a>`;
}

function buildBody(institution, guide, ceremonies, asset, groupMembers, config) {
  const scrollHeroEnabled = !!config?.scrollHero?.enabled;
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="gg-share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </symbol>
</svg>
<nav class="gg-nav">
  ${buildWordmark(institution, asset)}
  <div class="gg-nav-links">
    ${buildCeremonyDropdown(guide.days, ceremonies, '')}
    ${buildExploreDropdown(groupMembers)}
    ${buildTopNavLinks(groupMembers, 'gg-nav-link')}
  </div>
  <div class="gg-nav-right">
    <span class="gg-nav-search-label" id="nav-search-label">Search name:</span>
    <div class="gg-nav-search-wrap">
      <input type="text" class="gg-nav-search-input" id="nav-search-input" placeholder="Search name" autocomplete="off">
      <div class="gg-search-panel" id="nav-search-panel" role="listbox" hidden></div>
    </div>
    <button class="gg-nav-search-icon" id="nav-search-toggle" aria-label="Search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    </button>
    <button class="gg-nav-hamburger" id="gg-nav-hamburger" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>
${buildMobileMenu(guide, ceremonies, groupMembers)}

<div class="gg-floating-bar" id="floating-bar">
  <span class="gg-floating-bar-label">You are viewing</span>
  <span id="floating-bar-text"></span>
</div>

${scrollHeroEnabled ? buildScrollHero(institution, guide, asset) : buildStaticHero(guide, asset) + buildWelcomeSection(guide, asset)}
${buildAboutSection(guide, asset)}

<section class="gg-find" id="find-student">
  <h2 class="gg-find-heading">Find a graduating student</h2>
  <div class="gg-find-box">
    <div class="gg-find-label">Enter a name</div>
    <div class="gg-find-row">
      <input type="text" class="gg-find-input" id="inputField1"
             placeholder="Search name" autocomplete="off" autocorrect="off"
             autocapitalize="words" spellcheck="false">
      <div class="gg-search-panel gg-search-panel--find" id="find-search-panel" role="listbox" hidden></div>
    </div>
  </div>
</section>

<section class="gg-chooser" id="chooser">
${buildChooserHtml(guide, ceremonies)}
</section>

<div id="ceremony-sections">
${buildCeremonySectionsHtml(ceremonies, guide, asset)}
</div>

<button class="gg-return-top" id="return-top">&#8963; Return to top</button>`;
}

// ── Media helpers ────────────────────────────────────────────────────────
// All optional, all absent by default — every call site below falls back
// to the pre-existing placeholder markup (emoji icon / CSS gradient) when
// no photo/video/image is supplied, so adding these schema fields to a
// project is a zero-visual-change no-op until real assets are actually
// set. See project memory "hse-graduation-guide-media".

// Editor UI for these fields (see editor/editor.html's Guide tab) is a
// plain URL text input, same as the narrative kind's cover.hero_image —
// the natural thing to paste there is a full https:// CDN URL, not a
// project-relative path. Only resolve through asset() (which assumes a
// relative path and prefixes basePath) when the value genuinely looks
// relative; an absolute URL passes through untouched, exactly like the
// narrative kind's render-cover.js already treats cover.hero_image.url.
function resolveMediaUrl(pathOrUrl, asset) {
  return /^(https?:)?\/\//i.test(pathOrUrl) ? pathOrUrl : asset(pathOrUrl);
}

function renderPersonPhoto(photoPath, asset, altName) {
  if (!photoPath) return '&#128100;';
  return `<img src="${escHtml(resolveMediaUrl(photoPath, asset))}" alt="${escHtml(altName || '')}">`;
}

function renderBackgroundImage(image, asset) {
  if (!image || !image.url) return '';
  const focalStyle = image.focal ? ` style="object-position:${escHtml(image.focal)}"` : '';
  return `<img src="${escHtml(resolveMediaUrl(image.url, asset))}" alt="${escHtml(image.alt || '')}"${focalStyle}>`;
}

// Same background-video treatment as the narrative kind's cover
// (renderer/render-cover.js) — video layered under the existing gradient
// overlay (.gg-hero-bg::after) so hero text stays legible either way.
// id="hero-video" is always present when a video exists (harmless if
// unused) — js/graduation-guide-runtime.js's pause button wiring needs a
// stable hook in both the static and scroll-hero markup variants below.
function buildHeroVideo(heroVideo, asset) {
  if (!heroVideo || !heroVideo.url) return '';
  const poster = heroVideo.poster ? ` poster="${escHtml(resolveMediaUrl(heroVideo.poster, asset))}"` : '';
  const autoplay = heroVideo.autoplay !== false ? ' autoplay' : '';
  const loop = heroVideo.loop !== false ? ' loop' : '';
  const muted = heroVideo.muted !== false ? ' muted' : '';
  return `<video class="gg-hero-bg-video" id="hero-video"${autoplay}${muted}${loop} playsinline${poster}>
    <source src="${escHtml(resolveMediaUrl(heroVideo.url, asset))}" type="video/mp4">
  </video>`;
}

function buildCeremonyRecording(cfg, asset) {
  const video = parseVideoUrl(cfg.recordingUrl);
  if (!video) return '';
  const media = video.type === 'mp4'
    ? `<video class="gg-recording-media" src="${escHtml(video.embedUrl)}" controls playsinline></video>`
    : `<iframe class="gg-recording-media" src="${escHtml(video.embedUrl)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${escHtml(cfg.ceremonyLabel)} recording"></iframe>`;
  return `<section class="gg-recording">
    <h2 class="gg-section-h2">Ceremony recording</h2>
    <div class="gg-recording-frame">${media}</div>
  </section>`;
}

// Shared by the legacy two-column welcome section and the scroll-hero's
// pinned welcome block below — same signers/subtitle/body markup either
// way, just a different wrapper/background around it.
function buildWelcomeTextContent(guide, asset) {
  const signers = (guide.welcomeSigners || [])
    .map((s) => `<div class="gg-signer">
        <div class="gg-signer-portrait">${renderPersonPhoto(s.photo, asset, s.name)}</div>
        <div><div class="gg-signer-name">${escHtml(s.name)}</div>
        <div class="gg-signer-role">${escHtml(s.title)}</div></div>
      </div>`)
    .join('\n      ');

  const body = (guide.welcomeText || []).map((p) => `<p>${escHtml(p)}</p>`).join('\n      ');

  return `<div class="gg-welcome-subtitle">${escHtml(guide.welcomeSubtitle || '')}</div>
    <div class="gg-welcome-heading">A welcome message from</div>
    <div class="gg-welcome-signers">
      ${signers}
    </div>
    <div class="gg-welcome-rule"></div>
    <div class="gg-welcome-body">
      ${body}
    </div>`;
}

function buildWelcomeSection(guide, asset) {
  const welcomeImg = renderBackgroundImage(guide.welcomeImage, asset);

  return `<section class="gg-welcome">
  <div class="gg-welcome-left">
    ${buildWelcomeTextContent(guide, asset)}
  </div>
  <div class="gg-welcome-right">${welcomeImg || '<div class="gg-welcome-right-inner">&#127891;</div>'}</div>
</section>`;
}

// ── Hero: two variants ─────────────────────────────────────────────────
// Default (buildStaticHero) is exactly what every graduation-guide project
// has always rendered — a fixed-height hero, welcome section immediately
// below it as its own separate block. Opt-in only (buildScrollHero) is
// the scroll-driven version: hero + welcome merge into one pinned stage
// (video sticks via CSS position:sticky — same technique the narrative
// kind's panoramic-scroll layout already uses — no JS needed for the
// pin/release itself), with a --gg-primary panel wiping in behind the
// welcome text as it scrolls into view (GSAP ScrollTrigger, scrubbed to
// scroll position — same technique the narrative kind's split-reveal
// layout already uses). See project memory
// "hse-graduation-guide-scroll-hero".

function buildStaticHero(guide, asset) {
  return `<section class="gg-hero" id="hero">
  <div class="gg-hero-bg">${buildHeroVideo(guide.heroVideo, asset)}</div>
  <div class="gg-hero-content">
    <div class="gg-hero-photo" id="hero-photo" hidden>
      <img id="hero-photo-img" src="" alt="">
    </div>
    <p class="gg-hero-congrats" id="hero-congrats">Congratulations!</p>
    <a class="gg-hero-find-link" id="hero-find-link" href="#find-student">Find <span id="hero-find-name">a student&#39;s name</span> in the honours list &#8594;</a>
    <div class="gg-hero-title-block">
      <h1 class="gg-hero-title">${escHtml(guide.title)}</h1>
    </div>
  </div>
  ${buildHeroPauseButton(guide.heroVideo)}
</section>`;
}

function buildHeroPauseButton(heroVideo) {
  if (!heroVideo || !heroVideo.url) return '';
  return `<button class="gg-hero-pause" id="hero-pause-btn" aria-label="Pause background video" aria-pressed="false">&#9646;&#9646; Pause</button>`;
}

function buildScrollHero(institution, guide, asset) {
  return `<div class="gg-scroll-hero" id="scroll-hero">
  <div class="gg-scroll-hero-sticky">
    <div class="gg-hero-bg">${buildHeroVideo(guide.heroVideo, asset)}</div>
    <div class="gg-scroll-wipe-panel" id="scroll-wipe-panel"></div>
    ${buildHeroPauseButton(guide.heroVideo)}
  </div>
  <div class="gg-scroll-hero-content">
    <div class="gg-scroll-hero-block" id="scroll-hero-entrance">
      <div class="gg-hero-photo" id="hero-photo" hidden>
        <img id="hero-photo-img" src="" alt="">
      </div>
      <p class="gg-hero-congrats" id="hero-congrats">Congratulations!</p>
      <a class="gg-hero-find-link" id="hero-find-link" href="#find-student">Find <span id="hero-find-name">a student&#39;s name</span> in the honours list &#8594;</a>
      <div class="gg-hero-title-block">
        <h1 class="gg-hero-title">${escHtml(guide.title)}</h1>
      </div>
    </div>
    <div class="gg-scroll-welcome-block" id="scroll-welcome-trigger">
      ${buildWelcomeTextContent(guide, asset)}
    </div>
  </div>
</div>`;
}

function buildAboutSection(guide, asset) {
  const about = guide.aboutTheDay || {};
  const requests = (about.politeRequests || []).map((r) => `<li>${escHtml(r)}</li>`).join('\n      ');
  const photography = (about.photography || []).map((p) => `<p>${escHtml(p)}</p>`).join('\n      ');
  const link = about.photographyLink
    ? `<p>For more information on photography visit <a href="${escHtml(about.photographyLink.href)}">${escHtml(about.photographyLink.text)}</a></p>`
    : '';
  const aboutBg = renderBackgroundImage(about.backgroundImage, asset);

  return `<section class="gg-about">
  <div class="gg-about-bg">${aboutBg}</div>
  <div class="gg-about-col">
    <svg class="gg-about-icon" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="44" r="16" stroke="currentColor" stroke-width="2"/>
      <rect x="20" y="12" width="10" height="10" rx="1" stroke="currentColor" stroke-width="2"/>
      <path d="M28 28v16" stroke="currentColor" stroke-width="2"/>
      <path d="M22 62h16" stroke="currentColor" stroke-width="2"/>
    </svg>
    <div class="gg-about-col-heading">Polite requests</div>
    <ul>
      ${requests}
    </ul>
  </div>
  <div class="gg-about-col">
    <svg class="gg-about-icon" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="22" width="48" height="34" rx="2" stroke="currentColor" stroke-width="2"/>
      <circle cx="34" cy="39" r="9" stroke="currentColor" stroke-width="2"/>
      <circle cx="34" cy="39" r="3.5" stroke="currentColor" stroke-width="2"/>
      <circle cx="58" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
      <path d="M52 18l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <div class="gg-about-col-heading">Professional photography</div>
    ${photography}
    ${link}
  </div>
</section>`;
}

// ── Chooser ─────────────────────────────────────────────────────────────

function buildChooserHtml(guide, ceremonies) {
  return (guide.days || [])
    .map((dayInfo) => {
      const tiles = ceremonies
        .filter((c) => c.day === dayInfo.day)
        .map(
          // No ceremony is pre-selected — a plain visit shows the chooser
          // grid with nothing active until the visitor picks one (or a
          // deep link / share link selects one via the runtime JS).
          (c) => `<button class="gg-chooser-tile" data-id="${escHtml(c.ceremonyId)}">
        <span class="gg-chooser-tile-time">${escHtml(c.ceremonyTime)}</span>
        <span class="gg-chooser-tile-label">${escHtml(c.ceremonyLabel)}</span>
        <span class="gg-chooser-tile-caret">&#9660;</span>
      </button>`
        )
        .join('\n      ');

      return `<div class="gg-chooser-day">
    <h2 class="gg-chooser-day-title">View your ceremony guide for <span>${escHtml(dayInfo.label)}</span></h2>
    <p class="gg-chooser-prompt">Choose a ceremony:</p>
    <div class="gg-chooser-grid">
      ${tiles}
    </div>
  </div>`;
    })
    .join('\n');
}

// ── Ceremony sections ──────────────────────────────────────────────────

function buildCeremonySectionsHtml(ceremonies, guide, asset) {
  return ceremonies.map((cfg) => buildCeremonySection(cfg, guide, asset)).join('\n\n');
}

function buildCeremonySection(cfg, guide, asset) {
  const dean = cfg.dean || {};
  const proc = cfg.processionGroups || [];
  const order = cfg.orderOfCeremony || [];
  const awardees = cfg.awardees || [];

  const ptabs = proc
    .map(
      (g, i) => `<button class="gg-proc-tab${i === 0 ? ' active' : ''}" data-pi="${i}">
      <span class="gg-proc-tab-num">${i + 1}</span>
      <span class="gg-proc-tab-label">${escHtml(g.label)}</span>
    </button>`
    )
    .join('\n    ');

  const pcontent = proc
    .map(
      (g, i) => `<div class="gg-proc-content${i === 0 ? ' active' : ''}" data-pc="${i}"><ul>
      ${g.members.map((m) => `<li>${escHtml(m)}</li>`).join('\n      ')}
    </ul></div>`
    )
    .join('\n  ');

  const orderHtml = order
    .map((item) => {
      let html = `<div class="gg-order-item"><div class="gg-order-item-title">${escHtml(item.t)}</div>`;
      if (item.d) html += `<div class="${item.i ? 'gg-order-item-italic' : 'gg-order-item-plain'}">${escHtml(item.d)}</div>`;
      if (item.extra) html += `<div class="gg-order-item-plain">${escHtml(item.extra)}</div>`;
      if (item.jump) html += `<a class="gg-order-jump" href="#names-${escHtml(cfg.ceremonyId)}">&#8595; Jump to names of graduating students</a>`;
      if (item.bullet) html += `<div class="gg-order-bullet"><div class="gg-order-bullet-sq"></div><div class="gg-order-bullet-text">${escHtml(item.bullet)}</div></div>`;
      html += '</div>';
      return html;
    })
    .join('\n    ');

  let awardeesHtml = '';
  if (awardees.length) {
    const cards = awardees
      .map(
        (a) => `<div class="gg-awardee-card">
        <div class="gg-awardee-photo">${renderPersonPhoto(a.photo, asset, a.name)}</div>
        <div class="gg-awardee-body">
          <div class="gg-awardee-medal">${escHtml(a.medal)}</div>
          <div class="gg-awardee-name">${escHtml(a.name)}</div>
          <div class="gg-awardee-desc">${escHtml(a.desc)}</div>
          <button class="gg-awardee-bio-btn">View bio for ${escHtml(a.name)}</button>
        </div>
      </div>`
      )
      .join('\n      ');

    awardeesHtml = `<section class="gg-awardees">
      <div class="gg-awardees-grid">
        ${cards}
      </div>
      <button class="gg-view-all-btn">View all of this year's awardees</button>
    </section>
    <div class="gg-rah-photo">${renderBackgroundImage(guide.venuePhoto, asset) || '&#127963;'}</div>
    <section class="gg-prizes">
      <h2 class="gg-prizes-heading">Graduate prize winners</h2>
      <p class="gg-prizes-intro">${escHtml(cfg.prizesIntro)}</p>
      <button class="gg-prizes-toggle">View or hide graduate prize winners</button>
    </section>`;
  }

  const courseGroups = (cfg.courseGroups || [])
    .map((course, ci) => {
      const gid = `sl-${cfg.ceremonyId}-${ci}`;
      const rows = (course.students || [])
        .map(
          // The full <svg> used to be inlined per row — harmless at one
          // row, but this renders thousands of times per ceremony (5,373
          // students across imperial-2026 alone) and that repetition alone
          // added ~2.3MB to the page, nearly half its total weight. A
          // single shared <symbol> (see buildBody, rendered once) plus a
          // short <use> reference per row is visually and behaviourally
          // identical but a fraction of the size.
          (name) => `<div class="gg-student-name-row" data-student="${escHtml(name)}" data-ceremony="${escHtml(cfg.ceremonyId)}">
        <span class="gg-student-name-text">${escHtml(name)}</span>
        <button class="gg-share-btn" aria-label="Share">
          <svg width="14" height="14"><use href="#gg-share-icon" xlink:href="#gg-share-icon"></use></svg>
        </button>
      </div>`
        )
        .join('\n      ');

      return `<div class="gg-course-group">
      <div class="gg-course-group-hdr">
        <h3 class="gg-course-group-title">${escHtml(course.groupTitle)}</h3>
        <button class="gg-course-toggle" data-target="${gid}">View or hide</button>
      </div>
      <div class="gg-student-list" id="${gid}">
        ${rows}
      </div>
    </div>`;
    })
    .join('\n    ');

  const namesHtml = `<section class="gg-names" id="names-${escHtml(cfg.ceremonyId)}">
    <h2 class="gg-names-heading">Names of graduating students</h2>
    <p class="gg-names-disclaimer">Please note that this list of names is provided for the information and interest of those attending the ceremony. It represents a list of graduates at the time of publishing, not all of whom are attending the ceremony.</p>
    ${courseGroups}
  </section>`;

  return `<div class="gg-ceremony" id="cer-${escHtml(cfg.ceremonyId)}" data-id="${escHtml(cfg.ceremonyId)}">
  <section class="gg-cer-header">
    <h2 class="gg-cer-time-title"><b>${escHtml(cfg.ceremonyTime)}</b> ${escHtml(cfg.ceremonyLabel)}</h2>
    ${dean.name ? `<div class="gg-dean-grid">
      <div>
        <h3 class="gg-dean-h3">Dean's welcome</h3>
        <p class="gg-dean-intro">${escHtml(dean.intro)}</p>
        <p class="gg-dean-body">${escHtml(dean.body)}</p>
        <button class="gg-dean-expand" aria-expanded="false" aria-label="Read the rest of the dean's welcome">&#8964;</button>
      </div>
      <div class="gg-dean-portrait-col">
        <div class="gg-dean-photo">${renderPersonPhoto(dean.photo, asset, dean.name)}</div>
        <div class="gg-dean-name">${escHtml(dean.name)}</div>
        <div class="gg-dean-role-text">${escHtml(dean.role)}</div>
      </div>
    </div>` : ''}
  </section>
  ${buildCeremonyRecording(cfg, asset)}
  ${proc.length ? `<section class="gg-procession">
    <h2 class="gg-section-h2">Order of procession</h2>
    <div class="gg-proc-tabs" id="ptabs-${escHtml(cfg.ceremonyId)}">
      ${ptabs}
    </div>
    ${pcontent}
  </section>` : ''}
  ${orderHtml ? `<div class="gg-order-ceremony">
    <h2 class="gg-order-h2">Order of ceremony</h2>
    ${orderHtml}
  </div>` : ''}
  ${awardeesHtml}
  ${namesHtml}
</div>`;
}

// ── Embedded data ──────────────────────────────────────────────────────
// Offline-critical: baked into the shell at build time, no runtime fetch.

function buildDataScript(payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<script>window.GRADUATION_DATA = ${json};</script>`;
}

module.exports = { renderGraduationGuide };
