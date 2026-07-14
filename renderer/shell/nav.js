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
    ? `<a class="hse-nav__pdf-link" href="${escHtml(pdfHref)}" target="_blank" rel="noopener" aria-label="Download PDF" title="Download PDF">
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
  </a>`
    : '';

  return `
<nav id="hse-nav" aria-label="Publication sections">
  ${brand}
  <ul class="hse-nav__links" role="list">
    ${links}
  </ul>
  ${pdfLink}
  <button class="hse-nav__hamburger" id="hse-nav-hamburger" aria-label="Open menu" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>
</nav>
<div class="hse-nav__mobile-menu" id="hse-nav-mobile-menu" aria-hidden="true">
  <button class="hse-nav__mobile-close" id="hse-nav-mobile-close" aria-label="Close menu">✕</button>
  <ul role="list">
    ${links}
  </ul>
</div>`.trim();
}

module.exports = { renderNav };
