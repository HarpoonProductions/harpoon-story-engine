'use strict';

const { escHtml } = require('../shell/head');
const { renderImage }         = require('../blocks/image');
const { renderPullQuote }     = require('../blocks/pull-quote');
const { renderStatBlock }     = require('../blocks/stat-block');
const { renderPhotoCluster }  = require('../blocks/photo-cluster');
const { renderTogglePanels }  = require('../blocks/toggle-panels');
const { renderAccordion }     = require('../blocks/accordion');
const { renderCards }         = require('../blocks/cards');
const { renderContributors }  = require('../blocks/contributors');
const { renderBriefingEngine } = require('../blocks/briefing-engine');
const { renderBackground }    = require('../blocks/background');

/**
 * Renders a section using the default layout.
 * Assembles all available block types in a standard editorial order.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderDefault(section) {
  const { wrapperAttrs, bgHtml } = renderBackground(section.background);
  const num = section.num
    ? `<span class="hse-section-header__num hse-eyebrow">${String(section.num).padStart(2, '0')}</span>`
    : '';

  const title = section.title
    ? `<h2 class="hse-heading hse-reveal">${escHtml(section.title)}</h2>`
    : '';

  const hero = section.hero_image
    ? renderImage(section.hero_image, 'hse-section__hero hse-reveal')
    : '';

  const intro = section.intro
    ? `<p class="hse-section-intro hse-reveal">${escHtml(section.intro)}</p>`
    : '';

  const pullQuote     = renderPullQuote(section.pull_quote);
  const statBlock     = renderStatBlock(section.stat_block);
  const togglePanels  = renderTogglePanels(section.toggle_panels);
  const accordion     = renderAccordion(section.accordion_items);
  const cards         = renderCards(section.cards);
  const contributors  = renderContributors(section.contributors);
  const briefing      = renderBriefingEngine(section.briefing_engine);

  const photoClusters = section.photo_clusters && section.photo_clusters.length > 0
    ? section.photo_clusters.map(c => renderPhotoCluster(c)).join('\n')
    : '';

  const interstitial = section.interstitial_image
    ? renderImage(section.interstitial_image, 'hse-section__interstitial hse-reveal')
    : '';

  const onwardLinks = section.onward_links && section.onward_links.length > 0
    ? `<nav class="hse-onward-links" aria-label="Further reading">
        ${section.onward_links.map(l =>
          `<a href="${escHtml(l.href)}" class="hse-onward-link">${escHtml(l.label)}</a>`
        ).join('\n')}
      </nav>`
    : '';

  const colorBleed = section.color_bleed
    ? ' hse-section--color-bleed'
    : '';

  return `<section class="hse-section hse-section--default${colorBleed}${wrapperAttrs}" id="${escHtml(section.id)}" data-layout="default">
  ${bgHtml}
  ${hero}
  <div class="hse-inner">
    <header class="hse-section-header">
      ${num}
      ${title}
    </header>
    ${intro}
    ${pullQuote}
    ${statBlock}
    ${photoClusters}
    ${togglePanels}
    ${accordion}
    ${cards}
    ${contributors}
    ${briefing}
    ${interstitial}
    ${onwardLinks}
  </div>
</section>`;
}

module.exports = { renderDefault };
