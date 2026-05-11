'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a single image block.
 * @param {object} image  - HSE image definition
 * @param {string} [cls]  - additional CSS class(es)
 * @returns {string} HTML string
 */
function renderImage(image, cls = '') {
  if (!image || !image.url) return '';

  const caption = image.caption
    ? `<figcaption class="hse-image__caption hse-label">${escHtml(image.caption)}</figcaption>`
    : '';

  return `<figure class="hse-image${cls ? ' ' + cls : ''}">
  <img
    src="${escHtml(image.url)}"
    alt="${escHtml(image.alt || '')}"
    loading="lazy"
    decoding="async">
  ${caption}
</figure>`;
}

module.exports = { renderImage };
