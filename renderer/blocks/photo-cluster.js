'use strict';

const { escHtml } = require('../shell/head');
const { renderImage } = require('./image');

/**
 * Renders a photo_cluster block.
 * layout: solo | duo | trio | quad
 * @param {object} cluster  - HSE photo_cluster definition
 * @returns {string} HTML string
 */
function renderPhotoCluster(cluster) {
  if (!cluster || !cluster.images || cluster.images.length === 0) return '';

  const layout  = cluster.layout || 'solo';
  const images  = cluster.images;
  const caption = cluster.caption
    ? `<figcaption class="hse-photo-cluster__caption hse-label">${escHtml(cluster.caption)}</figcaption>`
    : '';

  const imagesHtml = images.map((img, i) =>
    renderImage(img, `hse-photo-cluster__img hse-photo-cluster__img--${i + 1}`)
  ).join('\n');

  return `<figure class="hse-photo-cluster hse-photo-cluster--${layout} hse-reveal">
${imagesHtml}
${caption}
</figure>`;
}

module.exports = { renderPhotoCluster };
