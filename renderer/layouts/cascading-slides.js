'use strict';

const { escHtml } = require('../shell/head');
const { renderImage } = require('../blocks/image');

/**
 * Renders a section using the cascading-slides layout.
 * Cards are presented as full-width alternating image+text panels
 * that cascade in on scroll — suited to sequential narrative content,
 * chapter breakdowns, or feature showcases where each item deserves
 * its own visual moment.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderCascadingSlides(section) {
  const cards = section.cards || [];

  const num = section.num
    ? `<span class="hse-eyebrow" style="color:var(--hse-accent)">${String(section.num).padStart(2, '0')}</span>`
    : '';

  const intro = section.intro
    ? `<p class="hse-section-intro hse-reveal">${escHtml(section.intro)}</p>`
    : '';

  const slides = cards.map((card, i) => {
    const side = i % 2 === 0 ? 'left' : 'right'; // alternate image side

    const img = card.image
      ? `<div class="hse-cs__slide-image">
          <img
            src="${escHtml(card.image.url)}"
            alt="${escHtml(card.image.alt || '')}"
            loading="lazy">
        </div>`
      : `<div class="hse-cs__slide-image hse-cs__slide-image--empty"></div>`;

    const tag = card.tag
      ? `<span class="hse-cs__slide-tag hse-eyebrow">${escHtml(card.tag)}</span>`
      : '';

    const link = card.link
      ? `<a href="${escHtml(card.link.href)}" class="hse-cs__slide-link hse-label">${escHtml(card.link.label)} →</a>`
      : '';

    return `<article
    class="hse-cs__slide hse-cs__slide--${side} hse-reveal"
    style="--slide-index: ${i}"
    id="cs-${escHtml(card.id)}">
    ${img}
    <div class="hse-cs__slide-body">
      ${tag}
      <h3 class="hse-cs__slide-title">${escHtml(card.title || '')}</h3>
      <p class="hse-cs__slide-text">${escHtml(card.body || '')}</p>
      ${link}
    </div>
  </article>`;
  }).join('\n');

  return `<section
  class="hse-section hse-section--cascading-slides"
  id="${escHtml(section.id)}"
  data-layout="cascading-slides">

  <div class="hse-inner">
    <header class="hse-section-header">
      ${num}
      <h2 class="hse-heading hse-reveal">${escHtml(section.title || '')}</h2>
    </header>
    ${intro}
  </div>

  <div class="hse-cs__slides">
    ${slides}
  </div>

</section>`;
}

module.exports = { renderCascadingSlides };
