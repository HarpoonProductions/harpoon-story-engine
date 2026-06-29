'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a single image block.
 * Supports optional focal point via image.focal (CSS object-position value).
 *
 * @param {object} image  - HSE image definition
 * @param {string} [cls]  - additional CSS class(es)
 * @returns {string} HTML string
 */
function renderImage(image, cls = '') {
  if (!image || !image.url) return '';

  // Focal point: CSS object-position e.g. "30% 20%"
  // Defaults to "center center" if not specified
  const focalStyle = image.focal
    ? ` style="object-position: ${escHtml(image.focal)}"`
    : '';

  const caption = image.caption
    ? `<figcaption class="hse-image__caption hse-label">${escHtml(image.caption)}</figcaption>`
    : '';

  const printAttr = image.print_include ? ' data-print-include="true"' : '';

  return `<figure class="hse-image${cls ? ' ' + cls : ''}"${printAttr}>
  <img
    src="${escHtml(image.url)}"
    alt="${escHtml(image.alt || '')}"
    loading="lazy"
    decoding="async"${focalStyle}>
  ${caption}
</figure>`;
}

module.exports = { renderImage };
