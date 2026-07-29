'use strict';

const { escHtml } = require('./head');

/**
 * Shared .gg-nav-styled dropdown/link builders, driven by meta.group_id
 * data resolved via renderer/groups.js. Used both by the graduation-guide
 * kind's own nav (renderer/kinds/graduation-guide.js) and by the narrative
 * kind's group nav bar below — one definition of what a group_role value
 * means, not two, and one implementation of the dropdown markup, not two.
 *
 * group_role conventions (the schema leaves this field free-form —
 * this is where this repo's own consuming kinds agree on a meaning):
 *   'hub'      — the cluster's home page. Rendered as this bar's wordmark
 *                link, not as a dropdown item.
 *   'top-nav'  — gets its own standalone top-level nav link, alongside
 *                the wordmark, instead of living inside a dropdown.
 *   (anything else / unset) — an ordinary dropdown item.
 *
 * Visual language lives entirely in css/kinds/graduation-guide.css
 * (.gg-nav, .gg-nav-dropdown, etc.) — already copied into every project's
 * output regardless of content kind (renderer/index.js's copyCss does a
 * wholesale css/ copy), so any page can link it and match the
 * graduation-guide hub exactly rather than approximately.
 */

function findHub(groupMembers) {
  return groupMembers.find((m) => m.role === 'hub') || null;
}

function dropdownMembers(groupMembers) {
  return groupMembers.filter((m) => m.role !== 'top-nav' && m.role !== 'hub');
}

function topNavMembers(groupMembers) {
  return groupMembers.filter((m) => m.role === 'top-nav');
}

/**
 * @param {Array<{href: string, label: string}>} items
 */
function buildDropdownItems(items) {
  return items
    .map((item) => `<a class="gg-nav-dropdown-item" href="${escHtml(item.href)}" role="menuitem">
        <span class="gg-nav-dropdown-item-label">${escHtml(item.label)}</span>
      </a>`)
    .join('\n      ');
}

/**
 * @param {object} opts
 * @param {string} opts.id - unique id prefix, e.g. 'explore-more'
 * @param {string} opts.label - toggle button text, e.g. 'Explore more'
 * @param {Array<{href: string, label: string}>} opts.items
 */
function buildDropdown(opts) {
  if (!opts.items.length) return '';
  return `<div class="gg-nav-dropdown" id="${escHtml(opts.id)}-dropdown">
    <button class="gg-nav-link gg-nav-dropdown-toggle" id="${escHtml(opts.id)}-toggle" aria-haspopup="true" aria-expanded="false">
      ${escHtml(opts.label)} <span class="gg-nav-caret">&#9660;</span>
    </button>
    <div class="gg-nav-dropdown-menu" role="menu" aria-label="${escHtml(opts.label)}">
      ${buildDropdownItems(opts.items)}
    </div>
  </div>`;
}

function buildTopNavLinks(groupMembers, linkClass) {
  return topNavMembers(groupMembers)
    .map((m) => `<a class="${linkClass}" href="../${escHtml(m.project_id)}/">${escHtml(m.label)}</a>`)
    .join('\n    ');
}

/**
 * Full nav bar + mobile menu for an ordinary narrative story that belongs
 * to a group — only called when meta.group_id is set; renderer/shell/nav.js
 * covers every other narrative page as before.
 *
 * @param {object} opts
 * @param {string} opts.pageTitle - this page's own meta.title
 * @param {Array}  opts.sections - this page's own content.sections, for the "On this page" dropdown
 * @param {Array}  opts.groupMembers - resolved via renderer/groups.js, this project already excluded
 * @returns {string} nav + mobile menu HTML
 */
function buildGroupNav(opts) {
  const { pageTitle, sections, groupMembers } = opts;
  const hub = findHub(groupMembers);
  const pageSections = (sections || []).filter((s) => !s.nav_exclude);

  const onThisPageItems = pageSections.map((s) => ({
    href: `#${s.id}`,
    label: s.nav_label || s.title || s.id,
  }));
  const exploreItems = dropdownMembers(groupMembers).map((m) => ({
    href: `../${m.project_id}/`,
    label: m.label,
  }));

  const onThisPage = pageSections.length > 1
    ? buildDropdown({ id: 'on-this-page', label: 'On this page', items: onThisPageItems })
    : '';
  const explore = buildDropdown({ id: 'explore-more', label: 'Explore more', items: exploreItems });
  const topLinks = buildTopNavLinks(groupMembers, 'gg-nav-link');
  const topLinksMobile = buildTopNavLinks(groupMembers, 'gg-nav-mobile-link');

  const wordmarkHref = hub ? `../${escHtml(hub.project_id)}/` : '#';
  const wordmarkLabel = escHtml(hub ? hub.title : pageTitle);

  const nav = `<nav class="gg-nav" id="group-nav">
  <a class="gg-nav-wordmark" href="${wordmarkHref}">${wordmarkLabel}</a>
  <div class="gg-nav-links">
    <a class="gg-nav-link" href="#hse-cover">${escHtml(pageTitle)}</a>
    ${onThisPage}
    ${explore}
    ${topLinks}
  </div>
  <div class="gg-nav-right">
    <button class="gg-nav-hamburger" id="gg-nav-hamburger" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>`;

  const mobileMenu = `<div class="gg-nav-mobile-menu" id="gg-nav-mobile-menu" aria-hidden="true">
  <button class="gg-nav-mobile-close" id="gg-nav-mobile-close" aria-label="Close menu">&#10005;</button>
  <div class="gg-nav-mobile-menu__inner">
    <a class="gg-nav-mobile-link" href="#hse-cover">${escHtml(pageTitle)}</a>
    ${pageSections.length > 1 ? `<div class="gg-nav-mobile-group-label">On this page</div>
    ${buildDropdownItems(onThisPageItems)}` : ''}
    ${exploreItems.length ? `<div class="gg-nav-mobile-group-label">Explore more</div>
    ${buildDropdownItems(exploreItems)}` : ''}
    ${topLinksMobile}
    <a class="gg-nav-mobile-link" href="${wordmarkHref}">${wordmarkLabel}</a>
  </div>
</div>`;

  return nav + '\n' + mobileMenu;
}

module.exports = { findHub, buildDropdown, buildDropdownItems, buildTopNavLinks, buildGroupNav };
