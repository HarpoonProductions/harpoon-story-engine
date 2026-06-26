'use strict';

const { escHtml } = require('../shell/head');

function renderSplitReveal(section) {
  const sr      = section.split_reveal || {};
  const image   = sr.image    || {};
  const blocks  = sr.blocks   || [];

  // Heading: optional em (accent/bold) + light remainder
  let headingHtml = '';
  if (sr.heading_em || sr.heading) {
    const em   = sr.heading_em ? `<strong class="hse-sr__heading-em">${escHtml(sr.heading_em)}</strong>` : '';
    const rest = sr.heading    ? ` ${escHtml(sr.heading)}` : '';
    headingHtml = `<h2 class="hse-sr__heading">${em}${rest}</h2>`;
  }

  // Body blocks: paragraphs and inline image rows
  const blocksHtml = blocks.map(block => {
    if (block.type === 'image-row') {
      const cards = (block.images || []).map(img => `
      <div class="hse-sr__image-card">
        <img src="${escHtml(img.url || '')}" alt="${escHtml(img.alt || '')}" loading="lazy">
        ${img.caption ? `<span class="hse-sr__image-caption">${escHtml(img.caption)}</span>` : ''}
      </div>`).join('');
      return `<div class="hse-sr__image-row">${cards}\n    </div>`;
    }
    // Default: paragraph
    return `<p>${escHtml(block.text || '')}</p>`;
  }).join('\n    ');

  return `<section
  class="hse-section hse-section--split-reveal"
  id="${escHtml(section.id)}"
  data-layout="split-reveal">

  <div class="hse-sr__sticky">

    <!-- Left: full-bleed image with heading overlay -->
    <div class="hse-sr__media">
      <img
        src="${escHtml(image.url || '')}"
        alt="${escHtml(image.alt || '')}"
        style="object-position:${escHtml(image.focal || '50% 50%')}"
        loading="lazy">
      ${headingHtml ? `<div class="hse-sr__media-heading">${headingHtml}</div>` : ''}
    </div>

    <!-- Right: scrolling copy panel -->
    <div class="hse-sr__copy">
      <div class="hse-sr__copy-inner">
        ${blocksHtml}
      </div>
    </div>

  </div>

</section>`;
}

module.exports = { renderSplitReveal };
