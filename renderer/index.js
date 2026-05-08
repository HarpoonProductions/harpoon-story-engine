'use strict';

const fs   = require('fs');
const path = require('path');

const { renderHead }  = require('./shell/head');
const { renderNav }   = require('./shell/nav');
const { renderCover } = require('./render-cover');

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

  // Build the single-page HTML document
  const html = buildPage(meta, config, cover, sections);

  const outPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(outPath, html, 'utf8');

  return [outPath];
}

// ── Page assembly ─────────────────────────────────────────────────

function buildPage(meta, config, cover, sections) {
  const head = renderHead(meta, config, null);
  const nav  = renderNav(meta, sections);
  const coverHtml = renderCover(cover);

  // Sections: render each, or stub if renderer not yet built
  const sectionsHtml = sections.map(section => renderSection(section)).join('\n\n');

  const bodyScript = buildBodyScript(meta, sections);

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

<script>
${bodyScript}
</script>

</body>
</html>`;
}

// ── Section renderer (dispatcher) ────────────────────────────────
// Each layout will get its own module. For now, a readable stub
// so the full page renders end-to-end.

function renderSection(section) {
  // TODO: import and call layout-specific renderers as they are built.
  // For now, render a placeholder that shows the section exists.
  const label = esc(section.nav_label || section.title || section.id);
  return `
<!-- Section: ${section.id} | layout: ${section.layout || 'default'} -->
<section class="hse-section" id="${section.id}" data-layout="${section.layout || 'default'}">
  <div class="hse-inner">
    <p class="hse-eyebrow">${label}</p>
    ${section.intro ? `<p class="hse-section-intro hse-reveal">${esc(section.intro)}</p>` : ''}
    <p style="font-family:var(--hse-font-mono);font-size:0.62rem;color:var(--hse-warm-3);margin-top:1rem;">
      ⚙ Renderer for layout <em>${section.layout || 'default'}</em> — coming next
    </p>
  </div>
</section>`.trim();
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
`.trim();
}

// ── CSS copy ──────────────────────────────────────────────────────

function copyCss(outputDir) {
  const cssSource = path.join(__dirname, '../css');
  const cssDest   = path.join(outputDir, 'css');
  copyDirRecursive(cssSource, cssDest);
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
