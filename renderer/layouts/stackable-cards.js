'use strict';

const { escHtml } = require('../shell/head');
const { renderImage } = require('../blocks/image');

/**
 * Renders a section using the stackable-cards layout.
 * Cards are displayed in a scrollable grid with staggered entrance.
 * Uses section.cards array.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderStackableCards(section) {
  const cards = section.cards || [];

  const num = section.num
    ? `<span class="hse-eyebrow" style="color:var(--hse-accent)">${String(section.num).padStart(2, '0')}</span>`
    : '';

  const intro = section.intro
    ? section.intro.split(/\n\n+/).map(p => `<p class="hse-section-intro hse-reveal">${escHtml(p.trim())}</p>`).join("\n    ")
    : '';

  const cardsHtml = cards.map((card, i) => {
    const tag = card.tag
      ? `<span class="hse-sc__card-tag hse-eyebrow">${escHtml(card.tag)}</span>`
      : '';

    const img = card.image
      ? `<div class="hse-sc__card-image">
          <img src="${escHtml(card.image.url)}" alt="${escHtml(card.image.alt || '')}" loading="lazy">
        </div>`
      : '';

    const link = card.link
      ? `<a href="${escHtml(card.link.href)}" class="hse-sc__card-link hse-label">${escHtml(card.link.label)} →</a>`
      : '';

    return `<article
    class="hse-sc__card hse-reveal"
    style="--card-index: ${i}"
    id="sc-${escHtml(card.id)}">
    ${img}
    <div class="hse-sc__card-body">
      ${tag}
      <h3 class="hse-sc__card-title">${escHtml(card.title || '')}</h3>
      <p class="hse-sc__card-text">${escHtml(card.body || '')}</p>
      ${link}
    </div>
  </article>`;
  }).join('\n');

  return `<section
  class="hse-section hse-section--stackable-cards"
  id="${escHtml(section.id)}"
  data-layout="stackable-cards">

  <div class="hse-inner">
    <header class="hse-section-header">
      ${num}
      <h2 class="hse-heading hse-reveal">${escHtml(section.title || '')}</h2>
    </header>
    ${intro}
  </div>

  <div class="hse-sc__grid-wrap">
    <div class="hse-sc__grid hse-inner" data-count="${cards.length}">
      ${cardsHtml}
    </div>
  </div>

</section>`;
}

module.exports = { renderStackableCards };
