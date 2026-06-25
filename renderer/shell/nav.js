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

  return `
<nav id="hse-nav" aria-label="Publication sections">
  ${brand}
  <ul class="hse-nav__links" role="list">
    ${links}
  </ul>
</nav>`.trim();
}

module.exports = { renderNav };
