'use strict';

const fs   = require('fs');
const path = require('path');

const { renderHead }  = require('./shell/head');
const { renderNav }   = require('./shell/nav');
const { renderCover } = require('./render-cover');

// Layout renderers — expand as each is built
const { renderDefault }         = require('./layouts/default');
const { renderStickySteps }     = require('./layouts/sticky-steps');
const { renderFullbleedQuote }  = require('./layouts/fullbleed-quote');
const { renderRevealCrossfade } = require('./layouts/reveal-crossfade');
const { renderStackableCards }  = require('./layouts/stackable-cards');
const { renderParallax }        = require('./layouts/parallax');
const { renderCascadingSlides } = require('./layouts/cascading-slides');

/**
 * Top-level render function.
 * Reads the content object, writes HTML files to outputDir.
 *
 * Currently renders in single-page mode regardless of config.layout_mode —
 * multi-page support is a future iteration.
 *
 * @param {object} content    - validated HSE content object
 * @param {string} outputDir  - absolute path to output directory
 * @returns {string[]} Array of absolute paths to written files
 */
function render(content, outputDir) {
  const { meta, config, cover, sections } = content;

  // Copy CSS to output directory
  copyCss(outputDir);

  // Derive root-relative base path from project_id
  // e.g. project_id 'opera-voices-2026' -> basePath '/opera-voices-2026'
  const basePath = meta.project_id || '';

  // Build the single-page HTML document
  const html = buildPage(meta, config, cover, sections, basePath);

  const outPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(outPath, html, 'utf8');

  return [outPath];
}

// ── Page assembly ─────────────────────────────────────────────────

function buildPage(meta, config, cover, sections, basePath) {
  const base = basePath ? '/' + basePath.replace(/^\//, '').replace(/\/$/, '') : '';
  const head = renderHead(meta, config, null, basePath);
  const nav  = renderNav(meta, sections);
  const coverHtml = renderCover(cover);

  // Sections: render each, or stub if renderer not yet built
  const sectionsHtml = sections.map(section => renderSection(section)).join('\n\n');

  return `${head}
<body>

<div id="hse-progress"></div>

${nav}

${coverHtml}

${sectionsHtml}

<footer class="hse-footer">
  <span class="hse-footer__brand">${esc(meta.title)}</span>
  <span class="hse-footer__credit">Produced with the Harpoon Story Engine</span>
</footer>

<style>
.hse-footer {
  border-top: 1px solid var(--hse-rule);
  padding: 2.5rem var(--hse-page-pad);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}
.hse-footer__brand {
  font-family: var(--hse-font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--hse-warm-3);
}
.hse-footer__credit {
  font-family: var(--hse-font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--hse-warm-3);
  opacity: 0.5;
}
</style>

<script src="${base}/js/runtime.js"></script>

</body>
</html>`;
}

// ── Section renderer (dispatcher) ─────────────────────────────────────
// Routes each section to the appropriate layout renderer.
// Add new cases here as layout renderers are built.

function renderSection(section) {
  const layout = section.layout || 'default';
  switch (layout) {
    case 'default':
      return renderDefault(section);
    case 'sticky-steps':
      return renderStickySteps(section);
    case 'fullbleed-quote':
      return renderFullbleedQuote(section);
    case 'reveal-crossfade':
      return renderRevealCrossfade(section);
    case 'stackable-cards':
      return renderStackableCards(section);
    case 'parallax':
      return renderParallax(section);
    case 'cascading-slides':
      return renderCascadingSlides(section);
    default:
      // Graceful stub for layouts not yet implemented
      return `<!-- Section: ${section.id} | layout: ${layout} — renderer pending -->
<section class="hse-section hse-section--stub" id="${section.id}" data-layout="${layout}">
  <div class="hse-inner">
    <p class="hse-eyebrow">${esc(section.nav_label || section.title || section.id)}</p>
    ${section.intro ? `<p class="hse-section-intro hse-reveal">${esc(section.intro)}</p>` : ''}
    <p class="hse-label" style="margin-top:1rem;opacity:0.4;">Layout renderer: ${layout} — coming soon</p>
  </div>
</section>`;
  }
}

// ── Body JavaScript ───────────────────────────────────────────────

function buildBodyScript(meta, sections) {
  const navIds = sections
    .filter(s => !s.nav_exclude)
    .map(s => `'${s.id}'`)
    .join(', ');

  return `
// ── Harpoon Story Engine — Runtime ───────────────────────────────

gsap.registerPlugin(ScrollTrigger);

// Progress bar
gsap.to('#hse-progress', {
  width: '100%',
  ease: 'none',
  scrollTrigger: {
    trigger: 'body',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.3,
  }
});

// Nav scroll state
ScrollTrigger.create({
  start: '80px top',
  onEnter:     () => document.getElementById('hse-nav').classList.add('hse-nav--solid'),
  onLeaveBack: () => document.getElementById('hse-nav').classList.remove('hse-nav--solid'),
});

// Cover entrance
const coverTl = gsap.timeline({ delay: 0.3 });
coverTl
  .to('.hse-cover__kicker',   { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.4)
  .to('.hse-cover__headline', { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.65)
  .to('.hse-cover__body',     { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.85)
  .to('.hse-cover__ctas',     { opacity: 1,        duration: 0.8, ease: 'power2.out' }, 1.1)
  .to('.hse-cover__colophon', { opacity: 1,        duration: 0.8, ease: 'power2.out' }, 1.2)
  .to('.hse-cover__scroll-cue', { opacity: 1,      duration: 0.8, ease: 'power2.out' }, 1.5);

// General scroll reveal
gsap.utils.toArray('.hse-reveal').forEach(el => {
  gsap.to(el, {
    opacity: 1,
    y: 0,
    duration: 0.75,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: el,
      start: 'top 85%',
      once: true,
    }
  });
});

// Active nav link on scroll
const navSectionIds = [${navIds}];
navSectionIds.forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  ScrollTrigger.create({
    trigger: el,
    start: 'top 50%',
    end: 'bottom 50%',
    onEnter:      () => setActiveNav(id),
    onEnterBack:  () => setActiveNav(id),
  });
});

function setActiveNav(id) {
  document.querySelectorAll('.hse-nav__links a').forEach(a => {
    a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
  });
}

// ── Fullbleed Quote: entrance animation ───────────────────────────
gsap.utils.toArray('.hse-section--fullbleed-quote').forEach(section => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: () => section.classList.add('is-visible'),
  });
});

// ── Sticky Steps: image crossfade + step activation ───────────────
gsap.utils.toArray('.hse-section--sticky-steps').forEach(section => {
  const steps  = section.querySelectorAll('.hse-ss__step');
  const imgs   = section.querySelectorAll('.hse-ss__visual-img');
  const pips   = section.querySelectorAll('.hse-ss__progress-pip');

  function activateStep(index) {
    steps.forEach((s, i) => s.classList.toggle('is-active', i === index));
    imgs.forEach((img, i)  => img.classList.toggle('is-active', i === index));
    pips.forEach((pip, i)  => pip.classList.toggle('is-active', i === index));
  }

  steps.forEach((step, i) => {
    ScrollTrigger.create({
      trigger: step,
      start: 'top 55%',
      end: 'bottom 55%',
      onEnter:     () => activateStep(i),
      onEnterBack: () => activateStep(i),
    });
  });
});

// ── Reveal Crossfade: phase visibility + image crossfade ──────────
gsap.utils.toArray('.hse-section--reveal-crossfade').forEach(section => {
  const phases = section.querySelectorAll('.hse-cf__phase');

  phases.forEach((phase, i) => {
    ScrollTrigger.create({
      trigger: phase,
      start: 'top 65%',
      once: true,
      onEnter: () => {
        phase.classList.add('is-visible');
        // Crossfade fires when the second phase enters
        if (i === 1) section.classList.add('is-revealed');
      },
    });
  });
});
`.trim();
}

// ── CSS copy ──────────────────────────────────────────────────────

function copyCss(outputDir) {
  const cssSource = path.join(__dirname, '../css');
  const cssDest   = path.join(outputDir, 'css');
  copyDirRecursive(cssSource, cssDest);

  const jsSource = path.join(__dirname, '../js');
  const jsDest   = path.join(outputDir, 'js');
  copyDirRecursive(jsSource, jsDest);
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
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

module.exports = { render };
