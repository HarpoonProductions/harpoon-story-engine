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
 * Ceremony Guides dropdown — originally graduation-guide.js's own, moved
 * here so a group-linked satellite page can render the identical dropdown
 * (see buildGroupNav below), not just a link back to the hub. Real anchor
 * links, not a stub: on the hub page itself (baseHref=''),
 * js/graduation-guide-runtime.js intercepts clicks and calls
 * selectCeremony() directly instead of relying on native anchor scroll
 * (inactive ceremonies are display:none, so a plain #anchor jump wouldn't
 * actually show one); elsewhere (baseHref points at the hub), there's no
 * #cer-X element on the current page to intercept for, so the href just
 * navigates there and handleParams() deep-links to it on load.
 *
 * @param {?Array<{label: string, day: number}>} guideDays
 * @param {?Array<{ceremonyId: string, ceremonyTime: string, ceremonyLabel: string, day: number}>} ceremonies
 * @param {string} [baseHref] - '' on the hub's own page; '../<hub-id>/' on a satellite
 */
function buildCeremonyLinks(guideDays, ceremonies, baseHref) {
  baseHref = baseHref || '';
  const dayLabel = (day) => {
    const d = (guideDays || []).find((d) => d.day === day);
    return d ? d.label : `Day ${day}`;
  };

  const groups = {};
  (ceremonies || []).forEach((c) => {
    (groups[c.day] = groups[c.day] || []).push(c);
  });

  return Object.keys(groups)
    .sort((a, b) => a - b)
    .map((day) => {
      const rows = groups[day]
        .map(
          (c) => `<a class="gg-nav-dropdown-item" data-ceremony-link="${escHtml(c.ceremonyId)}" href="${escHtml(baseHref)}?ceremony=${escHtml(c.ceremonyId)}#cer-${escHtml(c.ceremonyId)}" role="menuitem">
        <span class="gg-nav-dropdown-item-time">${escHtml(c.ceremonyTime)}</span>
        <span class="gg-nav-dropdown-item-label">${escHtml(c.ceremonyLabel)}</span>
      </a>`
        )
        .join('\n      ');
      return `<div class="gg-nav-dropdown-group">${escHtml(dayLabel(Number(day)))}</div>\n      ${rows}`;
    })
    .join('\n      ');
}

function buildCeremonyDropdown(guideDays, ceremonies, baseHref) {
  if (!ceremonies || !ceremonies.length) return '';
  return `<div class="gg-nav-dropdown" id="ceremony-guides-dropdown">
    <button class="gg-nav-link gg-nav-dropdown-toggle" id="ceremony-guides-toggle" aria-haspopup="true" aria-expanded="false">
      Ceremony Guides <span class="gg-nav-caret">&#9660;</span>
    </button>
    <div class="gg-nav-dropdown-menu" role="menu" aria-label="Ceremony Guides">
      ${buildCeremonyLinks(guideDays, ceremonies, baseHref)}
    </div>
  </div>`;
}

/**
 * Full nav bar + mobile menu for an ordinary narrative story that belongs
 * to a group — only called when meta.group_id is set; renderer/shell/nav.js
 * covers every other narrative page as before.
 *
 * Deliberately renders the exact same nav structure and item order as the
 * hub's own — wordmark, Ceremony Guides, Explore more, any top-nav members
 * — on every page in the cluster, this page included (the caller passes a
 * groupMembers list with this project's own entry added back in and
 * re-sorted, see renderer/index.js; someone clicking around the guide
 * should never see links appear, disappear, or reorder as the nav itself
 * relocates them from page to page).
 *
 * @param {object} opts
 * @param {Array}  opts.groupMembers - resolved via renderer/groups.js, self-inclusive (not
 *   excluded like a plain resolveGroup() call — see renderer/index.js)
 * @returns {string} nav + mobile menu HTML
 */
function buildGroupNav(opts) {
  const { groupMembers } = opts;
  const hub = findHub(groupMembers);

  const exploreItems = dropdownMembers(groupMembers).map((m) => ({
    href: `../${m.project_id}/`,
    label: m.label,
  }));

  const explore = buildDropdown({ id: 'explore-more', label: 'Explore more', items: exploreItems });
  const topLinks = buildTopNavLinks(groupMembers, 'gg-nav-link');
  const topLinksMobile = buildTopNavLinks(groupMembers, 'gg-nav-mobile-link');

  const wordmarkHref = hub ? `../${escHtml(hub.project_id)}/` : '#';
  const wordmarkLabel = escHtml(hub ? (hub.institutionName || hub.title) : '');
  const wordmarkInner = hub && hub.logo
    ? `<img class="gg-nav-logo" src="../${escHtml(hub.project_id)}/${escHtml(hub.logo)}" alt="${wordmarkLabel}">`
    : wordmarkLabel;

  const ceremonyBase = hub ? `../${escHtml(hub.project_id)}/` : '';
  const ceremonyDropdown = hub ? buildCeremonyDropdown(hub.guideDays, hub.ceremonies, ceremonyBase) : '';
  const ceremonyLinksMobile = hub && hub.ceremonies && hub.ceremonies.length
    ? buildCeremonyLinks(hub.guideDays, hub.ceremonies, ceremonyBase)
    : '';

  const nav = `<nav class="gg-nav" id="group-nav">
  <a class="gg-nav-wordmark" href="${wordmarkHref}">${wordmarkInner}</a>
  <div class="gg-nav-links">
    ${ceremonyDropdown}
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
    ${ceremonyLinksMobile ? `<div class="gg-nav-mobile-group-label">Ceremony Guides</div>
    ${ceremonyLinksMobile}` : ''}
    ${exploreItems.length ? `<div class="gg-nav-mobile-group-label">Explore more</div>
    ${buildDropdownItems(exploreItems)}` : ''}
    ${topLinksMobile}
    <a class="gg-nav-mobile-link" href="${wordmarkHref}">${wordmarkLabel}</a>
  </div>
</div>`;

  return nav + '\n' + mobileMenu;
}

module.exports = {
  findHub,
  buildDropdown,
  buildDropdownItems,
  buildTopNavLinks,
  buildCeremonyDropdown,
  buildCeremonyLinks,
  buildGroupNav,
};
