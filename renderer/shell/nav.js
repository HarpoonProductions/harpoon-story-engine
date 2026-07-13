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
function renderNav(meta, sections, registryLogoUrl) {
  const navSections = sections.filter(s => !s.nav_exclude);

  const links = navSections.map(s => {
    const label = escHtml(s.nav_label || s.title || s.id);
    return `<li><a href="#${s.id}">${label}</a></li>`;
  }).join('\n      ');

  const logoUrl = meta.logo_url || registryLogoUrl || null;
  const brand = logoUrl
    ? `<a class="hse-nav__brand" href="#hse-cover"><img class="hse-nav__logo" src="${escHtml(logoUrl)}" alt="${escHtml(meta.title)}"></a>`
    : `<a class="hse-nav__brand" href="#hse-cover">${escHtml(meta.title)}</a>`;

  const printLink = meta.project_id
    ? `<a class="hse-nav__print-link" href="/print/${escHtml(meta.project_id)}/" target="_blank" rel="noopener" aria-label="Open print version">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="1" width="10" height="7" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <rect x="3.5" y="8" width="7" height="5" rx="0.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <rect x="5" y="3" width="4" height="1" rx="0.3" fill="currentColor"/>
          <rect x="5" y="5" width="6" height="1" rx="0.3" fill="currentColor"/>
        </svg>
        <span>Print</span>
      </a>`
    : '';

  return `
<nav id="hse-nav" aria-label="Publication sections">
  ${brand}
  <ul class="hse-nav__links" role="list">
    ${links}
  </ul>
  ${printLink}
  <button class="hse-nav__hamburger" id="hse-nav-hamburger" aria-label="Open menu" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>
</nav>
<div class="hse-nav__mobile-menu" id="hse-nav-mobile-menu" aria-hidden="true">
  <button class="hse-nav__mobile-close" id="hse-nav-mobile-close" aria-label="Close menu">✕</button>
  <ul role="list">
    ${links}
  </ul>
  ${printLink}
</div>`.trim();
}

module.exports = { renderNav };
