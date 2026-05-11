'use strict';

const { escHtml } = require('../shell/head');
const { renderImage } = require('./image');
const { renderPullQuote } = require('./pull-quote');
const { renderStatBlock } = require('./stat-block');

/**
 * Renders an accordion_items array.
 * @param {Array} items  - array of HSE accordion_item definitions
 * @returns {string} HTML string
 */
function renderAccordion(items) {
  if (!items || items.length === 0) return '';

  const itemsHtml = items.map((item, i) => {
    const images = item.images && item.images.length > 0
      ? `<div class="hse-accordion__images hse-accordion__images--${item.images.length}">
          ${item.images.map(img => renderImage(img, 'hse-accordion__img')).join('\n')}
        </div>`
      : '';

    const thumb = item.thumbnail
      ? renderImage(item.thumbnail, 'hse-accordion__thumb')
      : '';

    const pq   = item.pull_quote ? renderPullQuote(item.pull_quote) : '';
    const stats = item.stats && item.stats.length > 0 ? renderStatBlock(item.stats) : '';

    return `<div class="hse-accordion__item${i === 0 ? ' is-open' : ''}" id="accordion-${escHtml(item.id)}">
  <button class="hse-accordion__trigger" aria-expanded="${i === 0 ? 'true' : 'false'}">
    ${thumb}
    <span class="hse-accordion__title">${escHtml(item.title)}</span>
    <span class="hse-accordion__chevron" aria-hidden="true"></span>
  </button>
  <div class="hse-accordion__body" ${i === 0 ? '' : 'hidden'}>
    ${images}
    <div class="hse-accordion__content">${item.body || ''}</div>
    ${pq}
    ${stats}
  </div>
</div>`;
  }).join('\n');

  return `<div class="hse-accordion">
${itemsHtml}
</div>`;
}

module.exports = { renderAccordion };
