'use strict';

const { escHtml } = require('../shell/head');
const { renderImage } = require('./image');

/**
 * Renders a cards array.
 * Used by stackable-cards and cascading-slides layouts,
 * and also available standalone within default sections.
 * @param {Array} cards  - array of HSE card definitions
 * @returns {string} HTML string
 */
function renderCards(cards) {
  if (!cards || cards.length === 0) return '';

  const cardsHtml = cards.map((card, i) => {
    const tag = card.tag
      ? `<span class="hse-card__tag hse-eyebrow">${escHtml(card.tag)}</span>`
      : '';

    const img = card.image ? renderImage(card.image, 'hse-card__image') : '';

    const link = card.link
      ? `<a href="${escHtml(card.link.href)}" class="hse-card__link hse-label">${escHtml(card.link.label)} →</a>`
      : '';

    return `<article class="hse-card hse-reveal hse-reveal-delay-${Math.min(i + 1, 3)}" id="card-${escHtml(card.id)}">
  ${img}
  <div class="hse-card__body">
    ${tag}
    <h3 class="hse-card__title">${escHtml(card.title)}</h3>
    <p class="hse-card__text">${escHtml(card.body)}</p>
    ${link}
  </div>
</article>`;
  }).join('\n');

  return `<div class="hse-cards" data-count="${cards.length}">
${cardsHtml}
</div>`;
}

module.exports = { renderCards };
