'use strict';

const { escHtml } = require('./head');

/**
 * Renders the fixed navigation bar.
 * Sections with nav_exclude: true are omitted.
 *
 * @param {object} meta     - content.meta
 * @param {Array}  sections - content.sections
 * @returns {string} HTML string
 */
function renderNav(meta, sections, registryLogoUrl, basePath) {
  const navSections = sections.filter(s => !s.nav_exclude);

  const links = navSections.map(s => {
    const label = escHtml(s.nav_label || s.title || s.id);
    return `<li><a href="#${s.id}">${label}</a></li>`;
  }).join('\n      ');

  const logoUrl = meta.logo_url || registryLogoUrl || null;
  const brand = logoUrl
    ? `<a class="hse-nav__brand" href="#hse-cover"><img class="hse-nav__logo" src="${escHtml(logoUrl)}" alt="${escHtml(meta.title)}"></a>`
    : `<a class="hse-nav__brand" href="#hse-cover">${escHtml(meta.title)}</a>`;

  const pdfHref = basePath ? `${basePath}/story.pdf` : 'story.pdf';
  const pdfLink = meta.generate_pdf
    ? `<a class="hse-nav__pdf-link" href="${escHtml(pdfHref)}" target="_blank" rel="noopener" aria-label="Download PDF (opens in new tab)" title="Download PDF">
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
  </a>`
    : '';

  const audioSrc = meta.audio_url || (meta.generate_audio ? (basePath ? `${basePath}/story.mp3` : 'story.mp3') : null);
  const audioTitle = escHtml(meta.title || '');
  const audioByline = escHtml(meta.byline || '');
  const audioMeta = audioByline ? `${audioTitle} — ${audioByline}` : audioTitle;

  const audioBtn = audioSrc
    ? `<button class="hse-nav__audio-btn" id="hse-audio-trigger" aria-label="Listen to this story" aria-expanded="false">
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
  </button>`
    : '';

  const audioPlayer = audioSrc ? `
<div id="hse-audio-player" class="hse-audio-player" aria-label="Audio player" hidden>
  <audio id="hse-audio" src="${escHtml(audioSrc)}" preload="metadata"></audio>
  <div class="hse-audio-player__bar">
    <button class="hse-audio__play" id="hse-audio-play" aria-label="Play">
      <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </button>
    <div class="hse-audio__meta">
      <span class="hse-audio__title">${audioMeta}</span>
      <div class="hse-audio__controls">
        <span class="hse-audio__time" id="hse-audio-time">0:00</span>
        <input type="range" class="hse-audio__scrub" id="hse-audio-scrub"
               value="0" min="0" step="0.1" aria-label="Seek">
        <span class="hse-audio__duration" id="hse-audio-duration">–:––</span>
      </div>
    </div>
    <div class="hse-audio__speeds" role="group" aria-label="Playback speed">
      <button class="hse-audio__speed is-active" data-speed="1" aria-pressed="true">1×</button>
      <button class="hse-audio__speed" data-speed="1.5" aria-pressed="false">1.5×</button>
      <button class="hse-audio__speed" data-speed="2" aria-pressed="false">2×</button>
    </div>
    <button class="hse-audio__close" id="hse-audio-close" aria-label="Close audio player">
      <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
</div>` : '';

  return `
<nav id="hse-nav" aria-label="Publication sections">
  ${brand}
  <ul class="hse-nav__links" role="list">
    ${links}
  </ul>
  <div class="hse-nav__actions">
    ${pdfLink}
    ${audioBtn}
    <button class="hse-nav__hamburger" id="hse-nav-hamburger" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>
<div class="hse-nav__mobile-menu" id="hse-nav-mobile-menu" aria-hidden="true">
  <button class="hse-nav__mobile-close" id="hse-nav-mobile-close" aria-label="Close menu">✕</button>
  <ul role="list">
    ${links}
  </ul>
</div>
${audioPlayer}`.trim();
}

module.exports = { renderNav };
