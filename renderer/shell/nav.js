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
function renderNav(meta, sections) {
  const navSections = sections.filter(s => !s.nav_exclude);

  const links = navSections.map(s => {
    const label = escHtml(s.nav_label || s.title || s.id);
    return `<li><a href="#${s.id}">${label}</a></li>`;
  }).join('\n      ');

  return `
<nav id="hse-nav">
  <span class="hse-nav__brand">${escHtml(meta.title)}</span>
  <ul class="hse-nav__links">
    ${links}
  </ul>
</nav>`.trim();
}

module.exports = { renderNav };
