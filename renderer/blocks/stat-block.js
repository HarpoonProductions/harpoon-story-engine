'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a stat_block array.
 * @param {Array} stats  - array of HSE stat definitions
 * @returns {string} HTML string
 */
function renderStatBlock(stats) {
  if (!stats || stats.length === 0) return '';

  const items = stats.map((stat, i) => {
    const animateAttr = stat.animate ? ' data-odometer="true"' : '';
    return `<div class="hse-stat hse-reveal hse-reveal-delay-${Math.min(i + 1, 3)}"${animateAttr}>
  <span class="hse-stat__value">${escHtml(stat.value)}</span>
  <span class="hse-stat__label">${escHtml(stat.label)}</span>
</div>`;
  }).join('\n');

  return `<div class="hse-stat-block" data-count="${stats.length}">
${items}
</div>`;
}

module.exports = { renderStatBlock };
