'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a pull quote block.
 * @param {object} pq  - HSE pull_quote definition
 * @returns {string} HTML string
 */
function renderPullQuote(pq) {
  if (!pq || !pq.text) return '';

  const attribution = pq.attribution
    ? `<cite class="hse-pull-quote__attribution">${escHtml(pq.attribution)}</cite>`
    : '';

  return `<blockquote class="hse-pull-quote hse-reveal">
  <div class="hse-pull-quote__rule"></div>
  <p class="hse-pull-quote__text">${escHtml(pq.text)}</p>
  ${attribution}
</blockquote>`;
}

module.exports = { renderPullQuote };
