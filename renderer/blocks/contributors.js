'use strict';

const { escHtml } = require('../shell/head');
const { renderImage } = require('./image');

/**
 * Renders a contributors array.
 * @param {Array} contributors  - array of HSE contributor definitions
 * @returns {string} HTML string
 */
function renderContributors(contributors) {
  if (!contributors || contributors.length === 0) return '';

  const items = contributors.map((c, i) => {
    const img = c.image ? renderImage(c.image, 'hse-contributor__image') : '';

    const links = c.links && c.links.length > 0
      ? `<div class="hse-contributor__links">
          ${c.links.map(l =>
            `<a href="${escHtml(l.href)}" class="hse-contributor__link hse-label">${escHtml(l.label)}</a>`
          ).join('\n')}
        </div>`
      : '';

    return `<div class="hse-contributor hse-reveal hse-reveal-delay-${Math.min(i + 1, 3)}">
  ${img}
  <div class="hse-contributor__info">
    <p class="hse-contributor__name">${escHtml(c.name)}</p>
    ${c.title ? `<p class="hse-contributor__title hse-eyebrow">${escHtml(c.title)}</p>` : ''}
    ${c.bio   ? `<p class="hse-contributor__bio">${escHtml(c.bio)}</p>` : ''}
    ${links}
  </div>
</div>`;
  }).join('\n');

  return `<div class="hse-contributors" data-count="${contributors.length}">
${items}
</div>`;
}

module.exports = { renderContributors };
